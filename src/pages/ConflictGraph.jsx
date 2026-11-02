import { useMemo, useState, useEffect, useRef } from 'react';
import ReactFlow, { Background, Controls, MiniMap, useNodesState } from 'reactflow';
import 'reactflow/dist/style.css';
import StatCard from '../components/StatCard';
import { Badge } from '../components/DataTable';
import { Network, Share2, Percent, Hash, Layers, AlertTriangle } from 'lucide-react';
import { useData, slotLabel, CHART_COLORS, DEPT_SHORT, examSubjects } from '../data/sampleData';
import { buildConflictGraph, maxClique, findInvalidEdges } from '../algorithms/graphAlgorithms';
import { cmpSlots } from '../algorithms/schedulingAlgorithms';

export default function ConflictGraph() {
  const { data } = useData();
  const [selected, setSelected] = useState(null);
  const posRef = useRef({});

  // The graph is rebuilt from live enrolment data on every change
  const subs = useMemo(() => examSubjects(data), [data.subjects, data.settings.plan]);
  const graph = useMemo(() => buildConflictGraph(subs, data.students), [subs, data.students]);
  const clique = useMemo(() => maxClique(graph), [graph]);
  const slotsSorted = useMemo(() => [...data.slots].sort(cmpSlots), [data.slots]);
  const slotColor = useMemo(() => Object.fromEntries(slotsSorted.map((s, i) => [s.id, CHART_COLORS[i % CHART_COLORS.length]])), [slotsSorted]);
  const assign = useMemo(() => Object.fromEntries(data.timetable.map((e) => [e.subjectId, e])), [data.timetable]);
  const slotMap = Object.fromEntries(data.slots.map((s) => [s.id, s]));
  const roomMap = Object.fromEntries(data.rooms.map((r) => [r.id, r]));

  const colorArr = graph.vertices.map((v) => assign[v.id]?.slotId ?? null);
  const invalid = findInvalidEdges(graph, colorArr);
  const invalidSet = new Set(invalid.map((e) => `${e.a}-${e.b}`));
  const selIdx = selected !== null ? graph.index[selected] : null;
  const neighbours = selIdx !== null && selIdx !== undefined ? graph.adj[selIdx] : new Set();
  const maxDeg = graph.degree.length ? Math.max(...graph.degree) : 0;

  const computedNodes = useMemo(() => {
    const order = graph.vertices.map((v, i) => i).sort((a, b) => graph.vertices[a].dept.localeCompare(graph.vertices[b].dept) || graph.vertices[a].label.localeCompare(graph.vertices[b].label));
    const R = Math.max(230, graph.n * 24);
    return order.map((i, k) => {
      const v = graph.vertices[i];
      const ang = (2 * Math.PI * k) / graph.n - Math.PI / 2;
      const isSel = selIdx === i, dim = selIdx !== null && selIdx !== undefined && !isSel && !neighbours.has(i);
      const bg = assign[v.id] ? slotColor[assign[v.id].slotId] : '#94a3b8';
      return {
        id: v.id, position: { x: R * Math.cos(ang), y: R * Math.sin(ang) },
        data: { label: (<div className="text-center leading-tight"><div className="text-xs font-bold">{v.label}</div><div className="text-[10px] opacity-90">deg {graph.degree[i]}</div></div>) },
        style: { width: 70, height: 70, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, color: '#fff', border: `3px solid ${isSel ? '#0f172a' : '#fff'}`, boxShadow: '0 2px 8px rgba(0,0,0,.2)', opacity: dim ? 0.3 : 1 },
      };
    });
  }, [graph, assign, slotColor, selIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const [nodes, setNodes, onNodesChange] = useNodesState(computedNodes);
  useEffect(() => { setNodes(computedNodes.map((n) => ({ ...n, position: posRef.current[n.id] || n.position }))); }, [computedNodes, setNodes]);

  const edges = useMemo(() => graph.edges.map((e) => {
    const bad = invalidSet.has(`${e.a}-${e.b}`);
    const hot = selIdx !== null && selIdx !== undefined && (e.a === selIdx || e.b === selIdx);
    const faded = selIdx !== null && selIdx !== undefined && !hot;
    return {
      id: `${e.a}-${e.b}`, source: graph.vertices[e.a].id, target: graph.vertices[e.b].id, animated: bad,
      style: { stroke: bad ? '#dc2626' : hot ? '#2563eb' : '#cbd5e1', strokeWidth: bad || hot ? 2.5 : 1, opacity: faded ? 0.15 : 1 },
    };
  }), [graph, invalid.length, selIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const sel = selIdx !== null && selIdx !== undefined ? graph.vertices[selIdx] : null;
  const usedSlots = [...new Set(data.timetable.map((e) => e.slotId))].sort((a, b) => cmpSlots(slotMap[a], slotMap[b]));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={Network} tone="blue" label="Vertices |V| (subjects)" value={graph.n} />
        <StatCard icon={Share2} tone="violet" label="Edges |E| (conflicts)" value={graph.edges.length} />
        <StatCard icon={Percent} tone="blue" label="Graph density" value={graph.density.toFixed(3)} sub="2|E| / (|V|(|V|-1))" />
        <StatCard icon={Hash} tone="violet" label="Max degree Δ" value={maxDeg} sub={`Largest clique ω = ${clique.length} ⇒ χ(G) ≥ ${clique.length}`} />
        <StatCard icon={invalid.length ? AlertTriangle : Layers} tone={invalid.length ? 'red' : 'green'} label="Improper edges" value={invalid.length} sub={invalid.length ? 'Same-slot conflicts' : 'Colouring is proper'} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="card overflow-hidden xl:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <span className="text-sm font-semibold text-slate-900">Interactive conflict graph (click a vertex)</span>
            {selected && <button className="btn btn-outline btn-sm" onClick={() => setSelected(null)}>Clear selection</button>}
          </div>
          <div className="h-[600px]">
            <ReactFlow
              nodes={nodes} edges={edges} onNodesChange={onNodesChange} fitView minZoom={0.2} nodesConnectable={false} elementsSelectable
              onNodeClick={(_, n) => setSelected(n.id)} onNodeDragStop={(_, n) => { posRef.current[n.id] = n.position; }} onPaneClick={() => setSelected(null)}
            >
              <Background /><Controls showInteractive={false} /><MiniMap pannable zoomable nodeColor={(n) => n.style?.background || '#94a3b8'} />
            </ReactFlow>
          </div>
          <div className="flex flex-wrap gap-3 border-t border-slate-200 px-4 py-3 text-xs">
            <span className="font-semibold text-slate-600">Colour = time slot:</span>
            {usedSlots.map((id) => <span key={id} className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ background: slotColor[id] }} />{slotMap[id]?.date.slice(5)} {slotMap[id]?.session}</span>)}
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-slate-400" />Unscheduled</span>
            <span className="flex items-center gap-1.5 text-red-600"><span className="h-0.5 w-4 bg-red-600" />Conflicting edge</span>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Vertex details</h3>
          {!sel ? <p className="text-sm text-slate-500">Select a vertex to see its subject, degree, neighbours and slot. Its conflicting subjects will be highlighted in the graph.</p> : (
            <div className="space-y-3 text-sm">
              <div><div className="text-lg font-bold text-slate-900">{sel.label}</div><div className="text-slate-600">{sel.name}</div></div>
              <div className="flex flex-wrap gap-2"><Badge color="blue">{DEPT_SHORT[sel.dept] || sel.dept}</Badge><Badge color="violet">Year {sel.subject.year}</Badge><Badge color={sel.subject.type === 'Compulsory' ? 'blue' : 'orange'}>{sel.subject.type}</Badge><Badge color="slate">{sel.size} students</Badge><Badge color="orange">Degree {graph.degree[selIdx]}</Badge></div>
              <div><span className="label">Assigned slot</span>{assign[sel.id] ? slotLabel(slotMap[assign[sel.id].slotId]) : 'Not scheduled'}</div>
              <div><span className="label">Room</span>{assign[sel.id] ? roomMap[assign[sel.id].roomId]?.name || '—' : '—'}</div>
              <div>
                <span className="label">Conflicting subjects (shared students)</span>
                <ul className="max-h-60 space-y-1 overflow-y-auto">
                  {[...neighbours].map((j) => {
                    const e = graph.edges.find((x) => (x.a === selIdx && x.b === j) || (x.b === selIdx && x.a === j));
                    return <li key={j} className="flex justify-between rounded border border-slate-200 px-2 py-1"><span>{graph.vertices[j].label}</span><span className="text-slate-500">{e.common.length} shared</span></li>;
                  })}
                  {neighbours.size === 0 && <li className="text-slate-400">No conflicts – can share any slot.</li>}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">Adjacency matrix A (A[i][j] = 1 when subjects i and j share a student) · row sum = degree</div>
        <div className="max-h-[520px] overflow-auto p-4">
          <table className="border-collapse text-center text-[11px]">
            <thead><tr><th className="sticky left-0 top-0 z-20 bg-white p-1" />{graph.vertices.map((v) => <th key={v.id} className="sticky top-0 z-10 bg-white px-1 py-1 font-semibold text-slate-600" style={{ writingMode: 'vertical-rl' }}>{v.label}</th>)}<th className="sticky top-0 bg-white px-2 text-slate-600">deg</th></tr></thead>
            <tbody>
              {graph.matrix.map((row, i) => (
                <tr key={i}>
                  <th className="sticky left-0 z-10 bg-white pr-2 text-right font-semibold text-slate-600">{graph.vertices[i].label}</th>
                  {row.map((x, j) => <td key={j} className={`h-6 w-6 border border-slate-100 ${i === j ? 'bg-slate-100' : x ? 'bg-blue-600 text-white' : 'text-slate-300'} ${selIdx === i || selIdx === j ? 'ring-1 ring-inset ring-orange-400' : ''}`}>{x}</td>)}
                  <td className="px-2 font-semibold text-slate-700">{graph.degree[i]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

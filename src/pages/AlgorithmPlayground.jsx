import { useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Play, RotateCcw } from 'lucide-react';
import { Badge } from '../components/DataTable';
import { useData, CHART_COLORS, examSubjects } from '../data/sampleData';
import { buildConflictGraph, graphFromEdges, enrollmentSets, findInvalidEdges, maxClique, union, intersection, difference } from '../algorithms/graphAlgorithms';
import { greedyColoring, dsaturColoring, backtrackingSolve } from '../algorithms/schedulingAlgorithms';

/* ---------- preset graphs ---------- */
const letters = (n, pairs) => graphFromEdges(Array.from({ length: n }, (_, i) => ({ id: String.fromCharCode(65 + i), label: String.fromCharCode(65 + i) })), pairs);
const allPairs = (n) => { const p = []; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) p.push([i, j]); return p; };
function crown(n) {
  const vs = []; for (let i = 1; i <= n; i++) { vs.push({ id: `a${i}`, label: `a${i}` }); vs.push({ id: `b${i}`, label: `b${i}` }); }
  const pairs = []; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j) pairs.push([2 * i, 2 * j + 1]);
  return graphFromEdges(vs, pairs);
}
const CAMPUS = { DM: [1, 2, 3, 4], DS: [3, 4, 5, 6], CN: [5, 6, 7], OS: [8, 9], DB: [1, 7, 9], SE: [2, 8] };
function campus() {
  const names = Object.keys(CAMPUS);
  const sets = names.map((n) => new Set(CAMPUS[n]));
  const pairs = [];
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) { const c = intersection(sets[i], sets[j]); if (c.size) pairs.push([i, j, [...c]]); }
  return { graph: graphFromEdges(names.map((n) => ({ id: n, label: n })), pairs), sets: CAMPUS };
}
const PRESET_LABELS = { live: 'Live dataset (exam subjects)', campus: 'Small campus (6 subjects)', triangle: 'Triangle K3', k5: 'Complete graph K5', crown: 'Crown graph (n = 4)', path: 'Path P6' };
function getGraph(key, data) {
  if (key === 'live') return { graph: buildConflictGraph(examSubjects(data), data.students) };
  if (key === 'campus') return campus();
  if (key === 'triangle') return { graph: letters(3, allPairs(3)) };
  if (key === 'k5') return { graph: letters(5, allPairs(5)) };
  if (key === 'crown') return { graph: crown(4) };
  return { graph: letters(6, [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]]) };
}

/* ---------- SVG graph ---------- */
function MiniGraph({ graph, color = [], invalid = [], onNode, size = 380 }) {
  const c = size / 2, R = size / 2 - 34, r = graph.n > 12 ? 13 : 19;
  const pos = (i) => [c + R * Math.cos((2 * Math.PI * i) / graph.n - Math.PI / 2), c + R * Math.sin((2 * Math.PI * i) / graph.n - Math.PI / 2)];
  const bad = new Set(invalid.map((e) => `${e.a}-${e.b}`));
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-md">
      {graph.edges.map((e) => { const [x1, y1] = pos(e.a), [x2, y2] = pos(e.b); const b = bad.has(`${e.a}-${e.b}`); return <line key={`${e.a}-${e.b}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={b ? '#dc2626' : '#cbd5e1'} strokeWidth={b ? 3 : 1.2} />; })}
      {graph.vertices.map((v, i) => { const [x, y] = pos(i); const col = color[i]; return (
        <g key={v.id} onClick={() => onNode && onNode(i)} className={onNode ? 'cursor-pointer' : ''}>
          <circle cx={x} cy={y} r={r} fill={col === null || col === undefined ? '#e2e8f0' : CHART_COLORS[col % 10]} stroke="#fff" strokeWidth="2" />
          <text x={x} y={y + 4} textAnchor="middle" fontSize={graph.n > 12 ? 8 : 11} fontWeight="700" fill={col === null || col === undefined ? '#475569' : '#fff'}>{v.label}</text>
        </g>); })}
    </svg>
  );
}

const GraphPicker = ({ value, onChange }) => (
  <select className="input w-auto" value={value} onChange={(e) => onChange(e.target.value)}>{Object.entries(PRESET_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
);

/* ====================== A. SETS ====================== */
function SetsDemo() {
  const { data } = useData();
  const sets = useMemo(() => enrollmentSets(data.subjects, data.students), [data]);
  const [a, setA] = useState(data.subjects[0]?.id), [b, setB] = useState(data.subjects[1]?.id);
  const roll = Object.fromEntries(data.students.map((s) => [s.id, s.roll]));
  const SA = sets[a] || new Set(), SB = sets[b] || new Set();
  const Chips = ({ s, tone }) => <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">{[...s].map((id) => <Badge key={id} color={tone}>{roll[id]}</Badge>)}{!s.size && <span className="text-xs text-slate-400">∅ (empty set)</span>}</div>;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <select className="input w-auto" value={a} onChange={(e) => setA(e.target.value)}>{data.subjects.map((s) => <option key={s.id} value={s.id}>{s.code} – {s.name}</option>)}</select>
        <select className="input w-auto" value={b} onChange={(e) => setB(e.target.value)}>{data.subjects.map((s) => <option key={s.id} value={s.id}>{s.code} – {s.name}</option>)}</select>
      </div>
      <div className="grid gap-4 md:grid-cols-2"><div><span className="label">S_A ({SA.size})</span><Chips s={SA} tone="blue" /></div><div><span className="label">S_B ({SB.size})</span><Chips s={SB} tone="violet" /></div></div>
      <div className="grid gap-4 md:grid-cols-3">
        <div><span className="label">Union ({union(SA, SB).size})</span><Chips s={union(SA, SB)} tone="slate" /></div>
        <div><span className="label">Intersection ({intersection(SA, SB).size})</span><Chips s={intersection(SA, SB)} tone="red" /></div>
        <div><span className="label">A − B ({difference(SA, SB).size})</span><Chips s={difference(SA, SB)} tone="green" /></div>
      </div>
      <div>{intersection(SA, SB).size ? <Badge color="red">Intersection ≠ ∅ → exams cannot be simultaneous</Badge> : <Badge color="green">Intersection = ∅ → exams may share a slot</Badge>}</div>
    </div>
  );
}

/* ====================== B. GRAPH CONSTRUCTION ====================== */
function ConstructionDemo() {
  const { data } = useData();
  const [key, setKey] = useState('campus');
  const { graph, sets } = useMemo(() => getGraph(key, data), [key, data]);
  const roll = Object.fromEntries(data.students.map((s) => [s.id, s.roll]));
  return (
    <div className="space-y-4"><GraphPicker value={key} onChange={setKey} />
      <div className="grid gap-6 lg:grid-cols-2">
        <MiniGraph graph={graph} />
        <div className="space-y-3 text-sm">
          <div>|V| = <b>{graph.n}</b>, |E| = <b>{graph.edges.length}</b>, density = <b>{graph.density.toFixed(3)}</b></div>
          {sets && <div className="mono rounded-lg bg-slate-50 p-3 text-xs">{Object.entries(sets).map(([k, v]) => <div key={k}>S_{k} = {'{'}{v.join(', ')}{'}'}</div>)}</div>}
          <div className="max-h-64 overflow-auto rounded-lg border border-slate-200"><table className="w-full"><thead><tr><th className="th">Edge</th><th className="th">Common students</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{graph.edges.map((e) => <tr key={`${e.a}-${e.b}`}><td className="td">{graph.vertices[e.a].label} — {graph.vertices[e.b].label}</td><td className="td text-xs">{e.common.length ? e.common.slice(0, 4).map((c) => roll[c] ?? c).join(', ') + (e.common.length > 4 ? ` … (${e.common.length})` : '') : '—'}</td></tr>)}
              {!graph.edges.length && <tr><td colSpan={2} className="td text-slate-400">No edges</td></tr>}</tbody></table></div>
        </div>
      </div>
    </div>
  );
}

/* ====================== C. GREEDY COLOURING ====================== */
function ColoringDemo() {
  const { data } = useData();
  const [key, setKey] = useState('campus');
  const [order, setOrder] = useState('natural');
  const { graph } = useMemo(() => getGraph(key, data), [key, data]);
  const [color, setColor] = useState(null);
  const [info, setInfo] = useState('');
  const run = () => { const r = greedyColoring(graph, order); setColor(r.color); setInfo(`Greedy (${order} order) used ${r.used} colour(s)`); };
  const cur = color && color.length === graph.n ? color : Array(graph.n).fill(null);
  const invalid = findInvalidEdges(graph, cur);
  const click = (i) => { const next = [...cur]; next[i] = ((next[i] ?? -1) + 1) % Math.max(2, graph.n); setColor(next); setInfo('Manual edit: click vertices to change colours'); };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3"><GraphPicker value={key} onChange={(k) => { setKey(k); setColor(null); setInfo(''); }} />
        <select className="input w-auto" value={order} onChange={(e) => setOrder(e.target.value)}><option value="natural">Natural order</option><option value="degree">Highest degree first</option></select>
        <button className="btn btn-primary" onClick={run}><Play size={16} /> Run greedy colouring</button><button className="btn btn-outline" onClick={() => { setColor(null); setInfo(''); }}><RotateCcw size={16} /> Clear</button></div>
      <div className="grid gap-6 lg:grid-cols-2">
        <MiniGraph graph={graph} color={cur} invalid={invalid} onNode={click} />
        <div className="space-y-3 text-sm">
          {info && <div className="font-medium text-slate-700">{info}</div>}
          <div>Colours used: <b>{new Set(cur.filter((c) => c !== null)).size}</b> · Invalid edges: {invalid.length ? <Badge color="red">{invalid.length} (red)</Badge> : <Badge color="green">0 – proper colouring</Badge>}</div>
          <p className="text-xs text-slate-500">Click any vertex to change its colour by hand. If two adjacent vertices share a colour, the edge turns red: that is exactly a student clash.</p>
          <div className="max-h-56 overflow-auto rounded-lg border border-slate-200"><table className="w-full"><thead><tr><th className="th">Vertex</th><th className="th">Colour (slot)</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{graph.vertices.map((v, i) => <tr key={v.id}><td className="td">{v.label}</td><td className="td">{cur[i] === null ? '—' : <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: CHART_COLORS[cur[i] % 10] }} />slot {cur[i] + 1}</span>}</td></tr>)}</tbody></table></div>
        </div>
      </div>
    </div>
  );
}

/* ====================== D. BACKTRACKING ====================== */
function BacktrackDemo() {
  const { data } = useData();
  const [key, setKey] = useState('k5');
  const [k, setK] = useState(4);
  const { graph } = useMemo(() => getGraph(key, data), [key, data]);
  const [res, setRes] = useState(null);
  const [step, setStep] = useState(0);
  const run = () => { const r = backtrackingSolve(graph, Array.from({ length: k }, (_, i) => i), { record: true, maxNodes: 20000 }); setRes({ ...r, graphKey: key, k }); setStep(r.steps.length); };
  const valid = res && res.graphKey === key;
  const state = useMemo(() => { const c = Array(graph.n).fill(null); if (valid) res.steps.slice(0, step).forEach((s) => { if (s.type === 'assign') c[s.v] = s.c; if (s.type === 'backtrack') c[s.v] = null; }); return c; }, [res, step, graph, valid]);
  const icon = { assign: '→ assign', skip: '✗ skip', backtrack: '↩ BACKTRACK' };
  const cls = { assign: 'text-green-700', skip: 'text-slate-400', backtrack: 'text-red-600 font-semibold' };
  const omega = useMemo(() => maxClique(graph).length, [graph]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3"><GraphPicker value={key} onChange={(v) => { setKey(v); setRes(null); }} />
        <label className="text-sm">Slots available: <input type="number" min="1" max="12" className="input ml-1 inline-block w-20" value={k} onChange={(e) => setK(Math.max(1, Math.min(12, Number(e.target.value) || 1)))} /></label>
        <button className="btn btn-primary" onClick={run}><Play size={16} /> Run backtracking</button></div>
      <div className="text-xs text-slate-500">Largest clique ω = {omega}. By the Pigeonhole Principle, fewer than {omega} slots must fail.</div>
      {valid && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div><MiniGraph graph={graph} color={state} />
            <input type="range" min="0" max={res.steps.length} value={step} onChange={(e) => setStep(Number(e.target.value))} className="mt-2 w-full" />
            <div className="text-center text-xs text-slate-500">Step {step} / {res.steps.length}{res.truncated ? ' (log truncated)' : ''}</div></div>
          <div className="space-y-3 text-sm">
            <div>{res.success ? <Badge color="green">Success – every vertex coloured</Badge> : <Badge color="red">{res.aborted ? 'Search limit reached' : `No valid assignment with ${res.k} slot(s)`}</Badge>}</div>
            <div>Nodes explored: <b>{res.nodes}</b> · Backtracks: <b>{res.backtracks}</b> · Max depth: <b>{res.maxDepth}</b></div>
            {res.success && <div className="text-xs">Final: {graph.vertices.map((v, i) => `${v.label}→${res.color[i] + 1}`).join(', ')}</div>}
            <div className="mono max-h-72 overflow-auto rounded-lg bg-slate-50 p-3 text-xs">
              {res.steps.slice(0, 400).map((s, i) => (
                <div key={i} className={`${cls[s.type]} ${i === step - 1 ? 'bg-yellow-100' : ''}`} style={{ paddingLeft: s.depth * 12 }}>
                  {icon[s.type]} {graph.vertices[s.v].label} {s.type === 'skip' ? `slot ${s.c + 1} (${s.reason === 'neighbour' ? 'neighbour uses it' : 'resource'})` : `slot ${s.c + 1}`}
                </div>))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ====================== E. COMPARISON ====================== */
function ComparisonDemo() {
  const { data } = useData();
  const [key, setKey] = useState('crown');
  const { graph } = useMemo(() => getGraph(key, data), [key, data]);
  const [rows, setRows] = useState(null);
  const run = () => {
    const reps = 300;
    const methods = [['Greedy (natural order)', () => greedyColoring(graph, 'natural')], ['Greedy (highest degree first)', () => greedyColoring(graph, 'degree')], ['DSATUR', () => dsaturColoring(graph)]];
    setRows(methods.map(([name, f]) => { let r; const t = performance.now(); for (let i = 0; i < reps; i++) r = f(); return { name, colors: r.used, ms: (performance.now() - t) / reps }; }));
  };
  const omega = useMemo(() => maxClique(graph).length, [graph]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3"><GraphPicker value={key} onChange={(k) => { setKey(k); setRows(null); }} /><button className="btn btn-primary" onClick={run}><Play size={16} /> Compare</button></div>
      {rows && (
        <div className="grid gap-6 lg:grid-cols-2">
          <table className="w-full self-start rounded-lg border border-slate-200"><thead><tr><th className="th">Algorithm</th><th className="th">Colours / slots</th><th className="th">Avg time</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{rows.map((r) => <tr key={r.name}><td className="td">{r.name}</td><td className="td"><Badge color={r.colors === Math.min(...rows.map((x) => x.colors)) ? 'green' : 'orange'}>{r.colors}</Badge></td><td className="td">{r.ms.toFixed(4)} ms</td></tr>)}</tbody></table>
          <div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={rows}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="colors" fill="#2563eb" name="Colours" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
          <div className="text-sm text-slate-600 lg:col-span-2">Lower bound: χ(G) ≥ ω(G) = <b>{omega}</b>. Greedy colouring depends on the vertex order: a bad order can force extra colours (try the crown graph, where natural order needs 4 colours but 2 are enough). DSATUR always picks the vertex with the most distinct neighbour colours next, so the most constrained subjects are placed first, which usually gives fewer slots. Both are heuristics and neither guarantees the true chromatic number.</div>
        </div>
      )}
    </div>
  );
}

const TABS = [['A', 'Set operations', SetsDemo], ['B', 'Graph construction', ConstructionDemo], ['C', 'Graph colouring', ColoringDemo], ['D', 'Backtracking', BacktrackDemo], ['E', 'Algorithm comparison', ComparisonDemo]];

export default function AlgorithmPlayground() {
  const [tab, setTab] = useState('A');
  const Active = TABS.find((t) => t[0] === tab)[2];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">{TABS.map(([k, l]) => <button key={k} className={`btn ${tab === k ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab(k)}>{k}. {l}</button>)}</div>
      <div className="card p-5"><Active /></div>
    </div>
  );
}

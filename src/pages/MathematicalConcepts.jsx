import { useMemo, useState } from 'react';
import { useData, examSubjects } from '../data/sampleData';
import { buildConflictGraph, maxClique, enrollmentSets, intersection, union, difference } from '../algorithms/graphAlgorithms';
import { Badge } from '../components/DataTable';

const CONCEPTS = [
  ['Sets', 'Students of a subject', 'A subject is just the set of students who write it.'],
  ['Intersection', 'Finding clashes', 'Students common to two subjects. If it is not empty, the exams cannot be at the same time.'],
  ['Graph', 'Conflict graph', 'Dots = subjects, line = “some student writes both”.'],
  ['Graph colouring', 'Choosing time slots', 'Give every dot a colour (slot) so that joined dots never share a colour.'],
  ['Pigeonhole principle', 'Minimum slots', 'If 6 subjects all clash with each other, you need at least 6 slots.'],
  ['Counting', 'Why we need a smart search', 'Trying every possible timetable takes far too long.'],
  ['Recursion & backtracking', 'Fixing wrong choices', 'Place a subject; if we get stuck, undo the last choice and try another slot.'],
  ['Logic', 'Is a placement allowed?', 'Allowed only if NO clash AND room free AND teacher free.'],
];

const Card = ({ title, simple, children }) => (
  <div className="card p-5">
    <h2 className="mb-2 text-base font-semibold text-slate-900">{title}</h2>
    <p className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900"><b>In simple words:</b> {simple}</p>
    {children}
  </div>
);
const Formula = ({ children }) => <div className="mono my-3 rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-green-300">{children}</div>;
const Num = ({ value, set, min = 1, max = 30 }) => <input type="number" className="input inline-block w-20" min={min} max={max} value={value} onChange={(e) => set(Math.max(min, Math.min(max, Number(e.target.value) || min)))} />;

export default function MathematicalConcepts() {
  const { data } = useData();
  const subs = useMemo(() => examSubjects(data), [data]);
  const graph = useMemo(() => buildConflictGraph(subs, data.students), [subs, data.students]);
  const sets = useMemo(() => enrollmentSets(subs, data.students), [subs, data.students]);
  const clique = useMemo(() => maxClique(graph), [graph]);
  const rollOf = Object.fromEntries(data.students.map((s) => [s.id, s.roll]));

  const [a, setA] = useState(subs[0]?.id), [b, setB] = useState(subs[1]?.id);
  const SA = sets[a] || new Set(), SB = sets[b] || new Set(), inter = intersection(SA, SB);
  const [P, setP] = useState(true), [Q, setQ] = useState(true), [R, setR] = useState(true);
  const [k, setK] = useState(10), [m, setM] = useState(5);
  const [exams, setExams] = useState(6), [slots, setSlots] = useState(4);

  const isEl = (i) => graph.vertices[i].subject.type === 'Elective';
  const ee = graph.edges.filter((e) => isEl(e.a) && isEl(e.b)).length;
  const nEl = graph.vertices.filter((_, i) => isEl(i)).length;
  const degSum = graph.degree.reduce((s, d) => s + d, 0);

  return (
    <div className="space-y-6">
      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-900">Concept → where ExamSync uses it</div>
        <div className="overflow-x-auto"><table className="w-full"><thead><tr><th className="th">Concept</th><th className="th">Used for</th><th className="th">Meaning</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{CONCEPTS.map(([c, ap, f]) => <tr key={c}><td className="td font-medium">{c}</td><td className="td">{ap}</td><td className="td text-xs text-slate-600">{f}</td></tr>)}</tbody></table></div>
      </div>

      <Card title="1. Sets and intersection" simple="Each subject is a list of students. Two exams clash when the two lists have a student in common.">
        <Formula>S_A ∩ S_B ≠ ∅  ⇒  A and B clash (cannot be in the same slot)</Formula>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select className="input w-auto" value={a} onChange={(e) => setA(e.target.value)}>{subs.map((s) => <option key={s.id} value={s.id}>{s.code} – {s.name}</option>)}</select>
          <span>and</span>
          <select className="input w-auto" value={b} onChange={(e) => setB(e.target.value)}>{subs.map((s) => <option key={s.id} value={s.id}>{s.code} – {s.name}</option>)}</select>
        </div>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
          <div>Students in A: <b>{SA.size}</b></div><div>Students in B: <b>{SB.size}</b></div><div>In both (A ∩ B): <b>{inter.size}</b></div><div>In A or B (A ∪ B): <b>{union(SA, SB).size}</b></div>
        </div>
        <p className="mt-2 text-sm">Common students: {inter.size ? [...inter].slice(0, 8).map((id) => rollOf[id]).join(', ') + (inter.size > 8 ? ' …' : '') : 'none'} — {inter.size ? <Badge color="red">Cannot be at the same time</Badge> : <Badge color="green">Can share a slot</Badge>}</p>
        <p className="mt-1 text-xs text-slate-500">Only in A (A − B): {difference(SA, SB).size} students.</p>
      </Card>

      <Card title="2. Compulsory and elective subjects" simple="Everyone in a year writes the compulsory subjects, so they clash with everything of that year. Electives clash only when a student actually chose both.">
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <div>Compulsory subjects: <b>{graph.n - nEl}</b></div>
          <div>Elective subjects: <b>{nEl}</b></div>
          <div>Elective pairs that clash: <b>{ee}</b> of {(nEl * (nEl - 1)) / 2} possible pairs</div>
        </div>
        <p className="mt-2 text-xs text-slate-500">Example: if 4 electives are offered and every student picks 2, two electives clash only when some student picked that exact pair. Electives nobody combines can share a slot – that is where the timetable saves time.</p>
      </Card>

      <Card title="3. The conflict graph" simple="Draw a dot for every subject and join two dots when their exams clash. The number of lines at a dot is its degree.">
        <Formula>G = (V, E)   V = subjects   E = pairs of subjects that share a student</Formula>
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <div>Dots |V| = <b>{graph.n}</b></div><div>Lines |E| = <b>{graph.edges.length}</b></div><div>Sum of degrees = <b>{degSum}</b> = 2 × {graph.edges.length} (every line has two ends)</div>
        </div>
        <p className="mt-2 text-xs text-slate-500">See it drawn on the Conflict Graph page.</p>
      </Card>

      <Card title="4. Colouring and the pigeonhole principle" simple="A time slot is a colour. Dots that are joined must get different colours. If 6 subjects all clash with each other, 6 slots are the minimum.">
        <Formula>6 subjects that all clash with each other  ⇒  at least 6 different slots</Formula>
        <div className="flex flex-wrap items-center gap-2 text-sm">Mutually clashing exams = <Num value={exams} set={setExams} /> slots available = <Num value={slots} set={setSlots} />
          → {exams > slots ? <Badge color="red">Impossible – two clashing exams would share a slot</Badge> : <Badge color="green">Possible</Badge>}</div>
        <p className="mt-3 text-sm">In your current exam setup the biggest group of mutually clashing subjects has <b>{clique.length}</b> subjects ({clique.map((i) => graph.vertices[i].label).join(', ') || '—'}), so you need <b>at least {clique.length}</b> slots.</p>
        <p className="mt-1 text-xs text-slate-500">ExamSync uses DSATUR / greedy colouring. They find a good timetable quickly but do not promise the absolute minimum number of slots.</p>
      </Card>

      <Card title="5. Counting, recursion and backtracking" simple="Trying every combination is hopeless, so we place subjects one by one and undo a choice when it leads to a dead end.">
        <Formula>k exams, m slots  ⇒  m × m × … × m = mᵏ possible timetables</Formula>
        <div className="flex flex-wrap items-center gap-2 text-sm">k = <Num value={k} set={setK} max={60} /> exams, m = <Num value={m} set={setM} max={30} /> slots → <b>{(BigInt(m) ** BigInt(k)).toString()}</b> possible timetables
          <span className="text-slate-500">(far too many to test one by one)</span></div>
        <pre className="mono mt-3 overflow-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-green-300">{`place(subject):
  for each slot:
     if no clash, room free and teacher free:
        put the subject here
        if place(next subject) works  -> done
        otherwise UNDO and try the next slot   <- backtracking
  no slot worked -> go back to the previous subject`}</pre>
        <p className="mt-2 text-xs text-slate-500">Open Algorithm Playground → Backtracking to watch a real run step by step.</p>
      </Card>

      <Card title="6. Logic: is a placement allowed?" simple="All three conditions must be true. One false condition rejects the placement.">
        <Formula>allowed = (no common student) AND (room free) AND (teacher free)</Formula>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {[['No common student', P, setP], ['Room free', Q, setQ], ['Teacher free', R, setR]].map(([l, v, f]) => <label key={l} className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={v} onChange={(e) => f(e.target.checked)} />{l}</label>)}
          <span>⇒ placement is {P && Q && R ? <Badge color="green">ACCEPTED</Badge> : <Badge color="red">REJECTED</Badge>}</span>
        </div>
      </Card>
    </div>
  );
}

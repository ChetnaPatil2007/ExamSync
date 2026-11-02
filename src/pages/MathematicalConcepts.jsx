import { useMemo, useState } from 'react';
import { useData } from '../data/sampleData';
import { buildConflictGraph, maxClique, enrollmentSets } from '../algorithms/graphAlgorithms';
import {
  intersection, union, difference, nPr, nCr, power, factorialRecursive, listPermutations,
  pigeonhole, mod, gcd, isCongruent, modInverse, cyclicSlot, analyzeStructure,
} from '../algorithms/mathOperations';
import { Badge } from '../components/DataTable';

const CONCEPTS = [
  ['Sets', 'Student enrolment', 'S_A = {students of subject A}'], ['Set intersection', 'Common students', 'S_A ∩ S_B ≠ ∅'],
  ['Relations', 'Subject conflicts', 'R = {(A,B) : S_A ∩ S_B ≠ ∅}'], ['Logic', 'Scheduling conditions', 'valid ⇔ ¬student ∧ ¬room ∧ ¬faculty'],
  ['Permutations', 'Possible arrangements', 'P(n,r) = n!/(n−r)!'], ['Pigeonhole Principle', 'Minimum slots for clique', 'k mutually conflicting exams need ≥ k slots'],
  ['Graphs', 'Conflict representation', 'G = (V, E)'], ['Graph colouring', 'Time-slot assignment', 'c(u) ≠ c(v) for every edge uv'],
  ['Vertex degree', 'Number of conflicts', 'Σ deg(v) = 2|E|'], ['Adjacency matrix', 'Graph connections', 'A[i][j] = 1 ⇔ uv ∈ E'],
  ['Trees', 'Backtracking decisions', 'search tree: level = subject, branch = slot'], ['Recursion', 'Exploring assignments', 'solve(k) = ∃ slot : valid ∧ solve(k+1)'],
  ['Modular arithmetic', 'Cyclic slot indexing', 'slot = (i + shift) mod n'],
];

const Card = ({ unit, title, children }) => (
  <div className="card p-5"><div className="mb-3 flex items-center gap-2"><Badge color="violet">{unit}</Badge><h2 className="text-base font-semibold text-slate-900">{title}</h2></div>{children}</div>
);
const Formula = ({ children }) => <div className="mono my-3 rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-green-300">{children}</div>;
const Num = ({ value, set, min = 0, max = 99, w = 'w-20' }) => <input type="number" className={`input ${w} inline-block`} min={min} max={max} value={value} onChange={(e) => set(Math.max(min, Math.min(max, Number(e.target.value) || 0)))} />;

export default function MathematicalConcepts() {
  const { data } = useData();
  const graph = useMemo(() => buildConflictGraph(data.subjects, data.students), [data.subjects, data.students]);
  const sets = useMemo(() => enrollmentSets(data.subjects, data.students), [data.subjects, data.students]);
  const clique = useMemo(() => maxClique(graph), [graph]);
  const rollOf = Object.fromEntries(data.students.map((s) => [s.id, s.roll]));

  // Sets
  const [a, setA] = useState(data.subjects[0]?.id), [b, setB] = useState(data.subjects[1]?.id);
  const SA = sets[a] || new Set(), SB = sets[b] || new Set(), inter = intersection(SA, SB);
  // Logic
  const [P, setP] = useState(true), [Q, setQ] = useState(true), [R, setR] = useState(true);
  // Counting
  const [n, setN] = useState(5), [r, setR2] = useState(3), [k, setK] = useState(4), [m, setM] = useState(5), [fn, setFn] = useState(5);
  // Pigeonhole
  const [exams, setExams] = useState(5), [slots, setSlots] = useState(4);
  // Number theory
  const [x, setX] = useState(17), [y, setY] = useState(5), [shift, setShift] = useState(3), [idx, setIdx] = useState(8);
  // Algebra
  const [modN, setModN] = useState(5), [opKind, setOpKind] = useState('add');
  const elems = Array.from({ length: modN }, (_, i) => i);
  const alg = useMemo(() => analyzeStructure(elems, opKind === 'add' ? (p, q) => mod(p + q, modN) : (p, q) => mod(p * q, modN)), [modN, opKind]); // eslint-disable-line
  const trace = []; factorialRecursive(Math.min(fn, 8), trace);
  const ph = pigeonhole(exams, slots);
  const degSum = graph.degree.reduce((s, d) => s + d, 0);

  return (
    <div className="space-y-6">
      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-900">Syllabus map: concept → application in ExamSync</div>
        <div className="overflow-x-auto"><table className="w-full"><thead><tr><th className="th">Concept</th><th className="th">Application</th><th className="th">Formula / idea</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{CONCEPTS.map(([c, ap, f]) => <tr key={c}><td className="td font-medium">{c}</td><td className="td">{ap}</td><td className="td mono text-xs">{f}</td></tr>)}</tbody></table></div>
      </div>

      <Card unit="Unit 1" title="Sets, relations and logic">
        <p className="text-sm text-slate-600">Each subject is the <b>set</b> of students enrolled in it. Two exams may not run together when their sets have a non-empty <b>intersection</b>.</p>
        <Formula>S_A ∩ S_B ≠ ∅ ⇒ A and B conflict (edge in G)</Formula>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select className="input w-auto" value={a} onChange={(e) => setA(e.target.value)}>{data.subjects.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}</select>
          <span>and</span>
          <select className="input w-auto" value={b} onChange={(e) => setB(e.target.value)}>{data.subjects.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}</select>
        </div>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
          <div>|S_A| = <b>{SA.size}</b></div><div>|S_B| = <b>{SB.size}</b></div><div>|S_A ∩ S_B| = <b>{inter.size}</b></div><div>|S_A ∪ S_B| = <b>{union(SA, SB).size}</b></div>
        </div>
        <p className="mt-2 text-sm">Common students: {inter.size ? [...inter].slice(0, 8).map((id) => rollOf[id]).join(', ') + (inter.size > 8 ? ' …' : '') : 'none'} — {inter.size ? <Badge color="red">Cannot be simultaneous</Badge> : <Badge color="green">May share a slot</Badge>}</p>
        <p className="mt-1 text-xs text-slate-500">|S_A − S_B| = {difference(SA, SB).size}</p>
        <div className="mt-5 border-t border-slate-100 pt-4">
          <div className="text-sm font-semibold text-slate-900">Logic: the scheduling condition</div>
          <Formula>valid(exam) = (no common student) ∧ (room free) ∧ (faculty free)</Formula>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {[['No common student', P, setP], ['Room free', Q, setQ], ['Faculty free', R, setR]].map(([l, v, f]) => <label key={l} className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={v} onChange={(e) => f(e.target.checked)} />{l}</label>)}
            <span>⇒ assignment is {P && Q && R ? <Badge color="green">ACCEPTED</Badge> : <Badge color="red">REJECTED</Badge>}</span>
          </div>
        </div>
      </Card>

      <Card unit="Unit 2" title="Counting, recursion and the Pigeonhole Principle">
        <Formula>P(n,r) = n!/(n−r)!     C(n,r) = n!/(r!(n−r)!)     slot choices for k exams in m slots = mᵏ</Formula>
        <div className="flex flex-wrap items-center gap-2 text-sm">n = <Num value={n} set={setN} max={20} /> r = <Num value={r} set={setR2} max={20} />
          → P(n,r) = <b>{nPr(n, r).toString()}</b>, C(n,r) = <b>{nCr(n, r).toString()}</b></div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">k exams = <Num value={k} set={setK} max={30} /> slots m = <Num value={m} set={setM} max={20} min={1} /> → raw assignments mᵏ = <b>{power(m, k).toString()}</b> <span className="text-slate-500">(why we need pruning/backtracking)</span></div>
        <div className="mt-2 text-xs text-slate-500">Orderings of the first {Math.min(3, n)} exams: {listPermutations(data.subjects.slice(0, Math.min(3, n)).map((s) => s.code), 6).map((p) => p.join('→')).join(' | ')}</div>
        <div className="mt-5 border-t border-slate-100 pt-4">
          <div className="text-sm font-semibold text-slate-900">Recursion</div>
          <div className="mb-2 flex items-center gap-2 text-sm">fact(<Num value={fn} set={setFn} max={8} />)</div>
          <pre className="mono max-h-44 overflow-auto rounded-lg bg-slate-50 p-3 text-xs">{trace.join('\n')}</pre>
        </div>
        <div className="mt-5 border-t border-slate-100 pt-4">
          <div className="text-sm font-semibold text-slate-900">Pigeonhole Principle</div>
          <Formula>k pairwise-conflicting exams ⇒ at least k distinct slots</Formula>
          <div className="flex flex-wrap items-center gap-2 text-sm">Mutually conflicting exams = <Num value={exams} set={setExams} max={30} /> available slots = <Num value={slots} set={setSlots} min={1} max={30} />
            → {exams > slots ? <Badge color="red">Impossible – some slot would hold two conflicting exams</Badge> : <Badge color="green">Feasible</Badge>}</div>
          <p className="mt-2 text-xs text-slate-500">If {exams} exams are placed into {slots} slots, some slot holds at least ⌈{exams}/{slots}⌉ = {ph.atLeast} of them. In the current dataset the largest clique has {clique.length} subjects, so at least {clique.length} slots are needed.</p>
        </div>
      </Card>

      <Card unit="Unit 3" title="Algebraic structures (supporting demonstration)">
        <p className="text-sm text-slate-600">Closure, associativity, commutativity, identity and inverses are checked by brute force on the set Zₙ = {'{0,…,n−1}'}.</p>
        <div className="my-3 flex flex-wrap items-center gap-3 text-sm">n = <Num value={modN} set={setModN} min={2} max={12} />
          <select className="input w-auto" value={opKind} onChange={(e) => setOpKind(e.target.value)}><option value="add">a ⊕ b = (a + b) mod n</option><option value="mul">a ⊗ b = (a × b) mod n</option></select></div>
        <div className="grid gap-2 text-sm sm:grid-cols-5">
          {[['Closure', alg.closed], ['Associative', alg.assoc], ['Commutative', alg.comm], ['Identity', alg.identity !== null], ['Inverses', alg.hasInverses]].map(([l, v]) => <div key={l} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">{l}<Badge color={v ? 'green' : 'red'}>{v ? 'Yes' : 'No'}</Badge></div>)}
        </div>
        <p className="mt-3 text-sm">Identity element: <b>{alg.identity ?? 'none'}</b> — Structure is {alg.isGroup ? <Badge color="green">a group</Badge> : <Badge color="orange">not a group</Badge>}
          {opKind === 'mul' && modN > 2 && <span className="text-slate-500"> (multiplication mod n is a group only on the units, e.g. when n is prime and 0 is removed)</span>}</p>
      </Card>

      <Card unit="Unit 4" title="Number theory: divisibility, congruence and cyclic slot indexing">
        <Formula>a ≡ b (mod m) ⇔ m | (a − b)     a mod m = remainder     slot = (i + shift) mod n</Formula>
        <div className="flex flex-wrap items-center gap-2 text-sm">a = <Num value={x} set={setX} max={999} /> m = <Num value={y} set={setY} min={1} max={99} />
          → a mod m = <b>{mod(x, y)}</b>, gcd(a,m) = <b>{gcd(x, y)}</b>, {y} | {x}? <b>{x % y === 0 ? 'yes' : 'no'}</b>, a ≡ {mod(x, y)} (mod {y}): <b>{isCongruent(x, mod(x, y), y) ? 'true' : 'false'}</b>, inverse of a mod m: <b>{modInverse(mod(x, y), y) ?? 'none'}</b></div>
        <div className="mt-4 text-sm">Cyclic slot indexing: exam index <Num value={idx} set={setIdx} max={99} /> shifted by <Num value={shift} set={setShift} max={99} /> over {Math.max(1, data.slots.length)} slots →
          slot index <b>{cyclicSlot(idx, shift, Math.max(1, data.slots.length))}</b> {data.slots[cyclicSlot(idx, shift, Math.max(1, data.slots.length))] && <span className="text-slate-500">({data.slots[cyclicSlot(idx, shift, data.slots.length)].id})</span>}</div>
      </Card>

      <Card unit="Unit 5" title="Graph theory">
        <Formula>G = (V, E)   V = subjects   E = {'{ uv : S_u ∩ S_v ≠ ∅ }'}   χ(G) = minimum colours</Formula>
        <div className="grid gap-2 text-sm sm:grid-cols-4">
          <div>|V| = <b>{graph.n}</b></div><div>|E| = <b>{graph.edges.length}</b></div><div>Σ deg(v) = <b>{degSum}</b> = 2|E| = <b>{2 * graph.edges.length}</b></div><div>ω(G) = <b>{clique.length}</b> ⇒ χ(G) ≥ {clique.length}</div>
        </div>
        <p className="mt-3 text-xs text-slate-500">ExamSync uses heuristic colouring (greedy / DSATUR). It finds a valid colouring quickly but does <b>not</b> claim to always find the true chromatic number. Max clique found: {clique.map((i) => graph.vertices[i].label).join(', ') || '—'}.</p>
      </Card>

      <Card unit="Unit 6" title="Trees and backtracking">
        <p className="text-sm text-slate-600">The search is a <b>decision tree</b>: each level picks one subject, each branch is a candidate time slot. If a subject has no legal slot, the algorithm <b>backtracks</b> to the previous level and tries the next branch.</p>
        <pre className="mono mt-3 overflow-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-green-300">{`root
├─ CS301 → slot 1
│  ├─ CS302 → slot 1  ✗ (shares students with CS301)
│  ├─ CS302 → slot 2  ✓
│  │  ├─ CS303 → slot 1,2 ✗ … slot 3 ✓
│  │  │  └─ … dead end?  ↩ backtrack: undo CS303, try next slot
│  │  └─ …
│  └─ …
└─ CS301 → slot 2 (only tried if every branch under slot 1 failed)`}</pre>
        <p className="mt-2 text-xs text-slate-500">Open the Algorithm Playground → Backtracking to step through a real run.</p>
      </Card>
    </div>
  );
}

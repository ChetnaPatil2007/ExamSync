import { useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Clock, CalendarClock, Play, Wand2, CheckCircle2, XCircle, AlertTriangle, GitCompare, X } from 'lucide-react';
import DataTable, { Badge, IconBtn } from '../components/DataTable';
import { FormModal, ConfirmDialog } from '../components/Modal';
import StatCard from '../components/StatCard';
import { useData, DEPARTMENTS, DEPT_SHORT, nextId, fmtDate, slotLabel, todayISO, buildPlanSlots, planDates, planExam } from '../data/sampleData';
import { slotsOverlap, cmpSlots } from '../algorithms/schedulingAlgorithms';
import { buildConflictGraph, maxClique } from '../algorithms/graphAlgorithms';

/* ====================== A. TIME SLOTS ====================== */
function SlotsTab() {
  const { data, setData, notify, log } = useData();
  const [form, setForm] = useState(null);
  const [del, setDel] = useState(null);
  const sorted = [...data.slots].sort(cmpSlots);
  const rows = sorted.map((s) => ({ ...s, exams: data.timetable.filter((e) => e.slotId === s.id).length }));

  const fields = [
    { name: 'date', label: 'Examination date', type: 'date', required: true },
    { name: 'session', label: 'Session', type: 'select', options: ['Morning', 'Afternoon', 'Evening'], required: true },
    { name: 'start', label: 'Start time', type: 'time', required: true },
    { name: 'end', label: 'End time', type: 'time', required: true },
    { name: 'available', label: 'Availability', type: 'select', options: [{ value: 'true', label: 'Available' }, { value: 'false', label: 'Unavailable' }], required: true, default: 'true' },
  ];
  const save = (v) => {
    if (v.end <= v.start) return 'End time must be after start time';
    const cand = { ...v, available: v.available === 'true' };
    const clash = data.slots.find((s) => s.id !== form.item?.id && slotsOverlap(s, cand));
    if (clash) return `Overlaps with existing slot ${clash.id} (${clash.start}–${clash.end} on ${clash.date})`;
    if (form.mode === 'add') setData((p) => ({ ...p, slots: [...p.slots, { id: nextId('S', p.slots), ...cand }] }));
    else setData((p) => ({ ...p, slots: p.slots.map((s) => (s.id === form.item.id ? { ...s, ...cand } : s)) }));
    log(`${form.mode === 'add' ? 'Added' : 'Updated'} time slot ${v.date} ${v.start}`); notify(form.mode === 'add' ? 'Time slot added' : 'Time slot updated');
  };
  const remove = () => {
    setData((p) => ({
      ...p, slots: p.slots.filter((s) => s.id !== del.id),
      timetable: p.timetable.filter((e) => e.slotId !== del.id),
      faculty: p.faculty.map((f) => ({ ...f, availability: f.availability.filter((x) => x !== del.id) })),
    }));
    log(`Deleted time slot ${del.id}`); notify('Time slot deleted'); setDel(null);
  };

  // Creates the missing slots for the dates and sessions typed in Exam Setup
  const autoGenerate = () => {
    const plan = data.settings.plan;
    const { created } = buildPlanSlots(data.slots, planDates(plan), plan.sessions);
    if (!created.length) return notify('No new slots needed – the exam dates are already covered', 'info');
    setData((p) => ({ ...p, slots: [...p.slots, ...created], faculty: p.faculty.map((f) => ({ ...f, availability: [...f.availability, ...created.map((s) => s.id)] })) }));
    log(`Created ${created.length} time slots from Exam Setup`); notify(`${created.length} slots created`);
  };

  const columns = [
    { key: 'id', label: 'Slot ID' }, { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
    { key: 'start', label: 'Start' }, { key: 'end', label: 'End' },
    { key: 'session', label: 'Session', render: (r) => <Badge color={r.session === 'Morning' ? 'blue' : 'violet'}>{r.session}</Badge> },
    { key: 'available', label: 'Availability', render: (r) => <Badge color={r.available ? 'green' : 'red'}>{r.available ? 'Available' : 'Unavailable'}</Badge> },
    { key: 'exams', label: 'Exams scheduled' },
  ];
  return (
    <>
      <DataTable
        columns={columns} rows={rows} pageSize={12} searchKeys={['id', 'date']}
        filters={[{ key: 'date', label: 'Date', options: [...new Set(sorted.map((s) => s.date))].map((d) => ({ value: d, label: fmtDate(d) })) }, { key: 'session', label: 'Session', options: ['Morning', 'Afternoon', 'Evening'] }]}
        toolbar={<>
          <button className="btn btn-outline" onClick={autoGenerate}><Wand2 size={16} /> Create slots from Exam Setup</button>
          <button className="btn btn-primary" onClick={() => setForm({ mode: 'add', item: { date: data.settings.plan.startDate, session: 'Morning', start: '09:00', end: '12:00' } })}><Plus size={16} /> Add slot</button>
        </>}
        actions={(r) => (<>
          <IconBtn icon={Pencil} title="Edit" onClick={() => setForm({ mode: 'edit', item: { ...r, available: String(r.available) } })} />
          <IconBtn icon={Trash2} title="Delete" danger onClick={() => setDel(r)} />
        </>)}
      />
      <FormModal open={!!form} onClose={() => setForm(null)} fields={fields} initial={form?.item} formKey={`${form?.mode}-${form?.item?.id}`} title={form?.mode === 'add' ? 'Add time slot' : 'Edit time slot'} onSubmit={save} />
      <ConfirmDialog open={!!del} danger confirmText="Delete" title="Delete time slot" message={`Delete slot ${del?.id}? Exams scheduled in it become unscheduled.`} onConfirm={remove} onCancel={() => setDel(null)} />
    </>
  );
}

/* ====================== B. EXAM SETUP + GENERATE ====================== */
const Step = ({ n, title, hint, children }) => (
  <div className="card p-5">
    <h2 className="text-sm font-semibold text-slate-900"><span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{n}</span>{title}</h2>
    {hint && <p className="mb-3 mt-1 text-xs text-slate-500">{hint}</p>}
    <div className="mt-3">{children}</div>
  </div>
);

function GenerateTab() {
  const { data, setData, notify, log } = useData();
  const prefs = data.settings.preferences;
  const [plan, setPlan] = useState(() => JSON.parse(JSON.stringify(data.settings.plan)));
  const [fYear, setFYear] = useState('All');
  const [fDept, setFDept] = useState('All');
  const [fType, setFType] = useState('All');
  const [holiday, setHoliday] = useState('');
  const [duration, setDur] = useState('');
  const [selRooms, setSelRooms] = useState(() => data.rooms.filter((r) => r.available).map((r) => r.id));
  const [result, setResult] = useState(null);
  const [whatIf, setWhatIf] = useState(null);
  const [confirm, setConfirm] = useState(false);

  const up = (patch) => { setPlan((p) => ({ ...p, ...patch })); setWhatIf(null); };
  const years = [...new Set(data.subjects.map((s) => s.year))].sort();
  const size = useMemo(() => { const m = {}; data.students.forEach((st) => st.subjects.forEach((id) => (m[id] = (m[id] || 0) + 1))); return m; }, [data.students]);
  const shown = data.subjects.filter((s) => (fYear === 'All' || String(s.year) === fYear) && (fDept === 'All' || s.dept === fDept) && (fType === 'All' || s.type === fType));
  const setShown = (on) => {
    const ids = new Set(shown.map((s) => s.id));
    up({ subjectIds: on ? [...new Set([...plan.subjectIds, ...ids])] : plan.subjectIds.filter((id) => !ids.has(id)) });
  };
  const toggleSub = (id) => up({ subjectIds: plan.subjectIds.includes(id) ? plan.subjectIds.filter((x) => x !== id) : [...plan.subjectIds, id] });
  const setSession = (i, k, v) => up({ sessions: plan.sessions.map((s, j) => (j === i ? { ...s, [k]: v } : s)) });

  const dates = useMemo(() => planDates(plan), [plan]);
  const sessErr = (() => {
    const ss = [...plan.sessions].sort((a, b) => a.start.localeCompare(b.start));
    if (!ss.length) return 'Add at least one session per day';
    for (let i = 0; i < ss.length; i++) {
      if (!ss[i].start || !ss[i].end || ss[i].end <= ss[i].start) return 'Every session must end after it starts';
      if (i && ss[i].start < ss[i - 1].end) return 'Sessions on the same day must not overlap';
    }
    return '';
  })();

  // live preview of the maths behind the plan
  const chosen = useMemo(() => data.subjects.filter((s) => plan.subjectIds.includes(s.id)), [data.subjects, plan.subjectIds]);
  const graph = useMemo(() => buildConflictGraph(chosen, data.students), [chosen, data.students]);
  const clique = useMemo(() => maxClique(graph), [graph]);
  const slotCount = dates.length * plan.sessions.length;
  const nComp = chosen.filter((s) => s.type === 'Compulsory').length, nElec = chosen.length - nComp;
  const elecEdges = graph.edges.filter((e) => graph.vertices[e.a].subject.type === 'Elective' && graph.vertices[e.b].subject.type === 'Elective').length;
  const maxRoom = Math.max(0, ...data.rooms.filter((r) => r.available && selRooms.includes(r.id)).map((r) => r.capacity));
  const tooBig = chosen.filter((s) => (size[s.id] || 0) > maxRoom);

  const checkPlan = () => {
    if (!plan.subjectIds.length) return notify('Select at least one exam subject', 'error');
    if (!dates.length) return notify('There are no exam days – check the dates, weekends and holidays', 'error');
    if (sessErr) return notify(sessErr, 'error');
    if (plan.startDate < todayISO()) return notify('Choose a start date that is today or in the future', 'error');
    return { ...plan, sessions: [...plan.sessions].sort((a, b) => a.start.localeCompare(b.start)) };
  };

  const run = () => {
    setConfirm(false);
    const p = checkPlan(); if (!p) return;
    const { res, patch } = planExam(data, { plan: p, roomIds: selRooms, duration });
    setResult(res); setWhatIf(null);
    setData((d) => ({ ...d, ...patch }));          // saves the plan, slots and timetable → every page updates
    if (res.assignments.length > 0) {
      log(`Timetable generated for ${p.subjectIds.length} subjects, ${p.startDate} to ${p.endDate}: ${res.message}`);
      notify(res.status === 'success' ? 'Timetable generated successfully' : 'Timetable generated with unscheduled exams', res.status === 'success' ? 'success' : 'warning');
    } else { log('Timetable generation failed'); notify('Generation failed – see the reasons below', 'error'); }
  };

  // WHAT-IF: re-run the generator with one condition changed (nothing is saved)
  const compare = () => {
    const p = checkPlan(); if (!p) return;
    const ss = p.sessions, ds = planDates(p);
    const on = data.rooms.filter((r) => r.available && selRooms.includes(r.id));
    const biggest = [...on].sort((a, b) => b.capacity - a.capacity)[0];
    const compIds = p.subjectIds.filter((id) => data.subjects.find((s) => s.id === id)?.type === 'Compulsory');
    const list = [['Your plan', 'Exactly the setup above.', {}]];
    if (ss.length > 1) list.push(['One session per day', `Only ${ss[0].start}–${ss[0].end} is used, so there are fewer slots per day.`, { sessions: [ss[0]] }]);
    if (ds.length > 1) list.push(['Half the exam days', 'A shorter exam period gives fewer slots.', { dates: ds.slice(0, Math.ceil(ds.length / 2)) }]);
    if (on.length > 1) list.push([`${biggest.name} (${biggest.capacity} seats) closed`, 'The largest room is not available, so big exams need other rooms.', { roomIds: on.filter((r) => r.id !== biggest.id).map((r) => r.id) }]);
    list.push(['Faculty availability ignored', 'Teacher clashes no longer restrict the timetable.', { prefs: { enforceFaculty: false } }]);
    if (compIds.length && compIds.length < p.subjectIds.length) list.push(['Only compulsory subjects', 'Electives removed: only subjects that every student of a year takes remain.', { subjectIds: compIds }]);
    list.push(['Greedy only (no backtracking)', 'No undo: a wrong early choice cannot be repaired.', { prefs: { useBacktracking: false } }]);
    const rows = list.map(([name, change, over]) => {
      const { res, patch } = planExam(data, { plan: p, roomIds: selRooms, duration, ...over });
      const sm = Object.fromEntries(patch.slots.map((s) => [s.id, s]));
      return {
        name, change, slots: (over.dates || ds).length * (over.sessions || ss).length, used: res.stats.slotsUsed,
        days: new Set(res.assignments.map((a) => sm[a.slotId]?.date)).size, done: res.assignments.length,
        total: (over.subjectIds || p.subjectIds).length, hint: res.suggestions[0] || res.message,
      };
    });
    const b = rows[0];
    rows.forEach((r) => {
      r.why = r.done < r.total ? `Only ${r.done} of ${r.total} exams fit. ${r.hint}`
        : r === b ? `All exams fit using ${r.used} of ${r.slots} slots over ${r.days} day(s).`
        : `All exams fit using ${r.used} slot(s) over ${r.days} day(s) (your plan: ${b.used} slots, ${b.days} days).`;
    });
    setWhatIf(rows);
  };

  const subMap = Object.fromEntries(data.subjects.map((x) => [x.id, x]));
  const roomMap = Object.fromEntries(data.rooms.map((x) => [x.id, x]));
  const slotMap = Object.fromEntries(data.slots.map((x) => [x.id, x]));
  const tone = result?.status === 'success' ? 'green' : result?.status === 'partial' ? 'orange' : 'red';
  const banner = { green: 'border-green-200 bg-green-50 text-green-800', orange: 'border-orange-200 bg-orange-50 text-orange-800', red: 'border-red-200 bg-red-50 text-red-800' }[tone];

  return (
    <div className="space-y-6">
      <Step n={1} title="Which subjects have an exam?" hint="Tick the subjects that are part of this examination. Use the filters (for example Year 2 only) and then “Select shown”.">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select className="input w-auto" value={fYear} onChange={(e) => setFYear(e.target.value)}><option value="All">Year: All</option>{years.map((y) => <option key={y} value={y}>Year {y}</option>)}</select>
          <select className="input w-auto" value={fDept} onChange={(e) => setFDept(e.target.value)}><option value="All">Department: All</option>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select>
          <select className="input w-auto" value={fType} onChange={(e) => setFType(e.target.value)}><option value="All">Type: All</option><option>Compulsory</option><option>Elective</option></select>
          <button className="btn btn-outline btn-sm" onClick={() => setShown(true)}>Select shown</button>
          <button className="btn btn-outline btn-sm" onClick={() => setShown(false)}>Clear shown</button>
          <span className="ml-auto text-sm font-medium text-slate-700">{plan.subjectIds.length} of {data.subjects.length} subjects selected</span>
        </div>
        <div className="grid max-h-64 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((s) => (
            <label key={s.id} className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={plan.subjectIds.includes(s.id)} onChange={() => toggleSub(s.id)} />
              <span className="font-medium">{s.code}</span><span className="truncate text-slate-600">{s.name}</span>
              <Badge color={s.type === 'Compulsory' ? 'blue' : 'orange'}>{s.type === 'Compulsory' ? 'Comp' : 'Elec'}</Badge>
              <span className="ml-auto text-xs text-slate-400">{DEPT_SHORT[s.dept]} · Y{s.year} · {size[s.id] || 0}</span>
            </label>
          ))}
          {!shown.length && <span className="text-xs text-slate-400">No subjects match the filters.</span>}
        </div>
      </Step>

      <Step n={2} title="When can exams be held?" hint="Choose the exam period, remove weekends/holidays, and say how many exam sessions there are in one day.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><label className="label">First exam date</label><input type="date" className="input" min={todayISO()} value={plan.startDate} onChange={(e) => up({ startDate: e.target.value })} /></div>
          <div><label className="label">Last exam date</label><input type="date" className="input" min={plan.startDate || todayISO()} value={plan.endDate} onChange={(e) => up({ endDate: e.target.value })} /></div>
          <div><label className="label">Holiday / date to skip</label>
            <div className="flex gap-2"><input type="date" className="input" value={holiday} onChange={(e) => setHoliday(e.target.value)} />
              <button className="btn btn-outline" onClick={() => { if (holiday && !plan.excludeDates.includes(holiday)) up({ excludeDates: [...plan.excludeDates, holiday].sort() }); setHoliday(''); }}>Add</button></div></div>
          <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={plan.skipWeekends} onChange={(e) => up({ skipWeekends: e.target.checked })} /> Skip Saturday and Sunday</label>
        </div>
        {plan.excludeDates.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{plan.excludeDates.map((d) => (
          <span key={d} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs">{fmtDate(d)}<button onClick={() => up({ excludeDates: plan.excludeDates.filter((x) => x !== d) })}><X size={12} /></button></span>))}</div>}
        <div className="mt-5">
          <span className="label">Time slots in one day</span>
          <div className="space-y-2">
            {plan.sessions.map((s, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-24 font-medium text-slate-700">Session {i + 1}</span>
                <input type="time" className="input w-auto" value={s.start} onChange={(e) => setSession(i, 'start', e.target.value)} /> to
                <input type="time" className="input w-auto" value={s.end} onChange={(e) => setSession(i, 'end', e.target.value)} />
                <button className="btn btn-outline btn-sm text-red-600" onClick={() => up({ sessions: plan.sessions.filter((_, j) => j !== i) })}>Remove</button>
              </div>))}
            <button className="btn btn-outline btn-sm" onClick={() => up({ sessions: [...plan.sessions, { start: '18:00', end: '21:00' }] })}><Plus size={14} /> Add session</button>
          </div>
          {sessErr && <p className="mt-2 text-xs text-red-600">{sessErr}</p>}
        </div>
        <p className="mt-4 text-sm text-slate-700"><b>{dates.length}</b> exam day(s) × <b>{plan.sessions.length}</b> session(s) = <b>{slotCount}</b> time slots available.</p>
      </Step>

      <Step n={3} title="Rooms and options" hint="Each exam gets the smallest free room that fits its students (no 120-seat hall for 20 students).">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="grid max-h-44 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
            {data.rooms.map((r) => (
              <label key={r.id} className={`flex cursor-pointer items-center gap-2 text-sm ${r.available ? '' : 'text-slate-400 line-through'}`}>
                <input type="checkbox" disabled={!r.available} checked={selRooms.includes(r.id)} onChange={() => setSelRooms(selRooms.includes(r.id) ? selRooms.filter((x) => x !== r.id) : [...selRooms, r.id])} /> {r.name} · {r.building} · {r.capacity} seats
              </label>))}
          </div>
          <div>
            <label className="label">Exam duration in hours (leave empty = each subject’s own duration)</label>
            <input type="number" min="1" max="6" className="input max-w-[200px]" value={duration} onChange={(e) => setDur(e.target.value)} />
            <p className="mt-3 text-xs text-slate-500">Strategy: {prefs.strategy === 'dsatur' ? 'DSATUR' : 'Highest degree first'} · Backtracking {prefs.useBacktracking ? 'ON' : 'OFF'} · Faculty check {prefs.enforceFaculty ? 'ON' : 'OFF'} · Minimum room fill {prefs.minOccupancy ?? 40}% (change in Settings)</p>
          </div>
        </div>
      </Step>

      <div className="card border-blue-200 bg-blue-50/50 p-5">
        <h3 className="mb-2 text-sm font-semibold text-blue-700">What the maths says about this plan</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li><b>{nComp}</b> compulsory subjects: every student of the year writes them, so each one clashes with every other subject of that year and needs its own slot.</li>
          <li><b>{nElec}</b> elective subjects: students choose, so two electives clash only if some student chose both – {elecEdges} elective pair(s) clash.</li>
          <li>Conflict graph: <b>{graph.n}</b> subjects, <b>{graph.edges.length}</b> clashes. The biggest group that all clash with each other has <b>{clique.length}</b> subjects, so you need <b>at least {clique.length}</b> time slots. You provided <b>{slotCount}</b> – {slotCount >= clique.length ? <span className="font-semibold text-green-700">enough</span> : <span className="font-semibold text-red-600">not enough, some exams cannot be placed</span>}.</li>
          {tooBig.length > 0 && <li className="text-red-600">{tooBig.map((s) => s.code).join(', ')} have more students than the biggest selected room ({maxRoom} seats).</li>}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" onClick={() => (data.timetable.length ? setConfirm(true) : run())}><Play size={16} /> Generate Timetable</button>
        <button className="btn btn-violet" onClick={compare}><GitCompare size={16} /> Compare what-if conditions</button>
      </div>

      {whatIf && (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">What-if: how the timetable changes when one condition changes (nothing is saved)</div>
          <div className="overflow-x-auto">
            <table className="w-full"><thead><tr><th className="th">Condition</th><th className="th">What changes</th><th className="th">Slots given</th><th className="th">Slots used</th><th className="th">Days used</th><th className="th">Exams placed</th><th className="th">Explanation</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{whatIf.map((r) => (
                <tr key={r.name}><td className="td font-medium">{r.name}</td><td className="td text-xs text-slate-600">{r.change}</td><td className="td">{r.slots}</td><td className="td">{r.used}</td><td className="td">{r.days}</td>
                  <td className="td"><Badge color={r.done === r.total ? 'green' : 'orange'}>{r.done} / {r.total}</Badge></td><td className="td text-xs text-slate-600">{r.why}</td></tr>))}</tbody></table>
          </div>
        </div>
      )}

      {!result && data.lastGeneration && (
        <div className="card p-4 text-sm text-slate-600">Last generation: <b>{data.lastGeneration.status}</b> – {data.lastGeneration.message} <span className="text-slate-400">({new Date(data.lastGeneration.at).toLocaleString()})</span></div>
      )}

      {result && (
        <>
          <div className={`flex items-start gap-3 rounded-xl border p-4 ${banner}`}>
            {result.status === 'success' ? <CheckCircle2 /> : result.status === 'partial' ? <AlertTriangle /> : <XCircle />}
            <div><div className="font-semibold capitalize">{result.status === 'success' ? 'Generation successful' : result.status === 'partial' ? 'Partially scheduled' : 'Generation failed'}</div><div className="text-sm">{result.message}</div></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={CheckCircle2} tone="green" label="Scheduled examinations" value={result.assignments.length} />
            <StatCard icon={XCircle} tone="orange" label="Unscheduled examinations" value={result.unscheduled.length} />
            <StatCard icon={Clock} tone="blue" label="Time slots used" value={result.stats.slotsUsed} sub={`of ${result.stats.slotsAvailable ?? '—'} available`} />
            <StatCard icon={CalendarClock} tone="violet" label="Conflicts detected (graph edges)" value={result.stats.edges} sub={`${result.stats.nodes} placements · ${result.stats.backtracks} undone · ${result.stats.timeMs.toFixed(1)} ms`} />
          </div>

          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">How the timetable was built (step by step)</h3>
            <ol className="space-y-2">{result.pipeline.map((p, i) => <li key={i} className="flex gap-3 text-sm"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{i + 1}</span>{p}</li>)}</ol>
          </div>

          {result.unscheduled.length > 0 && (
            <div className="card border-orange-200 p-5">
              <h3 className="mb-3 text-sm font-semibold text-orange-700">Unscheduled examinations – reasons</h3>
              <ul className="space-y-2 text-sm">{result.unscheduled.map((u) => <li key={u.subjectId}><b>{subMap[u.subjectId]?.code}</b> {subMap[u.subjectId]?.name}: <span className="text-slate-600">{u.reason}</span></li>)}</ul>
            </div>
          )}
          {result.suggestions.length > 0 && (
            <div className="card border-blue-200 bg-blue-50/50 p-5">
              <h3 className="mb-2 text-sm font-semibold text-blue-700">Suggestions</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">{result.suggestions.map((x, i) => <li key={i}>{x}</li>)}</ul>
              <Link to="/scheduling?tab=slots" className="btn btn-primary btn-sm mt-3 inline-flex">Go to Time Slots</Link>
            </div>
          )}

          {result.assignments.length > 0 && (
            <div className="card overflow-hidden">
              <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">Room allocations (students vs seats)</div>
              <div className="max-h-96 overflow-auto">
                <table className="w-full"><thead><tr><th className="th">Subject</th><th className="th">Slot</th><th className="th">Room</th><th className="th">Students</th><th className="th">Seats</th><th className="th">Room filled</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...result.assignments].sort((a, b) => cmpSlots(slotMap[a.slotId] || { date: '', start: '' }, slotMap[b.slotId] || { date: '', start: '' })).map((a) => {
                      const n = size[a.subjectId] || 0, cap = roomMap[a.roomId]?.capacity || 0;
                      return (
                        <tr key={a.subjectId}><td className="td"><b>{subMap[a.subjectId]?.code}</b> · {subMap[a.subjectId]?.name}</td><td className="td">{slotLabel(slotMap[a.slotId])}</td>
                          <td className="td"><Badge color="blue">{roomMap[a.roomId]?.name}</Badge></td><td className="td">{n}</td><td className="td">{cap}</td>
                          <td className="td"><Badge color={cap && n / cap >= 0.5 ? 'green' : 'orange'}>{cap ? Math.round((n / cap) * 100) : 0}%</Badge></td></tr>);
                    })}
                  </tbody></table>
              </div>
            </div>
          )}
        </>
      )}
      <ConfirmDialog open={confirm} title="Regenerate timetable?" confirmText="Generate" message="A timetable already exists. Generating again replaces it with a new one built from this exam setup." onConfirm={run} onCancel={() => setConfirm(false)} />
    </div>
  );
}

export default function Scheduling() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'generate' ? 'generate' : 'slots';
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button className={`btn ${tab === 'slots' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setParams({ tab: 'slots' })}><Clock size={16} /> Time Slots</button>
        <button className={`btn ${tab === 'generate' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setParams({ tab: 'generate' })}><CalendarClock size={16} /> Exam Setup &amp; Generate</button>
      </div>
      {tab === 'slots' ? <SlotsTab /> : <GenerateTab />}
    </div>
  );
}

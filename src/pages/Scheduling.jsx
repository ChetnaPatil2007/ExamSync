import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Clock, CalendarClock, Play, Wand2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import DataTable, { Badge, IconBtn } from '../components/DataTable';
import { FormModal, ConfirmDialog } from '../components/Modal';
import StatCard from '../components/StatCard';
import { useData, DEPARTMENTS, nextId, fmtDate, slotLabel, todayISO, buildRangeSlots, applyExamWindow, rangeTooLong, MAX_DAYS } from '../data/sampleData';
import { slotsOverlap, cmpSlots } from '../algorithms/schedulingAlgorithms';

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

  // Uses the Morning / Afternoon timings and the start / end dates from Settings
  const autoGenerate = () => {
    const { startDate, endDate, morning, afternoon } = data.settings;
    const created = buildRangeSlots(data.slots, startDate, endDate, morning, afternoon);
    if (!created.length) return notify('No new slots needed – the date range is already covered', 'info');
    setData((p) => ({ ...p, slots: [...p.slots, ...created], faculty: p.faculty.map((f) => ({ ...f, availability: [...f.availability, ...created.map((s) => s.id)] })) }));
    log(`Auto-generated ${created.length} time slots from Settings`); notify(`${created.length} slots created`);
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
          <button className="btn btn-outline" onClick={autoGenerate}><Wand2 size={16} /> Auto-generate from Settings</button>
          <button className="btn btn-primary" onClick={() => setForm({ mode: 'add', item: { date: data.settings.startDate, session: 'Morning', start: data.settings.morning.start, end: data.settings.morning.end } })}><Plus size={16} /> Add slot</button>
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

/* ====================== B. GENERATE TIMETABLE ====================== */
function GenerateTab() {
  const { data, setData, notify, log } = useData();
  const s = data.settings;
  const [startDate, setStart] = useState(s.startDate);
  const [endDate, setEnd] = useState(s.endDate);
  const [dept, setDept] = useState('All');
  const [semester, setSem] = useState('All');
  const [duration, setDur] = useState(s.defaultDuration);
  const [selSlots, setSelSlots] = useState([]);
  const [selRooms, setSelRooms] = useState(data.rooms.filter((r) => r.available).map((r) => r.id));
  const [result, setResult] = useState(null);
  const [confirm, setConfirm] = useState(false);

  // Slots missing for the chosen dates are created automatically when you generate; they are previewed here as "new"
  const fresh = useMemo(() => buildRangeSlots(data.slots, startDate, endDate, s.morning, s.afternoon), [data.slots, startDate, endDate, s.morning, s.afternoon]);
  const newIds = useMemo(() => new Set(fresh.map((x) => x.id)), [fresh]);
  const inRange = useMemo(() => [...data.slots.filter((x) => x.date >= startDate && x.date <= endDate), ...fresh].sort(cmpSlots), [data.slots, fresh, startDate, endDate]);
  useEffect(() => { setSelSlots(inRange.filter((x) => x.available).map((x) => x.id)); }, [inRange]);
  const toggle = (arr, set, id) => set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  const run = () => {
    setConfirm(false);
    if (!startDate || !endDate || startDate > endDate) return notify('Start date must be on or before the end date', 'error');
    if (startDate < todayISO()) return notify('Choose a start date that is today or in the future', 'error');
    if (rangeTooLong(startDate, endDate)) return notify(`The date range can be at most ${MAX_DAYS} days`, 'error');
    const { res, patch } = applyExamWindow(data, startDate, endDate, { slotIds: selSlots, roomIds: selRooms, dept, semester, duration });
    setResult(res);
    setData((p) => ({ ...p, ...patch }));   // saves the dates, new slots and timetable → every page updates
    if (res.assignments.length > 0) {
      log(`Timetable generated for ${startDate} to ${endDate}: ${res.message}`);
      notify(res.status === 'success' ? 'Timetable generated successfully' : 'Timetable generated with unscheduled exams', res.status === 'success' ? 'success' : 'warning');
    } else {
      log('Timetable generation failed'); notify('Generation failed – see the reasons below', 'error');
    }
  };
  const subMap = Object.fromEntries(data.subjects.map((x) => [x.id, x]));
  const roomMap = Object.fromEntries(data.rooms.map((x) => [x.id, x]));
  const slotMap = Object.fromEntries(data.slots.map((x) => [x.id, x]));
  const tone = result?.status === 'success' ? 'green' : result?.status === 'partial' ? 'orange' : 'red';
  const banner = { green: 'border-green-200 bg-green-50 text-green-800', orange: 'border-orange-200 bg-orange-50 text-orange-800', red: 'border-red-200 bg-red-50 text-red-800' }[tone];

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Generation settings</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div><label className="label">Start date</label><input type="date" className="input" min={todayISO()} value={startDate} onChange={(e) => setStart(e.target.value)} /></div>
          <div><label className="label">End date</label><input type="date" className="input" min={startDate || todayISO()} value={endDate} onChange={(e) => setEnd(e.target.value)} /></div>
          <div><label className="label">Department</label><select className="input" value={dept} onChange={(e) => setDept(e.target.value)}><option>All</option>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select></div>
          <div><label className="label">Semester</label><select className="input" value={semester} onChange={(e) => setSem(e.target.value)}><option>All</option>{[...new Set(data.subjects.map((x) => x.semester))].sort().map((x) => <option key={x}>{x}</option>)}</select></div>
          <div><label className="label">Exam duration (h)</label><input type="number" min="1" max="6" className="input" value={duration} onChange={(e) => setDur(e.target.value)} /></div>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center justify-between"><span className="label mb-0">Available time slots ({selSlots.length}/{inRange.length})</span>
              <button className="text-xs text-blue-600" onClick={() => setSelSlots(inRange.filter((x) => x.available).map((x) => x.id))}>Select all available</button></div>
            <div className="grid max-h-44 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {inRange.map((x) => (
                <label key={x.id} className={`flex cursor-pointer items-center gap-2 text-sm ${x.available ? '' : 'text-slate-400 line-through'}`}>
                  <input type="checkbox" disabled={!x.available} checked={selSlots.includes(x.id)} onChange={() => toggle(selSlots, setSelSlots, x.id)} /> {x.id} · {slotLabel(x)}{newIds.has(x.id) && <span className="text-xs text-blue-600">(new)</span>}
                </label>
              ))}
              {!inRange.length && <span className="text-xs text-slate-400">No weekdays in this date range.</span>}
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between"><span className="label mb-0">Available rooms ({selRooms.length})</span></div>
            <div className="grid max-h-44 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {data.rooms.map((r) => (
                <label key={r.id} className={`flex cursor-pointer items-center gap-2 text-sm ${r.available ? '' : 'text-slate-400 line-through'}`}>
                  <input type="checkbox" disabled={!r.available} checked={selRooms.includes(r.id)} onChange={() => toggle(selRooms, setSelRooms, r.id)} /> {r.name} · {r.building} · {r.capacity} seats
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button className="btn btn-primary" onClick={() => (data.timetable.length ? setConfirm(true) : run())}><Play size={16} /> Generate Timetable</button>
          <span className="text-xs text-slate-500">Strategy: {s.preferences.strategy === 'dsatur' ? 'DSATUR' : 'Highest degree first'} · Backtracking {s.preferences.useBacktracking ? 'ON' : 'OFF'} · Faculty check {s.preferences.enforceFaculty ? 'ON' : 'OFF'} (change in Settings)</span>
        </div>
      </div>

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
            <StatCard icon={Clock} tone="blue" label="Time slots used" value={result.stats.slotsUsed} />
            <StatCard icon={CalendarClock} tone="violet" label="Conflicts detected (graph edges)" value={result.stats.edges} sub={`${result.stats.nodes} nodes · ${result.stats.backtracks} backtracks · ${result.stats.timeMs.toFixed(1)} ms`} />
          </div>

          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Algorithm pipeline</h3>
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
              <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">Room allocations</div>
              <div className="max-h-96 overflow-auto">
                <table className="w-full"><thead><tr><th className="th">Subject</th><th className="th">Slot</th><th className="th">Room</th><th className="th">Capacity</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...result.assignments].sort((a, b) => cmpSlots(slotMap[a.slotId], slotMap[b.slotId])).map((a) => (
                      <tr key={a.subjectId}><td className="td"><b>{subMap[a.subjectId]?.code}</b> · {subMap[a.subjectId]?.name}</td><td className="td">{slotLabel(slotMap[a.slotId])}</td>
                        <td className="td"><Badge color="blue">{roomMap[a.roomId]?.name}</Badge></td><td className="td">{roomMap[a.roomId]?.capacity}</td></tr>
                    ))}
                  </tbody></table>
              </div>
            </div>
          )}
        </>
      )}
      <ConfirmDialog open={confirm} title="Regenerate timetable?" confirmText="Generate" message="A timetable already exists. Generating again replaces the schedule of the selected subjects." onConfirm={run} onCancel={() => setConfirm(false)} />
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
        <button className={`btn ${tab === 'generate' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setParams({ tab: 'generate' })}><CalendarClock size={16} /> Generate Timetable</button>
      </div>
      {tab === 'slots' ? <SlotsTab /> : <GenerateTab />}
    </div>
  );
}

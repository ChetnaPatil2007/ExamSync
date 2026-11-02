import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ArrowRight, Wand2, ShieldCheck, ShieldAlert } from 'lucide-react';
import StatCard from '../components/StatCard';
import { Badge } from '../components/DataTable';
import { Modal, ConfirmDialog } from '../components/Modal';
import { useData, slotLabel, CONFLICT_TYPES } from '../data/sampleData';
import { validateSchedule, validateEntry, suggestAlternatives, cmpSlots } from '../algorithms/schedulingAlgorithms';

const TYPE_COLOR = { Student: 'red', Room: 'orange', Faculty: 'violet', Capacity: 'orange', Availability: 'blue' };

export default function ConflictResolver() {
  const { data, setData, notify, log } = useData();
  const conflicts = useMemo(() => validateSchedule(data.timetable, data), [data]);
  const subMap = Object.fromEntries(data.subjects.map((s) => [s.id, s]));
  const slotMap = Object.fromEntries(data.slots.map((s) => [s.id, s]));
  const roomMap = Object.fromEntries(data.rooms.map((r) => [r.id, r]));
  const entryOf = (id, tt = data.timetable) => tt.find((e) => e.subjectId === id);
  const unscheduled = data.subjects.filter((s) => !entryOf(s.id));

  const [active, setActive] = useState(null);
  const [moveId, setMoveId] = useState('');
  const [last, setLast] = useState(null);
  const [confirmAuto, setConfirmAuto] = useState(false);
  const [manual, setManual] = useState({ subjectId: '', slotId: '', roomId: '' });
  const [report, setReport] = useState(null);

  const openResolve = (c) => { setActive(c); setMoveId(c.subjectIds[c.subjectIds.length - 1]); };
  const alternatives = useMemo(() => (active && moveId ? suggestAlternatives(moveId, data.timetable, data, 10) : []), [active, moveId, data]);

  const describe = (e) => (e ? `${slotLabel(slotMap[e.slotId])} · ${roomMap[e.roomId]?.name || '—'}` : 'Not scheduled');

  // Validate an alternative BEFORE saving it
  const apply = (subjectId, alt, source = 'resolver') => {
    const others = data.timetable.filter((e) => e.subjectId !== subjectId);
    const entry = { subjectId, slotId: alt.slotId, roomId: alt.roomId };
    const issues = validateEntry(entry, others, data);
    if (issues.length) { notify(`Rejected: ${issues[0].message}`, 'error'); return false; }
    const before = entryOf(subjectId);
    const tt = [...others, entry];
    setData((p) => ({ ...p, timetable: tt }));
    setLast({ subjectId, before, after: entry, conflictsBefore: conflicts.length, conflictsAfter: validateSchedule(tt, data).length });
    log(`Moved ${subMap[subjectId].code} to ${slotMap[alt.slotId]?.date} ${slotMap[alt.slotId]?.start} (${source})`);
    notify(`${subMap[subjectId].code} moved successfully`);
    return true;
  };

  const autoResolve = () => {
    setConfirmAuto(false);
    let tt = [...data.timetable], fixed = 0;
    for (let pass = 0; pass < 40; pass++) {
      const cs = validateSchedule(tt, data);
      if (!cs.length) break;
      const c = cs[0];
      let done = false;
      for (const sid of [...c.subjectIds].reverse()) {
        const alt = suggestAlternatives(sid, tt, data, 1)[0];
        if (alt) { tt = [...tt.filter((e) => e.subjectId !== sid), { subjectId: sid, ...alt }]; fixed++; done = true; break; }
      }
      if (!done) break;
    }
    const remaining = validateSchedule(tt, data).length;
    setData((p) => ({ ...p, timetable: tt }));
    log(`Auto-resolved ${fixed} assignment(s); ${remaining} conflict(s) remain`);
    notify(remaining ? `${fixed} fixed, ${remaining} still need manual attention` : `All conflicts resolved (${fixed} move(s))`, remaining ? 'warning' : 'success');
  };

  // Manual assignment panel
  const runValidate = () => {
    if (!manual.subjectId || !manual.slotId || !manual.roomId) return notify('Choose a subject, slot and room first', 'warning');
    const others = data.timetable.filter((e) => e.subjectId !== manual.subjectId);
    setReport(validateEntry(manual, others, data));
  };
  const saveManual = (force) => {
    const others = data.timetable.filter((e) => e.subjectId !== manual.subjectId);
    const issues = validateEntry(manual, others, data);
    if (issues.length && !force) return notify('Assignment rejected – it violates a constraint', 'error');
    const before = entryOf(manual.subjectId);
    const tt = [...others, { ...manual }];
    setData((p) => ({ ...p, timetable: tt }));
    setLast({ subjectId: manual.subjectId, before, after: { ...manual }, conflictsBefore: conflicts.length, conflictsAfter: validateSchedule(tt, data).length });
    log(`${force ? 'FORCED (demo) ' : ''}Assigned ${subMap[manual.subjectId].code} manually`);
    notify(force ? 'Invalid assignment saved for demonstration' : 'Assignment saved', force ? 'warning' : 'success');
    setReport(null);
  };
  const slotsSorted = [...data.slots].sort(cmpSlots);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard icon={conflicts.length ? AlertTriangle : CheckCircle2} tone={conflicts.length ? 'red' : 'green'} label="Total conflicts" value={conflicts.length} />
        {CONFLICT_TYPES.map((t) => <StatCard key={t} icon={AlertTriangle} tone="slate" label={`${t} conflicts`} value={conflicts.filter((c) => c.type === t).length} />)}
      </div>

      {last && (
        <div className="card border-green-200 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-green-700"><CheckCircle2 size={16} /> Before and after – {subMap[last.subjectId]?.code}</h3>
          <div className="grid items-center gap-3 text-sm md:grid-cols-[1fr_auto_1fr]">
            <div className="rounded-lg bg-red-50 p-3"><div className="label">Before</div>{describe(last.before)}<div className="mt-1 text-xs text-slate-500">{last.conflictsBefore} conflict(s) in timetable</div></div>
            <ArrowRight className="mx-auto text-slate-400" />
            <div className="rounded-lg bg-green-50 p-3"><div className="label">After</div>{describe(last.after)}<div className="mt-1 text-xs text-slate-500">{last.conflictsAfter} conflict(s) in timetable</div></div>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <span className="text-sm font-semibold text-slate-900">Detected conflicts</span>
          <button className="btn btn-violet btn-sm" disabled={!conflicts.length} onClick={() => setConfirmAuto(true)}><Wand2 size={14} /> Auto-resolve all</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th">Type</th><th className="th">Affected subjects</th><th className="th">Current slot / room</th><th className="th">Details</th><th className="th" /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {conflicts.map((c) => (
                <tr key={c.id}>
                  <td className="td"><Badge color={TYPE_COLOR[c.type]}>{c.type}</Badge></td>
                  <td className="td">{c.subjectIds.map((id) => subMap[id]?.code).join(' · ')}</td>
                  <td className="td whitespace-nowrap text-xs">{slotLabel(slotMap[c.slotId])}<br />{roomMap[c.roomId]?.name || '—'}</td>
                  <td className="td text-sm">{c.message}</td>
                  <td className="td text-right"><button className="btn btn-primary btn-sm" onClick={() => openResolve(c)}>Resolve</button></td>
                </tr>
              ))}
              {!conflicts.length && <tr><td colSpan={5} className="td py-10 text-center text-green-700"><CheckCircle2 className="mx-auto mb-2" />No conflicts detected. The timetable satisfies every constraint.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="mb-1 text-sm font-semibold text-slate-900">Manual assignment (validated before saving)</h3>
        <p className="mb-4 text-xs text-slate-500">Move an exam yourself. Invalid placements are rejected. Use “Save anyway” only to create a demo conflict and then resolve it above.</p>
        <div className="grid gap-3 md:grid-cols-4">
          <select className="input" value={manual.subjectId} onChange={(e) => { setManual({ ...manual, subjectId: e.target.value }); setReport(null); }}>
            <option value="">Subject…</option>{data.subjects.map((s) => <option key={s.id} value={s.id}>{s.code} – {s.name}</option>)}
          </select>
          <select className="input" value={manual.slotId} onChange={(e) => { setManual({ ...manual, slotId: e.target.value }); setReport(null); }}>
            <option value="">Time slot…</option>{slotsSorted.map((s) => <option key={s.id} value={s.id}>{slotLabel(s)}{s.available ? '' : ' (unavailable)'}</option>)}
          </select>
          <select className="input" value={manual.roomId} onChange={(e) => { setManual({ ...manual, roomId: e.target.value }); setReport(null); }}>
            <option value="">Room…</option>{data.rooms.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.capacity}){r.available ? '' : ' (unavailable)'}</option>)}
          </select>
          <button className="btn btn-outline" onClick={runValidate}>Validate</button>
        </div>
        {manual.subjectId && <p className="mt-2 text-xs text-slate-500">Current: {describe(entryOf(manual.subjectId))}</p>}
        {report && (
          <div className={`mt-4 rounded-lg border p-3 text-sm ${report.length ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
            {report.length ? (<>
              <div className="mb-1 flex items-center gap-2 font-semibold text-red-700"><ShieldAlert size={16} /> Assignment violates {report.length} constraint(s)</div>
              <ul className="list-disc pl-5 text-red-700">{report.map((r) => <li key={r.id}>[{r.type}] {r.message}</li>)}</ul>
              <button className="btn btn-danger btn-sm mt-3" onClick={() => saveManual(true)}>Save anyway (demo only)</button>
            </>) : (<>
              <div className="flex items-center gap-2 font-semibold text-green-700"><ShieldCheck size={16} /> Valid assignment – no constraint is violated</div>
              <button className="btn btn-success btn-sm mt-3" onClick={() => saveManual(false)}>Save assignment</button>
            </>)}
          </div>
        )}
        {unscheduled.length > 0 && (
          <div className="mt-4 text-sm"><span className="label">Unscheduled subjects (click to select)</span>
            <div className="flex flex-wrap gap-2">{unscheduled.map((s) => <button key={s.id} className="cursor-pointer" onClick={() => { setManual({ ...manual, subjectId: s.id }); setReport(null); }}><Badge color="orange">{s.code}</Badge></button>)}</div>
          </div>
        )}
      </div>

      <Modal open={!!active} onClose={() => setActive(null)} title="Resolve conflict" size="lg">
        {active && (<>
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800"><Badge color={TYPE_COLOR[active.type]}>{active.type}</Badge> <span className="ml-2">{active.message}</span></div>
          <label className="label">Subject to move</label>
          <select className="input mb-4 max-w-sm" value={moveId} onChange={(e) => setMoveId(e.target.value)}>
            {active.subjectIds.map((id) => <option key={id} value={id}>{subMap[id]?.code} – {subMap[id]?.name}</option>)}
          </select>
          <div className="mb-3 text-sm text-slate-600">Current: <b>{describe(entryOf(moveId))}</b></div>
          <div className="mb-2 text-sm font-semibold text-slate-900">Valid alternatives (every constraint re-checked)</div>
          {alternatives.length ? (
            <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
              <table className="w-full"><tbody className="divide-y divide-slate-100">
                {alternatives.map((a) => (
                  <tr key={a.slotId + a.roomId}><td className="td">{slotLabel(slotMap[a.slotId])}</td><td className="td"><Badge color="blue">{roomMap[a.roomId]?.name}</Badge> <span className="text-xs text-slate-400">{roomMap[a.roomId]?.capacity} seats</span></td>
                    <td className="td text-right"><button className="btn btn-success btn-sm" onClick={() => apply(moveId, a) && setActive(null)}>Apply</button></td></tr>
                ))}</tbody></table>
            </div>
          ) : <div className="rounded-lg bg-orange-50 p-3 text-sm text-orange-800">No valid alternative exists for this subject. Add more time slots or rooms, or update faculty availability.</div>}
        </>)}
      </Modal>
      <ConfirmDialog open={confirmAuto} title="Auto-resolve conflicts" confirmText="Resolve" message="Each conflicting exam is moved to its first fully valid alternative. Continue?" onConfirm={autoResolve} onCancel={() => setConfirmAuto(false)} />
    </div>
  );
}

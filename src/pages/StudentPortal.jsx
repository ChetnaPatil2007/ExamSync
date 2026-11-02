import { useMemo, useState } from 'react';
import { Table2, CalendarDays, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Badge } from '../components/DataTable';
import { useData, buildTimetableRows, fmtDate, todayISO, DEPT_SHORT } from '../data/sampleData';

export default function StudentPortal() {
  const { data } = useData();
  const [q, setQ] = useState('');
  const [id, setId] = useState('');
  const [view, setView] = useState('table');
  const today = todayISO();

  const options = data.students.filter((s) => `${s.roll} ${s.name}`.toLowerCase().includes(q.toLowerCase()));
  const student = data.students.find((s) => s.id === id);
  const all = useMemo(() => buildTimetableRows(data), [data]);
  // Only the exams of the student's enrolled subjects
  const mine = student ? all.filter((r) => student.subjects.includes(r.subjectId)) : [];
  const notScheduled = student ? data.subjects.filter((s) => student.subjects.includes(s.id) && !all.some((r) => r.subjectId === s.id)) : [];
  const nextExam = mine.find((r) => r.date >= today);
  const clash = mine.some((a, i) => mine.some((b, j) => j > i && a.date === b.date && a.start < b.end && b.start < a.end));

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-end gap-4 p-5">
        <div className="min-w-[220px] flex-1"><label className="label">Search student</label><input className="input" placeholder="Name or roll number…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="min-w-[260px] flex-1"><label className="label">Select student ({options.length})</label>
          <select className="input" value={id} onChange={(e) => setId(e.target.value)}><option value="">Choose a roll number…</option>{options.map((s) => <option key={s.id} value={s.id}>{s.roll} – {s.name}</option>)}</select></div>
      </div>

      {!student ? <div className="card p-10 text-center text-slate-400">Select a student to view their personal examination timetable.</div> : (
        <>
          <div className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <div><span className="label">Name</span><div className="text-lg font-semibold text-slate-900">{student.name}</div></div>
            <div><span className="label">Roll number</span>{student.roll}</div>
            <div><span className="label">Department</span>{student.dept}</div>
            <div><span className="label">Semester / Division</span>{student.semester} / {student.division}</div>
            <div className="sm:col-span-2 lg:col-span-3"><span className="label">Enrolled subjects</span>
              <div className="flex flex-wrap gap-1.5">{student.subjects.map((sid) => { const s = data.subjects.find((x) => x.id === sid); return s && <Badge key={sid} color="blue">{s.code} – {s.name}</Badge>; })}</div></div>
            <div className="flex items-end">{clash ? <Badge color="red"><AlertTriangle size={12} className="mr-1" /> Personal clash detected</Badge> : <Badge color="green"><ShieldCheck size={12} className="mr-1" /> No clashes for this student</Badge>}</div>
          </div>

          {nextExam && <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><b>Next exam:</b> {nextExam.code} · {nextExam.name} on {fmtDate(nextExam.date)}, {nextExam.start}–{nextExam.end}, room {nextExam.roomName}</div>}
          {notScheduled.length > 0 && <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">Not scheduled yet: {notScheduled.map((s) => s.code).join(', ')}</div>}

          <div className="flex gap-2">
            <button className={`btn ${view === 'table' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('table')}><Table2 size={16} /> Table</button>
            <button className={`btn ${view === 'calendar' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('calendar')}><CalendarDays size={16} /> Calendar</button>
          </div>

          {view === 'table' ? (
            <div className="card overflow-x-auto">
              <table className="w-full"><thead><tr>{['Date', 'Time', 'Subject', 'Room', 'Status'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {mine.map((r) => (
                    <tr key={r.key} className={r === nextExam ? 'bg-blue-50/60' : ''}>
                      <td className="td whitespace-nowrap">{fmtDate(r.date)}</td><td className="td whitespace-nowrap">{r.start}–{r.end}</td>
                      <td className="td"><b>{r.code}</b> · {r.name}</td><td className="td"><Badge color="blue">{r.roomName}</Badge> <span className="text-xs text-slate-400">{r.building}</span></td>
                      <td className="td">{r.date >= today ? <Badge color="green">Upcoming</Badge> : <Badge color="slate">Completed</Badge>}</td>
                    </tr>
                  ))}
                  {!mine.length && <tr><td colSpan={5} className="td py-8 text-center text-slate-400">No scheduled examinations for this student.</td></tr>}
                </tbody></table>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {mine.map((r) => (
                <div key={r.key} className={`card overflow-hidden ${r === nextExam ? 'ring-2 ring-blue-500' : ''}`}>
                  <div className="bg-slate-900 px-4 py-2 text-sm font-semibold text-white">{fmtDate(r.date)}</div>
                  <div className="space-y-1 p-4 text-sm"><div className="font-semibold text-slate-900">{r.code} · {r.name}</div><div className="text-slate-500">{r.start}–{r.end} · {DEPT_SHORT[r.dept]}</div><Badge color="blue">{r.roomName} · {r.building}</Badge></div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

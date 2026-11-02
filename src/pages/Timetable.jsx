import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Printer, FileDown, Table2, CalendarDays, Search, ArrowUpDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Badge } from '../components/DataTable';
import { useData, buildTimetableRows, fmtDate, DEPARTMENTS, DEPT_SHORT } from '../data/sampleData';

export default function Timetable() {
  const { data, notify } = useData();
  const rows = useMemo(() => buildTimetableRows(data), [data]);
  const [view, setView] = useState('table');
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [sem, setSem] = useState('');
  const [date, setDate] = useState('');
  const [room, setRoom] = useState('');
  const [asc, setAsc] = useState(true);

  const filtered = rows
    .filter((r) => (!q || `${r.code} ${r.name}`.toLowerCase().includes(q.toLowerCase())) && (!dept || r.dept === dept) && (!sem || String(r.semester) === sem) && (!date || r.date === date) && (!room || r.roomId === room))
    .sort((a, b) => (asc ? 1 : -1) * (a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.code.localeCompare(b.code)));
  const dates = [...new Set(rows.map((r) => r.date))];
  const unscheduled = data.subjects.length - rows.length;

  const exportPdf = () => {
    if (!filtered.length) return notify('Nothing to export – generate a timetable first', 'warning');
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16); doc.text(`${data.settings.university.name} - Examination Timetable`, 14, 16);
    doc.setFontSize(10); doc.text(`${data.settings.university.session}   |   Generated ${new Date().toLocaleString()}`, 14, 23);
    autoTable(doc, {
      startY: 29,
      head: [['Date', 'Time', 'Code', 'Subject', 'Dept', 'Sem', 'Room', 'Faculty']],
      body: filtered.map((r) => [fmtDate(r.date), `${r.start}-${r.end}`, r.code, r.name, DEPT_SHORT[r.dept] || r.dept, r.semester, `${r.roomName} (${r.building})`, r.faculty]),
      headStyles: { fillColor: [37, 99, 235] }, styles: { fontSize: 9 }, alternateRowStyles: { fillColor: [245, 247, 250] },
    });
    doc.save('ExamSync_Timetable.pdf');
    notify('PDF exported');
  };

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3 p-4 print:hidden">
        <div className="relative min-w-[200px] flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className="input pl-9" placeholder="Search subject or code…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="input w-auto" value={dept} onChange={(e) => setDept(e.target.value)}><option value="">Department: All</option>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select>
        <select className="input w-auto" value={sem} onChange={(e) => setSem(e.target.value)}><option value="">Semester: All</option>{[...new Set(data.subjects.map((s) => s.semester))].sort().map((s) => <option key={s}>{s}</option>)}</select>
        <select className="input w-auto" value={date} onChange={(e) => setDate(e.target.value)}><option value="">Date: All</option>{dates.map((d) => <option key={d} value={d}>{fmtDate(d)}</option>)}</select>
        <select className="input w-auto" value={room} onChange={(e) => setRoom(e.target.value)}><option value="">Room: All</option>{data.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        <button className="btn btn-outline" onClick={() => setAsc(!asc)}><ArrowUpDown size={15} /> {asc ? 'Earliest first' : 'Latest first'}</button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex gap-2">
          <button className={`btn ${view === 'table' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('table')}><Table2 size={16} /> Table view</button>
          <button className={`btn ${view === 'calendar' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('calendar')}><CalendarDays size={16} /> Calendar view</button>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline" onClick={() => window.print()}><Printer size={16} /> Print</button>
          <button className="btn btn-violet" onClick={exportPdf}><FileDown size={16} /> Export PDF</button>
        </div>
      </div>

      <div className="hidden print:block"><h1 className="text-xl font-bold">{data.settings.university.name} – Examination Timetable</h1><p className="text-sm">{data.settings.university.session}</p></div>

      {unscheduled > 0 && <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm text-orange-800 print:hidden">{unscheduled} subject(s) are not scheduled yet. <Link className="font-semibold underline" to="/scheduling?tab=generate">Generate</Link> or <Link className="font-semibold underline" to="/conflict-resolver">assign manually</Link>.</div>}

      {view === 'table' ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr>{['Date', 'Time', 'Code', 'Subject', 'Dept', 'Sem', 'Room', 'Faculty / Invigilator'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.key} className="hover:bg-slate-50/70">
                    <td className="td whitespace-nowrap">{fmtDate(r.date)}</td><td className="td whitespace-nowrap">{r.start}–{r.end}</td>
                    <td className="td font-semibold">{r.code}</td><td className="td">{r.name}</td><td className="td">{DEPT_SHORT[r.dept] || r.dept}</td><td className="td">{r.semester}</td>
                    <td className="td"><Badge color="blue">{r.roomName}</Badge> <span className="text-xs text-slate-400">{r.building}</span></td><td className="td">{r.faculty}</td>
                  </tr>
                ))}
                {!filtered.length && <tr><td colSpan={8} className="td py-10 text-center text-slate-400">No examinations match. Generate a timetable or adjust the filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...new Set(filtered.map((r) => r.date))].map((d) => (
            <div key={d} className="card overflow-hidden">
              <div className="bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">{fmtDate(d)}</div>
              <div className="space-y-2 p-3">
                {filtered.filter((r) => r.date === d).map((r) => (
                  <div key={r.key} className={`rounded-lg border-l-4 bg-slate-50 p-3 ${r.session === 'Morning' ? 'border-blue-500' : 'border-violet-500'}`}>
                    <div className="flex items-center justify-between text-xs text-slate-500"><span>{r.start}–{r.end}</span><Badge color="blue">{r.roomName}</Badge></div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">{r.code} · {r.name}</div>
                    <div className="text-xs text-slate-500">{DEPT_SHORT[r.dept]} · Sem {r.semester} · {r.faculty}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!filtered.length && <div className="card p-10 text-center text-slate-400 md:col-span-2 xl:col-span-3">No examinations to display.</div>}
        </div>
      )}
    </div>
  );
}

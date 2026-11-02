import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Users, BookOpen, GraduationCap, Building2, CheckCircle2, Clock, AlertTriangle, CalendarClock, Network, CalendarDays, FlaskConical, UserPlus } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import StatCard from '../components/StatCard';
import { Badge } from '../components/DataTable';
import { useData, computeStats, buildTimetableRows, fmtDate, todayISO, CHART_COLORS } from '../data/sampleData';

export default function Dashboard() {
  const { data } = useData();
  const stats = useMemo(() => computeStats(data), [data]);
  const rows = useMemo(() => buildTimetableRows(data), [data]);
  const today = todayISO();
  const upcoming = rows.filter((r) => r.date >= today);
  const list = (upcoming.length ? upcoming : rows).slice(0, 6);
  const pie = [{ name: 'Scheduled', value: stats.scheduled }, { name: 'Unscheduled', value: stats.unscheduled }];

  const quick = [
    { to: '/scheduling?tab=generate', label: 'Generate Timetable', icon: CalendarClock, cls: 'btn-primary' },
    { to: '/conflict-graph', label: 'Conflict Graph', icon: Network, cls: 'btn-violet' },
    { to: '/conflict-resolver', label: 'Resolve Conflicts', icon: AlertTriangle, cls: 'btn-outline' },
    { to: '/management?tab=students', label: 'Add Student', icon: UserPlus, cls: 'btn-outline' },
    { to: '/timetable', label: 'View Timetable', icon: CalendarDays, cls: 'btn-outline' },
    { to: '/playground', label: 'Algorithm Playground', icon: FlaskConical, cls: 'btn-outline' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Total students" value={data.students.length} tone="blue" />
        <StatCard icon={BookOpen} label="Total subjects" value={data.subjects.length} tone="violet" />
        <StatCard icon={GraduationCap} label="Faculty members" value={data.faculty.length} tone="blue" />
        <StatCard icon={Building2} label="Examination rooms" value={data.rooms.length} tone="violet" sub={`${data.rooms.filter((r) => r.available).length} available`} />
        <StatCard icon={CheckCircle2} label="Scheduled examinations" value={stats.scheduled} tone="green" />
        <StatCard icon={Clock} label="Unscheduled examinations" value={stats.unscheduled} tone="orange" />
        <StatCard icon={AlertTriangle} label="Detected conflicts" value={stats.conflicts.length} tone={stats.conflicts.length ? 'red' : 'green'} sub={stats.conflicts.length ? 'Open the Conflict Resolver' : 'Timetable is conflict-free'} />
        <StatCard icon={Network} label="Time slots used" value={`${stats.slotsUsed} / ${data.slots.filter((s) => s.available).length}`} tone="slate" />
      </div>

      <div className="card p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Quick actions</h2>
        <div className="flex flex-wrap gap-2">
          {quick.map((q) => <Link key={q.to} to={q.to} className={`btn ${q.cls}`}><q.icon size={16} /> {q.label}</Link>)}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card overflow-hidden lg:col-span-2">
          <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">Upcoming examinations</div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className="th">Date</th><th className="th">Time</th><th className="th">Subject</th><th className="th">Room</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((r) => (
                  <tr key={r.key}>
                    <td className="td">{fmtDate(r.date)}</td>
                    <td className="td">{r.start}–{r.end}</td>
                    <td className="td"><span className="font-medium">{r.code}</span> · {r.name}</td>
                    <td className="td"><Badge color="blue">{r.roomName}</Badge></td>
                  </tr>
                ))}
                {!list.length && <tr><td className="td py-8 text-center text-slate-400" colSpan={4}>No timetable yet. Generate one from Scheduling.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Scheduled vs unscheduled</h2>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  <Cell fill="#16a34a" /><Cell fill="#f97316" />
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Department-wise examinations</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.deptDist}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Legend />
                <Bar dataKey="scheduled" stackId="a" fill="#2563eb" name="Scheduled" />
                <Bar dataKey="unscheduled" stackId="a" fill="#f97316" name="Unscheduled" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Room utilization (%)</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.roomUtil}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis unit="%" /><Tooltip />
                <Bar dataKey="utilization" fill="#7c3aed" name="Utilization" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Time-slot utilization</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.slotUtil}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-30} textAnchor="end" height={50} /><YAxis allowDecimals={false} /><Tooltip />
                <Bar dataKey="exams" name="Exams" radius={[4, 4, 0, 0]}>
                  {stats.slotUtil.map((s, i) => <Cell key={s.id} fill={s.available ? CHART_COLORS[0] : '#cbd5e1'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Recent activities</h2>
        <ul className="divide-y divide-slate-100">
          {data.activities.slice(0, 8).map((a) => (
            <li key={a.id} className="flex items-center justify-between py-2 text-sm">
              <span>{a.text}</span><span className="text-xs text-slate-400">{new Date(a.time).toLocaleString()}</span>
            </li>
          ))}
          {!data.activities.length && <li className="py-2 text-sm text-slate-400">No activity yet.</li>}
        </ul>
      </div>
    </div>
  );
}

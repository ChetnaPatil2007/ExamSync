import { useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { BookOpen, CheckCircle2, Clock, AlertTriangle, Layers, Building2 } from 'lucide-react';
import StatCard from '../components/StatCard';
import { useData, computeStats, CHART_COLORS, examSubjects } from '../data/sampleData';

const Box = ({ title, children }) => (
  <div className="card p-4"><h2 className="mb-2 text-sm font-semibold text-slate-900">{title}</h2><div className="h-64">{children}</div></div>
);

export default function Analytics() {
  const { data } = useData();
  const s = useMemo(() => computeStats(data), [data]);
  const avgUtil = s.roomUtil.length ? Math.round(s.roomUtil.reduce((a, r) => a + r.utilization, 0) / s.roomUtil.length) : 0;
  const pie = [{ name: 'Scheduled', value: s.scheduled }, { name: 'Unscheduled', value: s.unscheduled }];
  const conflictData = s.conflictTypes.filter((c) => c.value > 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard icon={BookOpen} tone="blue" label="Total examinations" value={examSubjects(data).length} />
        <StatCard icon={CheckCircle2} tone="green" label="Scheduled" value={s.scheduled} />
        <StatCard icon={Clock} tone="orange" label="Unscheduled" value={s.unscheduled} />
        <StatCard icon={AlertTriangle} tone={s.conflicts.length ? 'red' : 'green'} label="Total conflicts" value={s.conflicts.length} />
        <StatCard icon={Layers} tone="violet" label="Slots used" value={s.slotsUsed} />
        <StatCard icon={Building2} tone="blue" label="Avg room utilization" value={`${avgUtil}%`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Box title="1. Scheduled vs unscheduled examinations">
          <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pie} dataKey="value" nameKey="name" outerRadius={90} label><Cell fill="#16a34a" /><Cell fill="#f97316" /></Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>
        </Box>
        <Box title="2. Department-wise distribution">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={s.deptDist}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Legend />
            <Bar dataKey="scheduled" stackId="a" fill="#2563eb" name="Scheduled" /><Bar dataKey="unscheduled" stackId="a" fill="#f97316" name="Unscheduled" /></BarChart></ResponsiveContainer>
        </Box>
        <Box title="3. Room utilization (% of available slots)">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={s.roomUtil}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis unit="%" /><Tooltip /><Bar dataKey="utilization" fill="#7c3aed" name="Utilization" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        </Box>
        <Box title="4. Time-slot utilization (exams per slot)">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={s.slotUtil}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-30} textAnchor="end" height={50} /><YAxis allowDecimals={false} /><Tooltip />
            <Bar dataKey="exams" name="Exams" radius={[4, 4, 0, 0]}>{s.slotUtil.map((x) => <Cell key={x.id} fill={x.available ? CHART_COLORS[0] : '#cbd5e1'} />)}</Bar></BarChart></ResponsiveContainer>
        </Box>
        <div className="card p-4 lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">5. Conflict type distribution</h2>
          <div className="h-64">
            {conflictData.length ? (
              <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={conflictData} dataKey="value" nameKey="name" outerRadius={90} label>{conflictData.map((c, i) => <Cell key={c.name} fill={CHART_COLORS[(i + 4) % 10]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>
            ) : <div className="flex h-full items-center justify-center text-sm text-green-700">No conflicts – nothing to chart.</div>}
          </div>
        </div>
      </div>
      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">Room utilization report</div>
        <table className="w-full"><thead><tr><th className="th">Room</th><th className="th">Exams</th><th className="th">Utilization</th><th className="th">Status</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{s.roomUtil.map((r) => (
            <tr key={r.name}><td className="td font-medium">{r.name}</td><td className="td">{r.exams}</td>
              <td className="td"><div className="h-2 w-40 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-violet-600" style={{ width: `${Math.min(100, r.utilization)}%` }} /></div> <span className="text-xs text-slate-500">{r.utilization}%</span></td>
              <td className="td">{r.available ? 'Available' : 'Unavailable'}</td></tr>))}</tbody></table>
      </div>
    </div>
  );
}

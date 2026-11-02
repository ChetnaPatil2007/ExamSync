import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, BookOpen, GraduationCap, Building2, Clock, CalendarClock, Network,
  AlertTriangle, CalendarDays, BarChart3, UserCircle, Sigma, FlaskConical, Settings as SettingsIcon, X,
} from 'lucide-react';

export const NAV = [
  { section: 'Overview' },
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { section: 'Data Management' },
  { to: '/management?tab=students', label: 'Students', icon: Users, isDefault: true },
  { to: '/management?tab=subjects', label: 'Subjects', icon: BookOpen },
  { to: '/management?tab=faculty', label: 'Faculty', icon: GraduationCap },
  { to: '/management?tab=rooms', label: 'Rooms & Venues', icon: Building2 },
  { section: 'Scheduling' },
  { to: '/scheduling?tab=slots', label: 'Time Slots', icon: Clock, isDefault: true },
  { to: '/scheduling?tab=generate', label: 'Exam Setup & Generate', icon: CalendarClock },
  { section: 'Conflicts' },
  { to: '/conflict-graph', label: 'Conflict Graph', icon: Network },
  { to: '/conflict-resolver', label: 'Conflict Resolver', icon: AlertTriangle },
  { section: 'Timetables' },
  { to: '/timetable', label: 'View Timetable', icon: CalendarDays },
  { to: '/student-portal', label: 'Student Portal', icon: UserCircle },
  { section: 'Insights' },
  { to: '/analytics', label: 'Analytics & Reports', icon: BarChart3 },
  { to: '/math', label: 'Mathematical Concepts', icon: Sigma },
  { to: '/playground', label: 'Algorithm Playground', icon: FlaskConical },
  { section: 'System' },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export function isNavActive(item, pathname, search) {
  if (!item.to) return false;
  const [p, q] = item.to.split('?');
  if (pathname !== p) return false;
  if (!q) return true;
  const tab = new URLSearchParams(search).get('tab');
  const want = new URLSearchParams(q).get('tab');
  return tab ? tab === want : !!item.isDefault;
}

export default function Sidebar({ open, onClose }) {
  const { pathname, search } = useLocation();
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden print:hidden" onClick={onClose} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-900 text-slate-300 transition-transform print:hidden ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-5">
          <Link to="/" className="flex items-center gap-2.5" onClick={onClose}>
            <img src="/logo.png" alt="" className="h-8 w-8" />
            <div>
              <div className="text-base font-bold leading-none text-white">ExamSync</div>
              <div className="mt-1 text-[10px] uppercase tracking-wider text-slate-400">Exam Scheduler</div>
            </div>
          </Link>
          <button className="lg:hidden" onClick={onClose}><X size={18} /></button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {NAV.map((item, i) =>
            item.section ? (
              <div key={i} className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{item.section}</div>
            ) : (
              <Link
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${isNavActive(item, pathname, search) ? 'bg-blue-600 text-white shadow' : 'hover:bg-slate-800 hover:text-white'}`}
              >
                <item.icon size={17} />
                {item.label}
              </Link>
            )
          )}
        </nav>
        <div className="border-t border-slate-800 p-4 text-xs text-slate-500">Discrete Mathematics Project</div>
      </aside>
    </>
  );
}

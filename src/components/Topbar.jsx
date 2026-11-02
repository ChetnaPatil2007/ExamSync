import { Link, useLocation } from 'react-router-dom';
import { Menu, CalendarClock } from 'lucide-react';
import { NAV, isNavActive } from './Sidebar';
import { useData } from '../data/sampleData';

export default function Topbar({ onMenu }) {
  const { pathname, search } = useLocation();
  const { data } = useData();
  const current = NAV.find((n) => isNavActive(n, pathname, search));
  const profile = data.settings.profile;
  const initials = profile.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6 print:hidden">
      <div className="flex items-center gap-3">
        <button className="rounded-lg p-2 hover:bg-slate-100 lg:hidden" onClick={onMenu} aria-label="Open menu"><Menu size={20} /></button>
        <div>
          <h1 className="text-base font-semibold text-slate-900">{current?.label || 'ExamSync'}</h1>
          <p className="hidden text-xs text-slate-500 sm:block">{data.settings.university.name} · {data.settings.university.session}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Link to="/scheduling?tab=generate" className="btn btn-primary btn-sm hidden sm:inline-flex"><CalendarClock size={14} /> Generate</Link>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">{initials}</div>
          <div className="hidden text-right md:block">
            <div className="text-sm font-medium leading-none text-slate-800">{profile.name}</div>
            <div className="mt-1 text-xs text-slate-500">{profile.role}</div>
          </div>
        </div>
      </div>
    </header>
  );
}

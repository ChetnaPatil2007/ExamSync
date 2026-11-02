import { useState } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { ConfirmDialog } from '../components/Modal';
import { useData } from '../data/sampleData';

const Section = ({ title, hint, children }) => (
  <div className="card p-5"><h2 className="text-sm font-semibold text-slate-900">{title}</h2>{hint && <p className="mb-4 mt-0.5 text-xs text-slate-500">{hint}</p>}<div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div></div>
);
const Field = ({ label, children }) => <div><label className="label">{label}</label>{children}</div>;

export default function Settings() {
  const { data, setData, notify, log, resetData } = useData();
  const [s, setS] = useState(() => JSON.parse(JSON.stringify(data.settings)));
  const [confirm, setConfirm] = useState(false);
  const up = (path, value) => setS((prev) => {
    const next = JSON.parse(JSON.stringify(prev));
    let o = next; const keys = path.split('.');
    keys.slice(0, -1).forEach((k) => (o = o[k]));
    o[keys[keys.length - 1]] = value;
    return next;
  });
  const inp = (path, type = 'text', extra = {}) => {
    const v = path.split('.').reduce((o, k) => o[k], s);
    return <input className="input" type={type} value={v} {...extra} onChange={(e) => up(path, type === 'number' ? Number(e.target.value) : e.target.value)} />;
  };

  const save = () => {
    if (s.defaultDuration < 1) return notify('Default duration must be at least 1 hour', 'error');
    if (s.preferences.minOccupancy < 0 || s.preferences.minOccupancy > 100) return notify('Minimum room fill must be between 0 and 100', 'error');
    if (!s.university.name.trim() || !s.profile.name.trim()) return notify('University name and profile name are required', 'error');
    setData((p) => ({ ...p, settings: { ...s, plan: p.settings.plan } }));   // the exam plan is edited in Scheduling → Exam Setup
    log('Settings updated'); notify('Settings saved');
  };

  return (
    <div className="space-y-6">
      <Section title="University details"><Field label="University name">{inp('university.name')}</Field><Field label="Address">{inp('university.address')}</Field><Field label="Examination session">{inp('university.session')}</Field></Section>
      <Section title="Examination defaults" hint="Exam dates, subjects and time slots are chosen in Scheduling → Exam Setup & Generate.">
        <Field label="Default exam duration (hours)">{inp('defaultDuration', 'number', { min: 1, max: 6 })}</Field>
      </Section>
      <Section title="Scheduling preferences" hint="These change the real algorithm used by Generate Timetable.">
        <Field label="Vertex selection strategy">
          <select className="input" value={s.preferences.strategy} onChange={(e) => up('preferences.strategy', e.target.value)}>
            <option value="dsatur">DSATUR (saturation degree)</option><option value="degree">Highest degree first</option>
          </select></Field>
        <Field label="Slot preference">
          <select className="input" value={s.preferences.slotOrder} onChange={(e) => up('preferences.slotOrder', e.target.value)}>
            <option value="compact">Compact (earliest slots first)</option><option value="spread">Spread (least-used slot first)</option>
          </select></Field>
        <Field label="Minimum room fill (%) – avoids huge rooms for few students">{inp('preferences.minOccupancy', 'number', { min: 0, max: 100, step: 5 })}</Field>
        <Field label="Backtracking search limit (nodes)">{inp('preferences.maxNodes', 'number', { min: 100, step: 1000 })}</Field>
        <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={s.preferences.useBacktracking} onChange={(e) => up('preferences.useBacktracking', e.target.checked)} /> Use recursive backtracking when greedy assignment gets stuck</label>
        <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={s.preferences.enforceFaculty} onChange={(e) => up('preferences.enforceFaculty', e.target.checked)} /> Enforce faculty availability and double-booking rules</label>
      </Section>
      <Section title="Profile"><Field label="Name">{inp('profile.name')}</Field><Field label="Email">{inp('profile.email', 'email')}</Field><Field label="Role">{inp('profile.role')}</Field></Section>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" onClick={save}><Save size={16} /> Save settings</button>
        <button className="btn btn-outline text-red-600" onClick={() => setConfirm(true)}><RotateCcw size={16} /> Reset sample data</button>
      </div>
      <ConfirmDialog open={confirm} danger confirmText="Reset everything" title="Reset sample data" message="This permanently discards all your changes and restores the original dataset, settings and timetable."
        onConfirm={() => { resetData(); setConfirm(false); setTimeout(() => window.location.reload(), 300); }} onCancel={() => setConfirm(false)} />
    </div>
  );
}

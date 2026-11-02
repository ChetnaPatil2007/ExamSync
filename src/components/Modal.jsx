import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export function Modal({ open, title, onClose, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  const w = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 print:hidden" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`card flex max-h-[90vh] w-full flex-col ${w}`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="cursor-pointer rounded-md p-1 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title = 'Please confirm', message, confirmText = 'Confirm', danger, onConfirm, onCancel }) {
  return (
    <Modal
      open={open} title={title} onClose={onCancel} size="sm"
      footer={<>
        <button className="btn btn-outline" onClick={onCancel}>Cancel</button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{confirmText}</button>
      </>}
    >
      <p className="text-sm text-slate-600">{message}</p>
    </Modal>
  );
}

const norm = (o) => (typeof o === 'object' ? o : { value: o, label: String(o) });

function MultiSelect({ options, value = [], onChange }) {
  const [q, setQ] = useState('');
  const shown = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));
  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div className="rounded-lg border border-slate-300">
      <div className="flex gap-2 border-b border-slate-200 p-2">
        <input className="input" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="btn btn-outline btn-sm" onClick={() => onChange([...new Set([...value, ...shown.map((o) => o.value)])])}>All</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => onChange(value.filter((v) => !shown.some((o) => o.value === v)))}>None</button>
      </div>
      <div className="grid max-h-48 gap-1 overflow-y-auto p-2">
        {shown.map((o) => (
          <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={value.includes(o.value)} onChange={() => toggle(o.value)} /> {o.label}
          </label>
        ))}
        {shown.length === 0 && <span className="text-xs text-slate-400">No options</span>}
      </div>
      <div className="border-t border-slate-200 px-2 py-1 text-xs text-slate-500">{value.length} selected</div>
    </div>
  );
}

/**
 * fields: [{ name, label, type: text|number|email|date|time|select|multiselect, options, required, default, min, max, full }]
 * onSubmit(values) -> return an error string to keep the dialog open, or nothing to close it.
 */
export function FormModal({ open, title, fields, initial, formKey, onSubmit, onClose, submitText = 'Save', size = 'md' }) {
  const [values, setValues] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const base = {};
    fields.forEach((f) => { base[f.name] = initial?.[f.name] ?? f.default ?? (f.type === 'multiselect' ? [] : ''); });
    setValues(base);
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, formKey]);

  const set = (n, v) => setValues((p) => ({ ...p, [n]: v }));

  const submit = (e) => {
    e.preventDefault();
    for (const f of fields) {
      const v = values[f.name];
      const empty = v === '' || v === undefined || v === null || (Array.isArray(v) && !v.length);
      if (f.required && empty) return setError(`${f.label} is required`);
      if (f.type === 'number' && v !== '') {
        if (Number.isNaN(Number(v))) return setError(`${f.label} must be a number`);
        if (f.min !== undefined && Number(v) < f.min) return setError(`${f.label} must be at least ${f.min}`);
        if (f.max !== undefined && Number(v) > f.max) return setError(`${f.label} must be at most ${f.max}`);
      }
    }
    const out = { ...values };
    fields.forEach((f) => {
      if (f.type === 'number') out[f.name] = Number(out[f.name]);
      else if (typeof out[f.name] === 'string') out[f.name] = out[f.name].trim();
    });
    const err = onSubmit(out);
    if (err) setError(err);
    else onClose();
  };

  return (
    <Modal open={open} title={title} onClose={onClose} size={size}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.name} className={f.full || f.type === 'multiselect' ? 'sm:col-span-2' : ''}>
            <label className="label">{f.label}{f.required && <span className="text-red-500"> *</span>}</label>
            {f.type === 'select' ? (
              <select className="input" value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)}>
                {!f.required || values[f.name] === '' ? <option value="">{f.placeholder || 'Select…'}</option> : null}
                {f.options.map(norm).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : f.type === 'multiselect' ? (
              <MultiSelect options={f.options} value={values[f.name] || []} onChange={(v) => set(f.name, v)} />
            ) : (
              <input
                className="input" type={f.type || 'text'} min={f.min} max={f.max} placeholder={f.placeholder}
                value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)}
              />
            )}
          </div>
        ))}
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</div>}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">{submitText}</button>
        </div>
      </form>
    </Modal>
  );
}

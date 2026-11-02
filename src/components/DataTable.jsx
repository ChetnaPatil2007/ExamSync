import { useState } from 'react';
import { Search } from 'lucide-react';

const BADGE = {
  green: 'bg-green-100 text-green-700',
  red: 'bg-red-100 text-red-700',
  orange: 'bg-orange-100 text-orange-700',
  blue: 'bg-blue-100 text-blue-700',
  violet: 'bg-violet-100 text-violet-700',
  slate: 'bg-slate-100 text-slate-600',
};
export function Badge({ color = 'slate', children }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE[color]}`}>{children}</span>;
}

export function IconBtn({ icon: Icon, title, onClick, danger }) {
  return (
    <button
      type="button" title={title} aria-label={title} onClick={onClick}
      className={`cursor-pointer rounded-md p-1.5 transition ${danger ? 'text-red-500 hover:bg-red-50' : 'text-slate-500 hover:bg-slate-100 hover:text-blue-600'}`}
    >
      <Icon size={16} />
    </button>
  );
}

const norm = (o) => (typeof o === 'object' ? o : { value: String(o), label: String(o) });

/**
 * columns : [{ key, label, render?(row) }]
 * filters : [{ key, label, options: [value | {value,label}], get?(row) }]
 */
export default function DataTable({
  columns, rows, searchKeys = [], filters = [], actions, toolbar, pageSize = 10,
  rowKey = 'id', empty = 'No records found', searchPlaceholder = 'Search…',
}) {
  const [q, setQ] = useState('');
  const [fv, setFv] = useState({});
  const [page, setPage] = useState(1);

  const filtered = rows.filter((r) => {
    if (q && !searchKeys.some((k) => String(typeof k === 'function' ? k(r) : r[k] ?? '').toLowerCase().includes(q.toLowerCase()))) return false;
    return filters.every((f) => !fv[f.key] || String(f.get ? f.get(r) : r[f.key]) === fv[f.key]);
  });
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const cur = Math.min(page, pages);
  const shown = filtered.slice((cur - 1) * pageSize, cur * pageSize);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
        {searchKeys.length > 0 && (
          <div className="relative min-w-[200px] flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder={searchPlaceholder} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
        )}
        {filters.map((f) => (
          <select key={f.key} className="input w-auto" value={fv[f.key] || ''} onChange={(e) => { setFv({ ...fv, [f.key]: e.target.value }); setPage(1); }}>
            <option value="">{f.label}: All</option>
            {f.options.map(norm).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ))}
        {toolbar && <div className="ml-auto flex items-center gap-2">{toolbar}</div>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              {columns.map((c) => <th key={c.key} className="th">{c.label}</th>)}
              {actions && <th className="th text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map((r) => (
              <tr key={r[rowKey]} className="hover:bg-slate-50/70">
                {columns.map((c) => <td key={c.key} className="td">{c.render ? c.render(r) : r[c.key]}</td>)}
                {actions && <td className="td"><div className="flex justify-end gap-0.5">{actions(r)}</div></td>}
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td className="td py-10 text-center text-slate-400" colSpan={columns.length + (actions ? 1 : 0)}>{empty}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
        <span>{filtered.length} record(s)</span>
        <div className="flex items-center gap-2">
          <button className="btn btn-outline btn-sm" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>Prev</button>
          <span>Page {cur} / {pages}</span>
          <button className="btn btn-outline btn-sm" disabled={cur >= pages} onClick={() => setPage(cur + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}

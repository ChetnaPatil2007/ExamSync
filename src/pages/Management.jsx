import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Eye, Users, BookOpen, GraduationCap, Building2, Clock, BookPlus } from 'lucide-react';
import DataTable, { Badge, IconBtn } from '../components/DataTable';
import { FormModal, Modal, ConfirmDialog } from '../components/Modal';
import { useData, DEPARTMENTS, DEPT_SHORT, nextId, fmtDate } from '../data/sampleData';

const deptOpts = DEPARTMENTS.map((d) => ({ value: d, label: d }));
const AddBtn = ({ onClick, children }) => <button className="btn btn-primary" onClick={onClick}><Plus size={16} /> {children}</button>;

/* ====================== A. STUDENTS ====================== */
function StudentsTab() {
  const { data, setData, notify, log } = useData();
  const [form, setForm] = useState(null);
  const [del, setDel] = useState(null);
  const subMap = Object.fromEntries(data.subjects.map((s) => [s.id, s]));
  const subjectField = { name: 'subjects', label: 'Enrolled subjects', type: 'multiselect', options: data.subjects.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` })) };
  const fields = form?.mode === 'assign' ? [subjectField] : [
    { name: 'roll', label: 'Roll number', required: true },
    { name: 'name', label: 'Student name', required: true },
    { name: 'dept', label: 'Department', type: 'select', options: deptOpts, required: true },
    { name: 'semester', label: 'Semester', type: 'number', min: 1, max: 8, required: true, default: 3 },
    { name: 'division', label: 'Division', type: 'select', options: ['A', 'B', 'C', 'D'], required: true },
    subjectField,
  ];

  const save = (v) => {
    if (form.mode !== 'assign' && data.students.some((s) => s.roll.toLowerCase() === v.roll.toLowerCase() && s.id !== form.item?.id)) return 'This roll number already exists';
    if (form.mode === 'add') {
      setData((p) => ({ ...p, students: [...p.students, { id: nextId('STU', p.students, 3), ...v }] }));
      log(`Added student ${v.name} (${v.roll})`); notify('Student added');
    } else {
      setData((p) => ({ ...p, students: p.students.map((s) => (s.id === form.item.id ? { ...s, ...v } : s)) }));
      log(`Updated student ${form.item.name}`); notify(form.mode === 'assign' ? 'Subjects assigned' : 'Student updated');
    }
  };
  const remove = () => {
    setData((p) => ({ ...p, students: p.students.filter((s) => s.id !== del.id) }));
    log(`Deleted student ${del.name}`); notify('Student deleted'); setDel(null);
  };

  const columns = [
    { key: 'roll', label: 'Roll No.' }, { key: 'name', label: 'Name' },
    { key: 'dept', label: 'Dept', render: (r) => DEPT_SHORT[r.dept] || r.dept },
    { key: 'semester', label: 'Sem' }, { key: 'division', label: 'Div' },
    { key: 'subjects', label: 'Subjects', render: (r) => <div className="flex flex-wrap gap-1">{r.subjects.map((id) => subMap[id] && <Badge key={id} color="blue">{subMap[id].code}</Badge>)}</div> },
  ];
  return (
    <>
      <DataTable
        columns={columns} rows={data.students} searchKeys={['name', 'roll']} searchPlaceholder="Search by name or roll number…"
        filters={[
          { key: 'dept', label: 'Department', options: DEPARTMENTS },
          { key: 'semester', label: 'Semester', options: [...new Set(data.students.map((s) => s.semester))].sort() },
          { key: 'division', label: 'Division', options: [...new Set(data.students.map((s) => s.division))].sort() },
        ]}
        toolbar={<AddBtn onClick={() => setForm({ mode: 'add' })}>Add student</AddBtn>}
        actions={(r) => (<>
          <IconBtn icon={BookPlus} title="Assign subjects" onClick={() => setForm({ mode: 'assign', item: r })} />
          <IconBtn icon={Pencil} title="Edit" onClick={() => setForm({ mode: 'edit', item: r })} />
          <IconBtn icon={Trash2} title="Delete" danger onClick={() => setDel(r)} />
        </>)}
      />
      <FormModal
        open={!!form} onClose={() => setForm(null)} fields={fields} initial={form?.item} formKey={`${form?.mode}-${form?.item?.id}`}
        title={form?.mode === 'add' ? 'Add student' : form?.mode === 'assign' ? `Assign subjects – ${form?.item?.name}` : 'Edit student'} onSubmit={save}
      />
      <ConfirmDialog open={!!del} danger confirmText="Delete" title="Delete student" message={`Delete ${del?.name} (${del?.roll})? This also removes the student from every subject.`} onConfirm={remove} onCancel={() => setDel(null)} />
    </>
  );
}

/* ====================== B. SUBJECTS ====================== */
function SubjectsTab() {
  const { data, setData, notify, log } = useData();
  const [form, setForm] = useState(null);
  const [del, setDel] = useState(null);
  const [view, setView] = useState(null);
  const facMap = Object.fromEntries(data.faculty.map((f) => [f.id, f]));
  const count = (id) => data.students.filter((s) => s.subjects.includes(id)).length;
  const rows = data.subjects.map((s) => ({ ...s, enrolledCount: count(s.id), facultyName: facMap[s.facultyId]?.name || '—' }));

  const fields = [
    { name: 'code', label: 'Subject code', required: true },
    { name: 'name', label: 'Subject name', required: true },
    { name: 'dept', label: 'Department', type: 'select', options: deptOpts, required: true },
    { name: 'semester', label: 'Semester', type: 'number', min: 1, max: 8, required: true, default: 3 },
    { name: 'facultyId', label: 'Assigned faculty', type: 'select', options: data.faculty.map((f) => ({ value: f.id, label: f.name })), placeholder: '— None —' },
    { name: 'duration', label: 'Exam duration (hours)', type: 'number', min: 1, max: 6, required: true, default: data.settings.defaultDuration },
    { name: 'enrolled', label: 'Enrolled students', type: 'multiselect', options: data.students.map((s) => ({ value: s.id, label: `${s.roll} — ${s.name}` })) },
  ];

  const save = (v) => {
    if (data.subjects.some((s) => s.code.toLowerCase() === v.code.toLowerCase() && s.id !== form.item?.id)) return 'This subject code already exists';
    const { enrolled, ...rest } = v;
    const id = form.mode === 'add' ? nextId('SUB', data.subjects) : form.item.id;
    setData((p) => ({
      ...p,
      subjects: form.mode === 'add' ? [...p.subjects, { id, ...rest }] : p.subjects.map((s) => (s.id === id ? { ...s, ...rest } : s)),
      students: p.students.map((st) => {
        const has = st.subjects.includes(id), want = enrolled.includes(st.id);
        if (has === want) return st;
        return { ...st, subjects: want ? [...st.subjects, id] : st.subjects.filter((x) => x !== id) };
      }),
    }));
    log(`${form.mode === 'add' ? 'Added' : 'Updated'} subject ${v.code}`); notify(form.mode === 'add' ? 'Subject added' : 'Subject updated');
  };
  const remove = () => {
    setData((p) => ({
      ...p,
      subjects: p.subjects.filter((s) => s.id !== del.id),
      students: p.students.map((st) => ({ ...st, subjects: st.subjects.filter((x) => x !== del.id) })),
      timetable: p.timetable.filter((e) => e.subjectId !== del.id),
    }));
    log(`Deleted subject ${del.code}`); notify('Subject deleted'); setDel(null);
  };

  const columns = [
    { key: 'code', label: 'Code', render: (r) => <span className="font-semibold">{r.code}</span> },
    { key: 'id', label: 'ID' }, { key: 'name', label: 'Subject' },
    { key: 'dept', label: 'Dept', render: (r) => DEPT_SHORT[r.dept] || r.dept }, { key: 'semester', label: 'Sem' },
    { key: 'facultyName', label: 'Faculty' },
    { key: 'enrolledCount', label: 'Students', render: (r) => <Badge color="violet">{r.enrolledCount}</Badge> },
    { key: 'duration', label: 'Duration', render: (r) => `${r.duration} h` },
  ];
  const viewStudents = view ? data.students.filter((s) => s.subjects.includes(view.id)) : [];
  return (
    <>
      <DataTable
        columns={columns} rows={rows} searchKeys={['name', 'code']} searchPlaceholder="Search by code or name…"
        filters={[{ key: 'dept', label: 'Department', options: DEPARTMENTS }, { key: 'semester', label: 'Semester', options: [...new Set(data.subjects.map((s) => s.semester))].sort() }]}
        toolbar={<AddBtn onClick={() => setForm({ mode: 'add' })}>Add subject</AddBtn>}
        actions={(r) => (<>
          <IconBtn icon={Eye} title="View details & students" onClick={() => setView(r)} />
          <IconBtn icon={Pencil} title="Edit" onClick={() => setForm({ mode: 'edit', item: { ...r, enrolled: data.students.filter((s) => s.subjects.includes(r.id)).map((s) => s.id) } })} />
          <IconBtn icon={Trash2} title="Delete" danger onClick={() => setDel(r)} />
        </>)}
      />
      <FormModal open={!!form} onClose={() => setForm(null)} fields={fields} initial={form?.item} formKey={`${form?.mode}-${form?.item?.id}`} title={form?.mode === 'add' ? 'Add subject' : 'Edit subject'} onSubmit={save} />
      <ConfirmDialog open={!!del} danger confirmText="Delete" title="Delete subject" message={`Delete ${del?.code} – ${del?.name}? Its enrolments and timetable entry will be removed.`} onConfirm={remove} onCancel={() => setDel(null)} />
      <Modal open={!!view} onClose={() => setView(null)} title={view ? `${view.code} – ${view.name}` : ''} size="lg">
        {view && (<>
          <div className="mb-4 grid gap-2 text-sm sm:grid-cols-3">
            <div><span className="label">Department</span>{view.dept}</div><div><span className="label">Semester</span>{view.semester}</div>
            <div><span className="label">Faculty</span>{view.facultyName}</div><div><span className="label">Duration</span>{view.duration} hours</div>
            <div><span className="label">Subject ID</span>{view.id}</div><div><span className="label">Enrolled</span>{viewStudents.length} students</div>
          </div>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
            <table className="w-full"><thead><tr><th className="th">Roll</th><th className="th">Name</th><th className="th">Dept</th><th className="th">Sem</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{viewStudents.map((s) => <tr key={s.id}><td className="td">{s.roll}</td><td className="td">{s.name}</td><td className="td">{DEPT_SHORT[s.dept]}</td><td className="td">{s.semester}</td></tr>)}</tbody></table>
          </div>
        </>)}
      </Modal>
    </>
  );
}

/* ====================== C. FACULTY ====================== */
function FacultyTab() {
  const { data, setData, notify, log } = useData();
  const [form, setForm] = useState(null);
  const [del, setDel] = useState(null);
  const [view, setView] = useState(null);
  const assigned = (id) => data.subjects.filter((s) => s.facultyId === id);
  const rows = data.faculty.map((f) => ({ ...f, subjectCodes: assigned(f.id).map((s) => s.code).join(', ') || '—' }));
  const slotOpts = [...data.slots].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
    .map((s) => ({ value: s.id, label: `${fmtDate(s.date)} · ${s.session}${s.available ? '' : ' (slot unavailable)'}` }));

  const fields = form?.mode === 'availability' ? [{ name: 'availability', label: 'Available examination slots', type: 'multiselect', options: slotOpts }] : [
    { name: 'name', label: 'Faculty name', required: true },
    { name: 'dept', label: 'Department', type: 'select', options: deptOpts, required: true },
    { name: 'email', label: 'Email', type: 'email', required: true, full: true },
    { name: 'subjects', label: 'Assigned subjects', type: 'multiselect', options: data.subjects.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` })) },
  ];
  const save = (v) => {
    if (form.mode === 'availability') {
      setData((p) => ({ ...p, faculty: p.faculty.map((f) => (f.id === form.item.id ? { ...f, availability: v.availability } : f)) }));
      log(`Updated availability of ${form.item.name}`); notify('Availability saved'); return;
    }
    const id = form.mode === 'add' ? nextId('F', data.faculty) : form.item.id;
    const { subjects, ...rest } = v;
    setData((p) => ({
      ...p,
      faculty: form.mode === 'add' ? [...p.faculty, { id, ...rest, availability: p.slots.map((s) => s.id) }] : p.faculty.map((f) => (f.id === id ? { ...f, ...rest } : f)),
      subjects: p.subjects.map((s) => (subjects.includes(s.id) ? { ...s, facultyId: id } : s.facultyId === id ? { ...s, facultyId: '' } : s)),
    }));
    log(`${form.mode === 'add' ? 'Added' : 'Updated'} faculty ${v.name}`); notify(form.mode === 'add' ? 'Faculty added' : 'Faculty updated');
  };
  const remove = () => {
    setData((p) => ({ ...p, faculty: p.faculty.filter((f) => f.id !== del.id), subjects: p.subjects.map((s) => (s.facultyId === del.id ? { ...s, facultyId: '' } : s)) }));
    log(`Deleted faculty ${del.name}`); notify('Faculty deleted'); setDel(null);
  };
  const columns = [
    { key: 'id', label: 'ID' }, { key: 'name', label: 'Name' }, { key: 'dept', label: 'Dept', render: (r) => DEPT_SHORT[r.dept] || r.dept },
    { key: 'email', label: 'Email' }, { key: 'subjectCodes', label: 'Subjects' },
    { key: 'availability', label: 'Available slots', render: (r) => <Badge color={r.availability.length < data.slots.length ? 'orange' : 'green'}>{r.availability.length} / {data.slots.length}</Badge> },
  ];
  return (
    <>
      <DataTable
        columns={columns} rows={rows} searchKeys={['name', 'email', 'subjectCodes']} filters={[{ key: 'dept', label: 'Department', options: DEPARTMENTS }]}
        toolbar={<AddBtn onClick={() => setForm({ mode: 'add' })}>Add faculty</AddBtn>}
        actions={(r) => (<>
          <IconBtn icon={Eye} title="View assigned subjects" onClick={() => setView(r)} />
          <IconBtn icon={Clock} title="Set availability" onClick={() => setForm({ mode: 'availability', item: r })} />
          <IconBtn icon={Pencil} title="Edit" onClick={() => setForm({ mode: 'edit', item: { ...r, subjects: assigned(r.id).map((s) => s.id) } })} />
          <IconBtn icon={Trash2} title="Delete" danger onClick={() => setDel(r)} />
        </>)}
      />
      <FormModal open={!!form} onClose={() => setForm(null)} fields={fields} initial={form?.item} formKey={`${form?.mode}-${form?.item?.id}`}
        title={form?.mode === 'add' ? 'Add faculty' : form?.mode === 'availability' ? `Availability – ${form?.item?.name}` : 'Edit faculty'} onSubmit={save} />
      <ConfirmDialog open={!!del} danger confirmText="Delete" title="Delete faculty" message={`Delete ${del?.name}? Their subjects will become unassigned.`} onConfirm={remove} onCancel={() => setDel(null)} />
      <Modal open={!!view} onClose={() => setView(null)} title={view ? `Subjects – ${view.name}` : ''}>
        {view && (assigned(view.id).length
          ? <ul className="space-y-2">{assigned(view.id).map((s) => <li key={s.id} className="flex justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"><span><b>{s.code}</b> · {s.name}</span><Badge color="violet">Sem {s.semester}</Badge></li>)}</ul>
          : <p className="text-sm text-slate-500">No subjects assigned.</p>)}
      </Modal>
    </>
  );
}

/* ====================== D. ROOMS ====================== */
function RoomsTab() {
  const { data, setData, notify, log } = useData();
  const [form, setForm] = useState(null);
  const [del, setDel] = useState(null);
  const [checkId, setCheckId] = useState('');
  const subj = data.subjects.find((s) => s.id === checkId);
  const size = subj ? data.students.filter((s) => s.subjects.includes(subj.id)).length : 0;
  const fields = [
    { name: 'name', label: 'Room name', required: true }, { name: 'building', label: 'Building', required: true },
    { name: 'capacity', label: 'Capacity (seats)', type: 'number', min: 1, required: true, default: 60 },
    { name: 'type', label: 'Room type', type: 'select', options: ['Lecture Hall', 'Classroom', 'Laboratory', 'Seminar Hall'], required: true },
    { name: 'available', label: 'Availability', type: 'select', options: [{ value: 'true', label: 'Available' }, { value: 'false', label: 'Unavailable' }], required: true, default: 'true' },
  ];
  const save = (v) => {
    if (data.rooms.some((r) => r.name.toLowerCase() === v.name.toLowerCase() && r.id !== form.item?.id)) return 'A room with this name already exists';
    const room = { ...v, available: v.available === 'true' };
    if (form.mode === 'add') setData((p) => ({ ...p, rooms: [...p.rooms, { id: nextId('R', p.rooms), ...room }] }));
    else setData((p) => ({ ...p, rooms: p.rooms.map((r) => (r.id === form.item.id ? { ...r, ...room } : r)) }));
    log(`${form.mode === 'add' ? 'Added' : 'Updated'} room ${v.name}`); notify(form.mode === 'add' ? 'Room added' : 'Room updated');
  };
  const toggle = (r) => { setData((p) => ({ ...p, rooms: p.rooms.map((x) => (x.id === r.id ? { ...x, available: !x.available } : x)) })); notify(`${r.name} is now ${r.available ? 'unavailable' : 'available'}`, 'info'); };
  const remove = () => {
    setData((p) => ({ ...p, rooms: p.rooms.filter((r) => r.id !== del.id), timetable: p.timetable.filter((e) => e.roomId !== del.id) }));
    log(`Deleted room ${del.name}`); notify('Room deleted'); setDel(null);
  };
  const columns = [
    { key: 'id', label: 'ID' }, { key: 'name', label: 'Room' }, { key: 'building', label: 'Building' },
    { key: 'capacity', label: 'Capacity' }, { key: 'type', label: 'Type' },
    { key: 'available', label: 'Status', render: (r) => <button onClick={() => toggle(r)} title="Click to toggle"><Badge color={r.available ? 'green' : 'red'}>{r.available ? 'Available' : 'Unavailable'}</Badge></button> },
  ];
  return (
    <>
      <div className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        <span className="text-sm font-semibold text-slate-900">Capacity check</span>
        <select className="input w-auto min-w-[240px]" value={checkId} onChange={(e) => setCheckId(e.target.value)}>
          <option value="">Select a subject…</option>
          {data.subjects.map((s) => <option key={s.id} value={s.id}>{s.code} – {s.name}</option>)}
        </select>
        {subj && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>{size} students →</span>
            {data.rooms.map((r) => <Badge key={r.id} color={r.capacity >= size && r.available ? 'green' : 'red'}>{r.name} ({r.capacity}){!r.available ? ' – unavailable' : r.capacity < size ? ' – too small' : ' ✓'}</Badge>)}
          </div>
        )}
      </div>
      <DataTable
        columns={columns} rows={data.rooms} searchKeys={['name', 'building']}
        filters={[{ key: 'type', label: 'Type', options: ['Lecture Hall', 'Classroom', 'Laboratory', 'Seminar Hall'] }, { key: 'building', label: 'Building', options: [...new Set(data.rooms.map((r) => r.building))] }, { key: 'available', label: 'Status', options: [{ value: 'true', label: 'Available' }, { value: 'false', label: 'Unavailable' }] }]}
        toolbar={<AddBtn onClick={() => setForm({ mode: 'add' })}>Add room</AddBtn>}
        actions={(r) => (<>
          <IconBtn icon={Pencil} title="Edit" onClick={() => setForm({ mode: 'edit', item: { ...r, available: String(r.available) } })} />
          <IconBtn icon={Trash2} title="Delete" danger onClick={() => setDel(r)} />
        </>)}
      />
      <FormModal open={!!form} onClose={() => setForm(null)} fields={fields} initial={form?.item} formKey={`${form?.mode}-${form?.item?.id}`} title={form?.mode === 'add' ? 'Add room' : 'Edit room'} onSubmit={save} />
      <ConfirmDialog open={!!del} danger confirmText="Delete" title="Delete room" message={`Delete room ${del?.name}? Exams booked in it become unscheduled.`} onConfirm={remove} onCancel={() => setDel(null)} />
    </>
  );
}

/* ====================== PAGE ====================== */
const TABS = [
  { key: 'students', label: 'Students', icon: Users, C: StudentsTab },
  { key: 'subjects', label: 'Subjects', icon: BookOpen, C: SubjectsTab },
  { key: 'faculty', label: 'Faculty', icon: GraduationCap, C: FacultyTab },
  { key: 'rooms', label: 'Rooms & Venues', icon: Building2, C: RoomsTab },
];

export default function Management() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.key === params.get('tab')) || TABS[0];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setParams({ tab: t.key })} className={`btn ${tab.key === t.key ? 'btn-primary' : 'btn-outline'}`}><t.icon size={16} /> {t.label}</button>
        ))}
      </div>
      <tab.C />
    </div>
  );
}

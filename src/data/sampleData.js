// ============================================================
//  sampleData.js – sample dataset, LocalStorage, shared context & selectors
// ============================================================
import { createContext, useContext } from 'react';
import { generateSchedule, validateSchedule, cmpSlots, slotsOverlap } from '../algorithms/schedulingAlgorithms';

export const STORAGE_KEY = 'examsync-data-v1';
export const DEPARTMENTS = ['Computer Science', 'Information Technology', 'Electronics', 'Mechanical Engineering'];
export const DEPT_SHORT = { 'Computer Science': 'CS', 'Information Technology': 'IT', Electronics: 'EC', 'Mechanical Engineering': 'ME' };
export const CHART_COLORS = ['#2563eb', '#7c3aed', '#16a34a', '#f97316', '#dc2626', '#0891b2', '#db2777', '#ca8a04', '#4f46e5', '#0d9488'];
export const CONFLICT_TYPES = ['Student', 'Room', 'Faculty', 'Capacity', 'Availability'];
export const MAX_DAYS = 366;   // longest examination window the app will create slots for

// ---------- shared context (provider lives in App.jsx) ----------
export const DataContext = createContext(null);
export const useData = () => useContext(DataContext);

// ---------- small helpers ----------
const pad = (n, l = 2) => String(n).padStart(l, '0');
export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => isoDate(new Date());
export const fmtDate = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
export const slotLabel = (s) => (s ? `${fmtDate(s.date)} · ${s.start}–${s.end}` : '—');
export function nextId(prefix, list, width = 2) {
  const max = list.reduce((m, x) => {
    const n = parseInt(String(x.id).replace(/\D/g, ''), 10);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return prefix + pad(max + 1, width);
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function nextWorkdays(count, offsetDays = 7) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const out = [];
  while (out.length < count) {
    if (d.getDay() !== 0 && d.getDay() !== 6) out.push(isoDate(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

// ---------- examination window (user-chosen dates) ----------
export const rangeTooLong = (start, end) => (new Date(end + 'T00:00:00') - new Date(start + 'T00:00:00')) / 864e5 > MAX_DAYS;

/** Morning + Afternoon slots (weekdays only) for every day of the range that is not covered yet. */
export function buildRangeSlots(existing, startDate, endDate, morning, afternoon) {
  if (!startDate || !endDate || startDate > endDate || rangeTooLong(startDate, endDate)) return [];
  const created = [];
  let all = [...existing];
  for (let d = new Date(startDate + 'T00:00:00'); isoDate(d) <= endDate; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    [['Morning', morning], ['Afternoon', afternoon]].forEach(([session, t]) => {
      const cand = { date: isoDate(d), start: t.start, end: t.end, session, available: true };
      if (all.some((s) => slotsOverlap(s, cand))) return;
      const slot = { id: nextId('S', all), ...cand };
      all = [...all, slot]; created.push(slot);
    });
  }
  return created;
}

/**
 * Moves the whole examination window to [startDate, endDate]:
 *  1. creates the missing slots for those dates (and makes every faculty member available in them),
 *  2. generates the timetable,
 *  3. saves the dates in Settings,
 *  4. when ALL subjects were scheduled, removes older slots outside the window that nothing uses.
 * Returns { res, patch, created } – apply with setData((p) => ({ ...p, ...patch })).
 */
export function applyExamWindow(data, startDate, endDate, opts = {}) {
  const { slotIds, roomIds, dept = 'All', semester = 'All', duration } = opts;
  const st = data.settings;
  const created = buildRangeSlots(data.slots, startDate, endDate, st.morning, st.afternoon);
  const createdIds = created.map((x) => x.id);
  const base = {
    ...data,
    slots: [...data.slots, ...created],
    faculty: data.faculty.map((f) => ({ ...f, availability: [...f.availability, ...createdIds] })),
  };
  const res = generateSchedule(base, { startDate, endDate, slotIds, roomIds, dept, semester, duration });
  let patch = { slots: base.slots, faculty: base.faculty, settings: { ...st, startDate, endDate } };
  if (res.assignments.length > 0) {
    let { slots, faculty } = base;
    if (dept === 'All' && semester === 'All') {
      const used = new Set(res.timetable.map((e) => e.slotId));
      const keep = (x) => (x.date >= startDate && x.date <= endDate) || used.has(x.id);
      const dropped = new Set(slots.filter((x) => !keep(x)).map((x) => x.id));
      slots = slots.filter(keep);
      faculty = faculty.map((f) => ({ ...f, availability: f.availability.filter((id) => !dropped.has(id)) }));
    }
    patch = { ...patch, slots, faculty, timetable: res.timetable, lastGeneration: summariseGeneration(res) };
  }
  return { res, patch, created };
}

// ---------- sample dataset ----------
// [code, name, dept index, semester, faculty, duration(h)]
const SUBJECTS = [
  ['CS301', 'Data Structures', 0, 3, 'F01', 3], ['CS302', 'Discrete Mathematics', 0, 3, 'F01', 3],
  ['CS303', 'Computer Organization', 0, 3, 'F02', 3], ['CS304', 'Database Systems', 0, 5, 'F02', 3],
  ['CS305', 'Operating Systems', 0, 5, 'F03', 3],
  ['IT301', 'Web Technologies', 1, 3, 'F04', 3], ['IT302', 'Computer Networks', 1, 3, 'F04', 3],
  ['IT303', 'Software Engineering', 1, 3, 'F05', 3], ['IT304', 'Information Security', 1, 5, 'F05', 3],
  ['IT305', 'Cloud Computing', 1, 5, 'F06', 2],
  ['EC301', 'Digital Electronics', 2, 3, 'F07', 3], ['EC302', 'Signals & Systems', 2, 3, 'F07', 3],
  ['EC303', 'Analog Circuits', 2, 3, 'F07', 3], ['EC304', 'Microprocessors', 2, 5, 'F08', 3],
  ['EC305', 'Communication Systems', 2, 5, 'F08', 2],
  ['ME301', 'Thermodynamics', 3, 3, 'F09', 3], ['ME302', 'Fluid Mechanics', 3, 3, 'F09', 3],
  ['ME303', 'Machine Design', 3, 3, 'F10', 3], ['ME304', 'Manufacturing Processes', 3, 5, 'F10', 3],
  ['ME305', 'Engineering Mechanics', 3, 5, 'F10', 3],
];
const FACULTY = [
  ['F01', 'Dr. Anita Deshmukh', 0], ['F02', 'Prof. Rahul Kulkarni', 0], ['F03', 'Dr. Meera Joshi', 0],
  ['F04', 'Prof. Sanjay Patil', 1], ['F05', 'Dr. Neha Iyer', 1], ['F06', 'Prof. Vikram Nair', 1],
  ['F07', 'Dr. Suresh Reddy', 2], ['F08', 'Prof. Kavita Mehta', 2],
  ['F09', 'Dr. Arvind Bhosale', 3], ['F10', 'Prof. Pooja More', 3],
];
const FIRST = ['Aarav', 'Vivaan', 'Aditya', 'Arjun', 'Sai', 'Reyansh', 'Ishaan', 'Krishna', 'Rohan', 'Kabir', 'Ananya', 'Diya', 'Isha', 'Kavya', 'Meera', 'Nisha', 'Priya', 'Riya', 'Saanvi', 'Tanvi'];
const LAST = ['Patil', 'Sharma', 'Deshmukh', 'Kulkarni', 'Joshi', 'Mehta', 'Iyer', 'Nair', 'Reddy', 'Gupta', 'Singh', 'Khan', 'Verma', 'Bhosale', 'More'];

export function buildInitialState() {
  const rand = mulberry32(2026);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];

  const subjects = SUBJECTS.map(([code, name, d, semester, facultyId, duration], i) => ({
    id: 'SUB' + pad(i + 1), code, name, dept: DEPARTMENTS[d], semester, facultyId, duration,
  }));
  const byDept = DEPARTMENTS.map((_, d) => subjects.filter((s) => s.dept === DEPARTMENTS[d]));

  const students = [];
  DEPARTMENTS.forEach((dept, d) => {
    const own = byDept[d];
    const nextDept = byDept[(d + 1) % DEPARTMENTS.length];   // electives come from the "neighbouring" department
    for (let k = 0; k < 30; k++) {
      const sem = k < 15 ? 3 : 5;
      const core = sem === 3 ? [own[0].id, own[1].id, own[2].id] : [own[3].id, own[4].id, pick(own.slice(0, 3)).id];   // sem 5 also carries one backlog subject
      const enrolled = k % 4 === 0 ? [...core, pick(nextDept).id] : core;                                              // only some students take a cross-department elective
      students.push({
        id: 'STU' + pad(students.length + 1, 3),
        roll: `${DEPT_SHORT[dept]}23${pad(k + 1, 3)}`,
        name: `${pick(FIRST)} ${pick(LAST)}`,
        dept, semester: sem, division: k % 2 === 0 ? 'A' : 'B',
        subjects: enrolled,
      });
    }
  });

  const days = nextWorkdays(5);
  const slots = [];
  days.forEach((date, i) => {
    slots.push({ id: 'S' + pad(2 * i + 1), date, start: '09:00', end: '12:00', session: 'Morning', available: true });
    slots.push({ id: 'S' + pad(2 * i + 2), date, start: '14:00', end: '17:00', session: 'Afternoon', available: true });
  });
  slots[slots.length - 1].available = false; // last afternoon slot is blocked

  const faculty = FACULTY.map(([id, name, d]) => ({
    id, name, dept: DEPARTMENTS[d],
    email: name.replace(/^(Dr\.|Prof\.)\s*/, '').toLowerCase().replace(/\s+/g, '.') + '@examsync.edu',
    availability: slots.map((s) => s.id).filter((sid) => !(id === 'F03' && ['S01', 'S02'].includes(sid)) && !(id === 'F08' && sid === 'S09')),
  }));

  const rooms = [
    { id: 'R01', name: 'LH-101', building: 'Main Block', capacity: 120, type: 'Lecture Hall', available: true },
    { id: 'R02', name: 'LH-102', building: 'Main Block', capacity: 100, type: 'Lecture Hall', available: true },
    { id: 'R03', name: 'A-201', building: 'Academic Block', capacity: 60, type: 'Classroom', available: true },
    { id: 'R04', name: 'A-202', building: 'Academic Block', capacity: 40, type: 'Classroom', available: true },
    { id: 'R05', name: 'LAB-1', building: 'Lab Block', capacity: 20, type: 'Laboratory', available: true },
    { id: 'R06', name: 'Seminar Hall', building: 'Admin Block', capacity: 80, type: 'Seminar Hall', available: false },
  ];

  const state = {
    settings: {
      university: { name: 'ExamSync University of Technology', address: 'Pune, Maharashtra, India', session: '2026–27 · End Semester Examinations' },
      defaultDuration: 3,
      morning: { start: '09:00', end: '12:00' },
      afternoon: { start: '14:00', end: '17:00' },
      startDate: days[0], endDate: days[days.length - 1],
      preferences: { strategy: 'dsatur', slotOrder: 'compact', useBacktracking: true, enforceFaculty: true, maxNodes: 50000 },
      profile: { name: 'Exam Controller', email: 'controller@examsync.edu', role: 'Administrator' },
    },
    students, subjects, faculty, rooms, slots, timetable: [], lastGeneration: null, activities: [],
  };

  const res = generateSchedule(state, {});
  state.timetable = res.timetable;
  state.lastGeneration = summariseGeneration(res);
  const now = new Date().toISOString();
  state.activities = [
    { id: 1, time: now, text: `Initial timetable generated (${res.status})` },
    { id: 0, time: now, text: 'Sample university dataset loaded' },
  ];
  return state;
}

export function summariseGeneration(res) {
  return {
    at: new Date().toISOString(), status: res.status, message: res.message,
    scheduled: res.assignments.length, unscheduled: res.unscheduled.length,
    slotsUsed: res.stats.slotsUsed, conflicts: res.stats.edges, timeMs: Math.round(res.stats.timeMs * 10) / 10,
  };
}

// ---------- LocalStorage ----------
export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.students && parsed.subjects && parsed.settings) return parsed;
    }
  } catch { /* fall through to sample data */ }
  return buildInitialState();
}
export function saveData(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* storage full or blocked */ }
}

// ---------- selectors shared by several pages ----------
export function buildTimetableRows(data) {
  const sub = Object.fromEntries(data.subjects.map((s) => [s.id, s]));
  const slot = Object.fromEntries(data.slots.map((s) => [s.id, s]));
  const room = Object.fromEntries(data.rooms.map((r) => [r.id, r]));
  const fac = Object.fromEntries(data.faculty.map((f) => [f.id, f]));
  const size = {};
  data.students.forEach((st) => st.subjects.forEach((id) => (size[id] = (size[id] || 0) + 1)));
  return data.timetable
    .filter((e) => sub[e.subjectId] && slot[e.slotId])
    .map((e) => {
      const s = sub[e.subjectId], sl = slot[e.slotId], r = room[e.roomId];
      return {
        key: e.subjectId, subjectId: s.id, code: s.code, name: s.name, dept: s.dept, semester: s.semester,
        date: sl.date, start: sl.start, end: sl.end, session: sl.session, slotId: sl.id,
        roomId: e.roomId, roomName: r ? r.name : '—', building: r ? r.building : '',
        faculty: fac[s.facultyId]?.name || '—', enrolled: size[s.id] || 0,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.code.localeCompare(b.code));
}

export function computeStats(data) {
  const conflicts = validateSchedule(data.timetable, data);
  const ids = new Set(data.subjects.map((s) => s.id));
  const sched = new Set(data.timetable.filter((e) => ids.has(e.subjectId)).map((e) => e.subjectId));
  const scheduled = sched.size;
  const depts = [...new Set(data.subjects.map((s) => s.dept))];
  const deptDist = depts.map((d) => {
    const ss = data.subjects.filter((s) => s.dept === d);
    const sc = ss.filter((s) => sched.has(s.id)).length;
    return { name: DEPT_SHORT[d] || d, full: d, scheduled: sc, unscheduled: ss.length - sc, total: ss.length };
  });
  const availSlots = data.slots.filter((s) => s.available).length || 1;
  const roomUtil = data.rooms.map((r) => {
    const exams = data.timetable.filter((e) => e.roomId === r.id).length;
    return { name: r.name, exams, utilization: Math.round((exams / availSlots) * 100), available: r.available };
  });
  const slotUtil = [...data.slots].sort(cmpSlots).map((s) => ({
    id: s.id, name: `${s.date.slice(5)} ${s.session.slice(0, 3)}`, exams: data.timetable.filter((e) => e.slotId === s.id).length, available: s.available,
  }));
  const conflictTypes = CONFLICT_TYPES.map((t) => ({ name: t, value: conflicts.filter((c) => c.type === t).length }));
  return {
    conflicts, scheduled, unscheduled: data.subjects.length - scheduled, deptDist, roomUtil, slotUtil, conflictTypes,
    slotsUsed: new Set(data.timetable.map((e) => e.slotId)).size,
  };
}

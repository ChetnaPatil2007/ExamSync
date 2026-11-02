// ============================================================
//  sampleData.js – sample dataset, LocalStorage, shared context & selectors
//
//  DATA MODEL (changed):
//   subject : { id, code, name, dept, year, type: 'Compulsory' | 'Elective', facultyId, duration }
//   student : { id, roll, name, dept, year, division, subjects: [subjectId] }
//             (all compulsory subjects of the year + the electives the student chose)
//   settings.plan : the EXAM SETUP typed in by the user
//             { subjectIds, startDate, endDate, skipWeekends, excludeDates, sessions: [{start,end}] }
// ============================================================
import { createContext, useContext } from 'react';
import { generateSchedule, validateSchedule, cmpSlots, slotsOverlap } from '../algorithms/schedulingAlgorithms';

export const STORAGE_KEY = 'examsync-data-v2';
export const DEPARTMENTS = ['Computer Science', 'Information Technology', 'Electronics', 'Mechanical Engineering'];
export const DEPT_SHORT = { 'Computer Science': 'CS', 'Information Technology': 'IT', Electronics: 'EC', 'Mechanical Engineering': 'ME' };
export const CHART_COLORS = ['#2563eb', '#7c3aed', '#16a34a', '#f97316', '#dc2626', '#0891b2', '#db2777', '#ca8a04', '#4f46e5', '#0d9488'];
export const CONFLICT_TYPES = ['Student', 'Room', 'Faculty', 'Capacity', 'Availability'];
export const SUBJECT_TYPES = ['Compulsory', 'Elective'];
export const MAX_DAYS = 366;

// ---------- shared context (provider lives in App.jsx) ----------
export const DataContext = createContext(null);
export const useData = () => useContext(DataContext);

// ---------- small helpers ----------
const pad = (n, l = 2) => String(n).padStart(l, '0');
export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => isoDate(new Date());
export const fmtDate = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
export const slotLabel = (s) => (s ? `${fmtDate(s.date)} · ${s.start}–${s.end}` : '—');
export const sessionName = (start) => (start < '12:00' ? 'Morning' : start < '17:00' ? 'Afternoon' : 'Evening');
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

/** The subjects that are part of the current examination (chosen in Exam Setup). */
export const examSubjects = (data) => {
  const ids = data.settings.plan?.subjectIds || [];
  return data.subjects.filter((s) => ids.includes(s.id));
};

// ---------- exam plan: dates x sessions -> slots ----------
export const rangeTooLong = (start, end) => (new Date(end + 'T00:00:00') - new Date(start + 'T00:00:00')) / 864e5 > MAX_DAYS;

/** Every exam day of the plan (weekends and holidays removed). */
export function planDates(plan) {
  if (!plan.startDate || !plan.endDate || plan.startDate > plan.endDate || rangeTooLong(plan.startDate, plan.endDate)) return [];
  const out = [];
  for (let d = new Date(plan.startDate + 'T00:00:00'); isoDate(d) <= plan.endDate; d.setDate(d.getDate() + 1)) {
    const iso = isoDate(d);
    if (plan.skipWeekends && (d.getDay() === 0 || d.getDay() === 6)) continue;
    if ((plan.excludeDates || []).includes(iso)) continue;
    out.push(iso);
  }
  return out;
}

/** Finds (or creates) a slot for every date x session. Returns the new slots and the ids of all wanted slots. */
export function buildPlanSlots(existing, dates, sessions) {
  let all = [...existing];
  const created = [], wanted = [];
  dates.forEach((date) => sessions.forEach((t) => {
    const found = all.find((s) => s.date === date && s.start === t.start && s.end === t.end);
    if (found) { wanted.push(found.id); return; }
    if (all.some((s) => slotsOverlap(s, { date, start: t.start, end: t.end }))) return;   // clashes with a different manual slot
    const slot = { id: nextId('S', all), date, start: t.start, end: t.end, session: sessionName(t.start), available: true };
    all = [...all, slot]; created.push(slot); wanted.push(slot.id);
  }));
  return { created, wanted };
}

/**
 * Generates a timetable from the exam plan. Pure function – nothing is saved here.
 *  over (optional, used by "what-if"): { plan, dates, sessions, subjectIds, roomIds, duration, prefs }
 * Returns { res, patch, wanted } – apply with setData((p) => ({ ...p, ...patch })).
 */
export function planExam(data, over = {}) {
  const st = data.settings;
  const plan = { ...st.plan, ...(over.plan || {}) };
  const dates = over.dates || planDates(plan);
  const sessions = over.sessions || plan.sessions;
  const { created, wanted } = buildPlanSlots(data.slots, dates, sessions);
  const createdIds = created.map((x) => x.id);
  const base = {
    ...data,
    timetable: [],                                   // the timetable is built fresh from the plan
    slots: [...data.slots, ...created],
    faculty: data.faculty.map((f) => ({ ...f, availability: [...f.availability, ...createdIds] })),
  };
  const res = generateSchedule(base, { slotIds: wanted, roomIds: over.roomIds, subjectIds: over.subjectIds || plan.subjectIds, duration: over.duration, prefs: over.prefs });
  let patch = { slots: base.slots, faculty: base.faculty, settings: { ...st, plan } };
  if (res.assignments.length > 0) {
    const keep = (x) => wanted.includes(x.id);       // slots outside the plan are removed
    const gone = new Set(base.slots.filter((x) => !keep(x)).map((x) => x.id));
    patch = {
      ...patch,
      slots: base.slots.filter(keep),
      faculty: base.faculty.map((f) => ({ ...f, availability: f.availability.filter((id) => !gone.has(id)) })),
      timetable: res.timetable,
      lastGeneration: summariseGeneration(res),
    };
  }
  return { res, patch, wanted };
}

// ---------- sample dataset ----------
// per department: [year-2 compulsory, year-2 electives, year-3 compulsory, year-3 electives]
const CATALOG = [
  [['Data Structures', 'Discrete Mathematics', 'Computer Organization'], ['Python Programming', 'Web Basics', 'Computer Graphics'], ['Database Systems', 'Operating Systems', 'Computer Networks'], ['Machine Learning', 'Cloud Computing', 'Cyber Security']],
  [['Web Technologies', 'Software Engineering', 'Data Communication'], ['Java Programming', 'Mobile Apps', 'UI Design'], ['Information Security', 'Cloud Infrastructure', 'Data Mining'], ['Internet of Things', 'Big Data', 'DevOps']],
  [['Digital Electronics', 'Signals & Systems', 'Analog Circuits'], ['VLSI Basics', 'Sensors', 'Embedded C'], ['Microprocessors', 'Communication Systems', 'Control Systems'], ['Antenna Theory', 'Robotics', 'Digital Signal Processing']],
  [['Thermodynamics', 'Fluid Mechanics', 'Machine Design'], ['CAD Basics', 'Material Science', 'Mechatronics'], ['Manufacturing Processes', 'Engineering Mechanics', 'Heat Transfer'], ['Automobile Engineering', 'Renewable Energy', 'Industrial Safety']],
];
const FACULTY_NAMES = ['Dr. Anita Deshmukh', 'Prof. Rahul Kulkarni', 'Dr. Meera Joshi', 'Prof. Sanjay Patil', 'Dr. Neha Iyer', 'Prof. Vikram Nair', 'Dr. Suresh Reddy', 'Prof. Kavita Mehta', 'Dr. Arvind Bhosale', 'Prof. Pooja More', 'Dr. Rohit Sharma', 'Prof. Sneha Gupta'];
const FIRST = ['Aarav', 'Vivaan', 'Aditya', 'Arjun', 'Sai', 'Reyansh', 'Ishaan', 'Krishna', 'Rohan', 'Kabir', 'Ananya', 'Diya', 'Isha', 'Kavya', 'Meera', 'Nisha', 'Priya', 'Riya', 'Saanvi', 'Tanvi'];
const LAST = ['Patil', 'Sharma', 'Deshmukh', 'Kulkarni', 'Joshi', 'Mehta', 'Iyer', 'Nair', 'Reddy', 'Gupta', 'Singh', 'Khan', 'Verma', 'Bhosale', 'More'];

export function buildInitialState() {
  const rand = mulberry32(2026);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];

  const subjects = [];
  CATALOG.forEach((groups, d) => groups.forEach((names, g) => {
    const year = g < 2 ? 2 : 3, type = g % 2 === 0 ? 'Compulsory' : 'Elective';
    names.forEach((name, i) => {
      const inDept = subjects.filter((s) => s.dept === DEPARTMENTS[d]).length;
      subjects.push({
        id: 'SUB' + pad(subjects.length + 1), code: `${DEPT_SHORT[DEPARTMENTS[d]]}${year}${pad((g % 2) * 3 + i + 1)}`, name,
        dept: DEPARTMENTS[d], year, type, facultyId: 'F' + pad(d * 3 + (inDept % 3) + 1), duration: type === 'Elective' ? 2 : 3,
      });
    });
  }));

  // Every student takes ALL compulsory subjects of their year and chooses 2 of the 3 electives.
  const students = [];
  DEPARTMENTS.forEach((dept) => [2, 3].forEach((year) => {
    const mine = subjects.filter((s) => s.dept === dept && s.year === year);
    const comp = mine.filter((s) => s.type === 'Compulsory').map((s) => s.id);
    const elec = mine.filter((s) => s.type === 'Elective').map((s) => s.id);
    for (let k = 0; k < 24; k++) {
      const skip = Math.floor(rand() * elec.length);
      students.push({
        id: 'STU' + pad(students.length + 1, 3), roll: `${DEPT_SHORT[dept]}${27 - year}${pad(k + 1, 3)}`,
        name: `${pick(FIRST)} ${pick(LAST)}`, dept, year, division: k % 2 === 0 ? 'A' : 'B',
        subjects: [...comp, ...elec.filter((_, i) => i !== skip)],
      });
    }
  }));

  const faculty = FACULTY_NAMES.map((name, i) => ({
    id: 'F' + pad(i + 1), name, dept: DEPARTMENTS[Math.floor(i / 3)],
    email: name.replace(/^(Dr\.|Prof\.)\s*/, '').toLowerCase().replace(/\s+/g, '.') + '@examsync.edu',
    availability: [],
  }));

  // Room sizes are realistic: small rooms for small exams, big halls only when needed.
  const rooms = [
    { id: 'R01', name: 'LH-101', building: 'Main Block', capacity: 60, type: 'Lecture Hall', available: true },
    { id: 'R02', name: 'LH-102', building: 'Main Block', capacity: 60, type: 'Lecture Hall', available: true },
    { id: 'R03', name: 'A-201', building: 'Academic Block', capacity: 40, type: 'Classroom', available: true },
    { id: 'R04', name: 'A-202', building: 'Academic Block', capacity: 40, type: 'Classroom', available: true },
    { id: 'R05', name: 'A-203', building: 'Academic Block', capacity: 30, type: 'Classroom', available: true },
    { id: 'R06', name: 'A-204', building: 'Academic Block', capacity: 30, type: 'Classroom', available: true },
    { id: 'R07', name: 'LAB-1', building: 'Lab Block', capacity: 20, type: 'Laboratory', available: true },
    { id: 'R08', name: 'Seminar Hall', building: 'Admin Block', capacity: 80, type: 'Seminar Hall', available: false },
  ];

  const days = nextWorkdays(10);
  let state = {
    settings: {
      university: { name: 'ExamSync University of Technology', address: 'Pune, Maharashtra, India', session: '2026–27 · End Semester Examinations' },
      defaultDuration: 3,
      preferences: { strategy: 'dsatur', slotOrder: 'compact', useBacktracking: true, enforceFaculty: true, maxNodes: 50000, minOccupancy: 40 },
      plan: {
        subjectIds: subjects.map((s) => s.id), startDate: days[0], endDate: days[days.length - 1], skipWeekends: true, excludeDates: [],
        sessions: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '17:00' }],
      },
      profile: { name: 'Exam Controller', email: 'controller@examsync.edu', role: 'Administrator' },
    },
    students, subjects, faculty, rooms, slots: [], timetable: [], lastGeneration: null, activities: [],
  };
  const run = (s) => ({ ...s, ...planExam(s).patch });
  state = run(state);                                                            // creates the slots
  const firstTwo = state.slots.slice(0, 2).map((s) => s.id);                     // one teacher is away on day 1
  state = run({ ...state, faculty: state.faculty.map((f) => (f.id === 'F02' ? { ...f, availability: f.availability.filter((id) => !firstTwo.includes(id)) } : f)) });
  const now = new Date().toISOString();
  state.activities = [
    { id: 1, time: now, text: `Initial timetable generated (${state.lastGeneration?.status})` },
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
      if (parsed && parsed.students && parsed.subjects && parsed.settings?.plan) return parsed;
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
        key: e.subjectId, subjectId: s.id, code: s.code, name: s.name, dept: s.dept, year: s.year, type: s.type,
        date: sl.date, start: sl.start, end: sl.end, session: sl.session, slotId: sl.id,
        roomId: e.roomId, roomName: r ? r.name : '—', building: r ? r.building : '', capacity: r ? r.capacity : 0,
        faculty: fac[s.facultyId]?.name || '—', enrolled: size[s.id] || 0,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.code.localeCompare(b.code));
}

export function computeStats(data) {
  const conflicts = validateSchedule(data.timetable, data);
  const subs = examSubjects(data);
  const ids = new Set(subs.map((s) => s.id));
  const sched = new Set(data.timetable.filter((e) => ids.has(e.subjectId)).map((e) => e.subjectId));
  const scheduled = sched.size;
  const depts = [...new Set(subs.map((s) => s.dept))];
  const deptDist = depts.map((d) => {
    const ss = subs.filter((s) => s.dept === d);
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
    conflicts, scheduled, unscheduled: subs.length - scheduled, deptDist, roomUtil, slotUtil, conflictTypes,
    slotsUsed: new Set(data.timetable.map((e) => e.slotId)).size,
  };
}

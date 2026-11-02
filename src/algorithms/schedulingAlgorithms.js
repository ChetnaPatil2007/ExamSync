// ============================================================
//  schedulingAlgorithms.js
//  Greedy colouring · DSATUR · Backtracking · Room allocation · Validation
//
//  Graph colouring handles STUDENT conflicts.
//  Rooms, capacity, faculty and availability are extra constraints that
//  are checked separately (see makeChecker / validateSchedule).
// ============================================================
import { buildConflictGraph, enrollmentSets, maxClique, intersection } from './graphAlgorithms';

// ---------- time helpers ----------
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const slotHours = (s) => (toMin(s.end) - toMin(s.start)) / 60;
export const slotsOverlap = (a, b) => a.date === b.date && toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end);
export const cmpSlots = (a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start);
const slotText = (s) => (s ? `${s.date} ${s.start}-${s.end}` : 'unknown slot');
const range = (n) => Array.from({ length: n }, (_, i) => i);

// ---------- vertex selection ----------
/** DSATUR picks the vertex with the highest saturation (distinct neighbour colours),
 *  ties broken by degree. strategy 'degree' uses degree only. */
function pickVertex(graph, color, pool, strategy) {
  let best = -1, bs = -1, bd = -1;
  for (const v of pool) {
    let sat = 0;
    if (strategy === 'dsatur') {
      const s = new Set();
      graph.adj[v].forEach((u) => { if (color[u] !== null && color[u] !== undefined) s.add(color[u]); });
      sat = s.size;
    }
    const d = graph.degree[v];
    if (sat > bs || (sat === bs && (d > bd || (d === bd && v < best)))) { best = v; bs = sat; bd = d; }
  }
  return best;
}

// ---------- recursive backtracking colouring ----------
/**
 * Assigns a value from `domain` (slot ids or colour numbers) to every vertex in `scope`.
 * canAssign(v, c, color, meta) may return false (reject), true, or a value stored in meta[v] (e.g. a room id).
 * The recursion tree: each level = one vertex, each branch = one candidate slot.
 */
export function backtrackingSolve(graph, domain, opts = {}) {
  const {
    canAssign = () => true, initial = [], initialMeta = [], scope, strategy = 'dsatur',
    domainOrder, maxNodes = 100000, record = false, maxSteps = 3000,
  } = opts;
  const n = graph.n;
  const color = Array(n).fill(null);
  const meta = Array(n).fill(null);
  initial.forEach((c, i) => { if (c !== null && c !== undefined) { color[i] = c; meta[i] = initialMeta[i] ?? null; } });
  const pool = new Set(scope ?? range(n).filter((i) => color[i] === null));
  const steps = [];
  let nodes = 0, backtracks = 0, aborted = false, depth = 0, maxDepth = 0;
  const log = (s) => { if (record && steps.length < maxSteps) steps.push(s); };

  const solve = () => {
    if (pool.size === 0) return true;                 // base case: everything coloured
    if (++nodes > maxNodes) { aborted = true; return false; }
    const v = pickVertex(graph, color, pool, strategy);
    pool.delete(v);
    const blocked = new Set();
    graph.adj[v].forEach((u) => { if (color[u] !== null) blocked.add(color[u]); });
    const candidates = domainOrder ? domainOrder(v, color) : domain;
    for (const c of candidates) {
      if (blocked.has(c)) { log({ type: 'skip', v, c, depth, reason: 'neighbour' }); continue; }
      const r = canAssign(v, c, color, meta);
      if (!r) { log({ type: 'skip', v, c, depth, reason: 'resource' }); continue; }
      color[v] = c; meta[v] = r === true ? null : r;
      depth++; maxDepth = Math.max(maxDepth, depth);
      log({ type: 'assign', v, c, depth });
      if (solve()) return true;                       // recursive step
      depth--; color[v] = null; meta[v] = null; backtracks++;   // undo (backtrack)
      log({ type: 'backtrack', v, c, depth });
      if (aborted) break;
    }
    pool.add(v);
    return false;
  };

  const success = solve();
  return { success, color, meta, steps, nodes, backtracks, aborted, maxDepth, truncated: record && steps.length >= maxSteps };
}

// ---------- greedy colouring (no undo) ----------
/** order: 'natural' | 'degree' (Welsh–Powell) | 'dsatur' */
export function greedyAssign(graph, domain, opts = {}) {
  const { order = 'natural', canAssign = () => true, initial = [], initialMeta = [], scope, domainOrder } = opts;
  const n = graph.n;
  const color = Array(n).fill(null);
  const meta = Array(n).fill(null);
  initial.forEach((c, i) => { if (c !== null && c !== undefined) { color[i] = c; meta[i] = initialMeta[i] ?? null; } });
  const idx = scope ?? range(n).filter((i) => color[i] === null);
  const seq = order === 'degree' ? [...idx].sort((a, b) => graph.degree[b] - graph.degree[a] || a - b) : [...idx];
  const pool = new Set(idx);
  const failed = [], used = [];
  while (true) {
    let v;
    if (order === 'dsatur') { if (!pool.size) break; v = pickVertex(graph, color, pool, 'dsatur'); pool.delete(v); }
    else { if (!seq.length) break; v = seq.shift(); }
    used.push(v);
    const blocked = new Set();
    graph.adj[v].forEach((u) => { if (color[u] !== null) blocked.add(color[u]); });
    let placed = false;
    for (const c of domainOrder ? domainOrder(v, color) : domain) {
      if (blocked.has(c)) continue;
      const r = canAssign(v, c, color, meta);
      if (!r) continue;
      color[v] = c; meta[v] = r === true ? null : r; placed = true; break;
    }
    if (!placed) failed.push(v);
  }
  return { color, meta, failed, order: used, used: new Set(color.filter((c) => c !== null)).size };
}
export const greedyColoring = (graph, order = 'natural') => greedyAssign(graph, range(graph.n), { order });
export const dsaturColoring = (graph) => greedyAssign(graph, range(graph.n), { order: 'dsatur' });

// ---------- resource constraints (room / faculty / duration) ----------
/**
 * ROOM RULE (keeps capacity and student numbers logical):
 *  1. the room must have at least as many seats as there are students;
 *  2. a room is only allowed if it is the SMALLEST room that fits, or it would be at least
 *     `minOccupancy` % full – so 20 students never get a 120-seat hall;
 *  3. among the allowed free rooms the smallest is used (best fit).
 */
function makeChecker(data, graph, usableRooms, slotMap, durationOverride, prefs) {
  const facMap = Object.fromEntries(data.faculty.map((f) => [f.id, f]));
  const minOcc = (prefs.minOccupancy ?? 40) / 100;
  return function check(v, slotId, color, meta) {
    const subj = graph.vertices[v].subject;
    const slot = slotMap[slotId];
    if (!slot) return { ok: false, reason: 'slot' };
    for (const u of graph.adj[v]) if (color[u] === slotId) return { ok: false, reason: 'student' };
    const need = durationOverride || subj.duration || data.settings.defaultDuration;
    if (slotHours(slot) + 1e-9 < need) return { ok: false, reason: 'duration' };
    if (prefs.enforceFaculty && subj.facultyId) {
      const f = facMap[subj.facultyId];
      if (f && !f.availability.includes(slotId)) return { ok: false, reason: 'faculty-unavailable' };
      for (let u = 0; u < graph.n; u++) {
        if (u !== v && color[u] === slotId && graph.vertices[u].subject.facultyId === subj.facultyId) return { ok: false, reason: 'faculty-busy' };
      }
    }
    const usedRooms = new Set();
    for (let u = 0; u < graph.n; u++) if (u !== v && color[u] === slotId && meta[u]) usedRooms.add(meta[u]);
    const size = graph.vertices[v].size;
    const fits = usableRooms.filter((r) => r.capacity >= size).sort((a, b) => a.capacity - b.capacity);
    if (!fits.length) return { ok: false, reason: 'capacity' };
    const allowed = fits.filter((r) => r.capacity === fits[0].capacity || size >= r.capacity * minOcc);
    const free = allowed.filter((r) => !usedRooms.has(r.id));
    if (!free.length) return { ok: false, reason: 'rooms-busy' };
    return { ok: true, room: free[0].id };
  };
}

// ---------- full timetable generation ----------
/**
 * opts: { slotIds, roomIds, subjectIds, duration, prefs }
 *  subjectIds – the subjects that have an exam (the graph only contains these)
 *  slotIds    – the slots that come from the dates x sessions typed in Exam Setup
 */
export function generateSchedule(data, opts = {}) {
  const t0 = performance.now();
  const { students, rooms, slots, settings } = data;
  const timetable = data.timetable || [];
  const prefs = { ...settings.preferences, ...(opts.prefs || {}) };
  const { slotIds: selSlots, roomIds: selRooms, subjectIds, duration } = opts;
  const subjects = data.subjects.filter((s) => !subjectIds || subjectIds.includes(s.id));
  const pipeline = [];
  const fail = (message, suggestions = []) => ({
    status: 'failed', message, assignments: [], timetable, unscheduled: [], suggestions, pipeline,
    stats: { slotsUsed: 0, edges: 0, nodes: 0, backtracks: 0, timeMs: performance.now() - t0, cliqueSize: 0, strategy: prefs.strategy, scope: 0 },
  });
  if (!subjects.length) return fail('No exam subjects are selected.', ['Tick at least one subject in Exam Setup.']);

  // 1. input
  const compulsory = subjects.filter((s) => s.type === 'Compulsory').length;
  const years = [...new Set(subjects.map((s) => s.year))].sort().join(', ');
  pipeline.push(`Input: ${subjects.length} exam subjects (${compulsory} compulsory, ${subjects.length - compulsory} elective) for year ${years}.`);
  // 2. conflict graph
  const graph = buildConflictGraph(subjects, students);
  const elecEdges = graph.edges.filter((e) => graph.vertices[e.a].subject.type === 'Elective' && graph.vertices[e.b].subject.type === 'Elective').length;
  pipeline.push(`Conflict graph: every subject is a vertex; an edge joins two subjects when at least one student writes both. Result: ${graph.edges.length} edges, ${elecEdges} of them between two electives. Compulsory subjects are written by every student of the year, so they clash with all subjects of that year; electives clash only when a student chose both.`);
  const maxDeg = graph.degree.length ? Math.max(...graph.degree) : 0;
  const scope = range(graph.n);

  const usableSlots = slots
    .filter((s) => s.available && (!selSlots || selSlots.includes(s.id)))
    .sort(cmpSlots);
  const usableRooms = rooms.filter((r) => r.available && (!selRooms || selRooms.includes(r.id)));
  if (!usableSlots.length) return fail('No usable time slots are available for the chosen dates and sessions.', ['Add more exam dates or sessions in Exam Setup.', 'Check that the slots are not marked unavailable.']);
  if (!usableRooms.length) return fail('No examination rooms are available.', ['Add a room or mark an existing room as available.']);

  const slotMap = Object.fromEntries(usableSlots.map((s) => [s.id, s]));
  const slotIds = usableSlots.map((s) => s.id);
  const scopeSet = new Set(subjects.map((s) => s.id));
  const check = makeChecker(data, graph, usableRooms, slotMap, duration ? Number(duration) : 0, prefs);
  const canAssign = (v, c, color, meta) => { const r = check(v, c, color, meta); return r.ok ? r.room : false; };
  const domainOrder = prefs.slotOrder === 'spread'
    ? (v, color) => {
        const cnt = {};
        color.forEach((c) => { if (c !== null) cnt[c] = (cnt[c] || 0) + 1; });
        return [...slotIds].sort((a, b) => (cnt[a] || 0) - (cnt[b] || 0) || slotIds.indexOf(a) - slotIds.indexOf(b));
      }
    : undefined;
  const strategy = prefs.strategy === 'dsatur' ? 'dsatur' : 'degree';
  const clique = maxClique(graph);
  pipeline.push(`Slots: ${slotIds.length} time slots (exam dates × sessions per day). A group of ${clique.length} subjects all clash with each other, so at least ${clique.length} different slots are needed (pigeonhole principle).`);
  pipeline.push(`Order: ${strategy === 'dsatur' ? 'DSATUR' : 'highest degree first'} schedules the most constrained subject first (the busiest subject clashes with ${maxDeg} others).`);

  // 3. colour + backtrack + allocate rooms
  let color = null, meta = null, failed = [], nodes = 0, backtracks = 0, aborted = false;
  if (prefs.useBacktracking) {
    const bt = backtrackingSolve(graph, slotIds, { canAssign, scope, strategy, domainOrder, maxNodes: prefs.maxNodes || 50000 });
    nodes = bt.nodes; backtracks = bt.backtracks; aborted = bt.aborted;
    if (bt.success) { color = bt.color; meta = bt.meta; }
  }
  if (!color) {
    const g = greedyAssign(graph, slotIds, { order: strategy === 'dsatur' ? 'dsatur' : 'degree', canAssign, scope, domainOrder });
    color = g.color; meta = g.meta; failed = g.failed;
  }
  pipeline.push(prefs.useBacktracking
    ? `Backtracking: tried ${nodes} subject placements and undid ${backtracks} wrong choices${aborted ? ' (search limit reached)' : ''}.`
    : 'Backtracking is switched off – one greedy pass was used (no undo).');
  pipeline.push(`Rooms: each exam gets the smallest free room that fits its students; a room is skipped when it would be less than ${prefs.minOccupancy ?? 40}% full (unless it is the smallest that fits).`);

  // diagnose failures
  const unscheduled = failed.map((v) => {
    const counts = {};
    slotIds.forEach((sid) => { const r = check(v, sid, color, meta); if (!r.ok) counts[r.reason] = (counts[r.reason] || 0) + 1; });
    const label = { student: 'blocked by conflicting subjects', 'faculty-unavailable': 'faculty unavailable', 'faculty-busy': 'faculty already invigilating', capacity: 'no room large enough', 'rooms-busy': 'all suitable rooms busy', duration: 'slot too short', slot: 'slot missing' };
    const parts = Object.entries(counts).map(([k, n]) => `${n}× ${label[k] || k}`).join(', ');
    return { subjectId: graph.vertices[v].id, reason: `Every one of the ${slotIds.length} usable slots was rejected (${parts}).`, counts, size: graph.vertices[v].size };
  });
  const suggestions = new Set();
  unscheduled.forEach((u) => {
    if (u.counts.student) suggestions.add('Add more exam dates or sessions – conflicting subjects already occupy the available slots.');
    if (u.counts.capacity) suggestions.add(`Add or enable a room that can seat ${u.size}+ students.`);
    if (u.counts['rooms-busy']) suggestions.add('Add more rooms (or lower the minimum room fill) so more exams can run in parallel.');
    if (u.counts['faculty-unavailable'] || u.counts['faculty-busy']) suggestions.add('Update faculty availability or reassign the subject to another faculty member.');
    if (u.counts.duration) suggestions.add('Use longer sessions or reduce the examination duration.');
  });
  if (clique.length > slotIds.length) {
    suggestions.add(`Pigeonhole Principle: ${clique.length} subjects (${clique.map((i) => graph.vertices[i].label).join(', ')}) pairwise share students, so they need ${clique.length} different slots but only ${slotIds.length} are available. Add at least ${clique.length - slotIds.length} more slot(s).`);
  }

  const assignments = scope.filter((v) => color[v] !== null).map((v) => ({ subjectId: graph.vertices[v].id, slotId: color[v], roomId: meta[v] }));
  const newTimetable = [...timetable.filter((e) => !scopeSet.has(e.subjectId)), ...assignments];
  const issues = validateSchedule(newTimetable, data);
  pipeline.push(`Check: the finished timetable was validated for student, room, faculty and capacity clashes – ${issues.length} issue(s) found. ${assignments.length} of ${scope.length} exams scheduled.`);

  const status = failed.length === 0 ? 'success' : assignments.length === 0 ? 'failed' : 'partial';
  const slotsUsed = new Set(assignments.map((a) => a.slotId)).size;
  const message = status === 'success'
    ? `Scheduled all ${scope.length} examinations using ${slotsUsed} of ${slotIds.length} time slots.`
    : status === 'partial'
      ? `Scheduled ${assignments.length} of ${scope.length} examinations. ${failed.length} could not be placed.`
      : 'No examination could be scheduled with the current slots, rooms and faculty availability.';

  return {
    status, message, assignments, timetable: newTimetable, unscheduled, suggestions: [...suggestions], pipeline, issues,
    stats: { slotsUsed, slotsAvailable: slotIds.length, edges: graph.edges.length, nodes, backtracks, aborted, timeMs: performance.now() - t0, cliqueSize: clique.length, strategy: prefs.strategy, scope: scope.length },
  };
}

// ---------- validation ----------
function ctxMaps(data) {
  return {
    sub: Object.fromEntries(data.subjects.map((s) => [s.id, s])),
    slot: Object.fromEntries(data.slots.map((s) => [s.id, s])),
    room: Object.fromEntries(data.rooms.map((r) => [r.id, r])),
    fac: Object.fromEntries(data.faculty.map((f) => [f.id, f])),
    sets: enrollmentSets(data.subjects, data.students),
  };
}

function resourceChecks(e, m, out) {
  const s = m.sub[e.subjectId], sl = m.slot[e.slotId], r = m.room[e.roomId];
  if (!s) return;
  const size = m.sets[s.id]?.size || 0;
  const push = (type, message) => out.push({ id: `${type}:${s.id}`, type, subjectIds: [s.id], slotId: e.slotId, roomId: e.roomId, message });
  if (!sl) push('Availability', `${s.code}: its time slot no longer exists`);
  else if (!sl.available) push('Availability', `${s.code}: slot ${slotText(sl)} is marked unavailable`);
  if (!r) push('Availability', `${s.code}: its room no longer exists`);
  else {
    if (!r.available) push('Availability', `${s.code}: room ${r.name} is unavailable`);
    if (r.capacity < size) push('Capacity', `${s.code} has ${size} students but ${r.name} seats only ${r.capacity}`);
  }
  const f = s.facultyId && m.fac[s.facultyId];
  if (f && sl && !f.availability.includes(e.slotId)) push('Availability', `${f.name} (${s.code}) is not available in ${slotText(sl)}`);
}

function pairChecks(e, o, m, out) {
  const a = m.sub[e.subjectId], b = m.sub[o.subjectId];
  const sa = m.slot[e.slotId], sb = m.slot[o.slotId];
  if (!a || !b || !sa || !sb || !slotsOverlap(sa, sb)) return;
  const key = [a.id, b.id].sort().join('-');
  const base = { subjectIds: [a.id, b.id], slotId: e.slotId, roomId: e.roomId };
  const common = intersection(m.sets[a.id] || new Set(), m.sets[b.id] || new Set());
  if (common.size > 0) out.push({ ...base, id: `Student:${key}`, type: 'Student', message: `${a.code} and ${b.code} share ${common.size} student(s) but run in the same slot` });
  if (e.roomId && e.roomId === o.roomId) out.push({ ...base, id: `Room:${key}`, type: 'Room', message: `${a.code} and ${b.code} are both booked in ${m.room[e.roomId]?.name || e.roomId} at the same time` });
  if (a.facultyId && a.facultyId === b.facultyId) out.push({ ...base, id: `Faculty:${key}`, type: 'Faculty', message: `${m.fac[a.facultyId]?.name || 'Faculty'} has overlapping duties for ${a.code} and ${b.code}` });
}

export function validateSchedule(timetable, data) {
  const m = ctxMaps(data);
  const entries = timetable.filter((e) => m.sub[e.subjectId]);
  const out = [];
  entries.forEach((e) => resourceChecks(e, m, out));
  for (let i = 0; i < entries.length; i++) for (let j = i + 1; j < entries.length; j++) pairChecks(entries[i], entries[j], m, out);
  return out;
}

/** Check one hypothetical placement against the rest of the timetable. */
export function validateEntry(entry, others, data, maps) {
  const m = maps || ctxMaps(data);
  const out = [];
  resourceChecks(entry, m, out);
  others.filter((o) => o.subjectId !== entry.subjectId && m.sub[o.subjectId]).forEach((o) => pairChecks(entry, o, m, out));
  return out;
}

/** All valid (slot, room) alternatives for one subject. */
export function suggestAlternatives(subjectId, timetable, data, limit = 8) {
  const m = ctxMaps(data);
  const others = timetable.filter((e) => e.subjectId !== subjectId);
  const out = [];
  [...data.slots].filter((s) => s.available).sort(cmpSlots).forEach((slot) => {
    [...data.rooms].filter((r) => r.available).sort((a, b) => a.capacity - b.capacity).forEach((room) => {
      const entry = { subjectId, slotId: slot.id, roomId: room.id };
      if (validateEntry(entry, others, data, m).length === 0) out.push(entry);
    });
  });
  return out.slice(0, limit);
}

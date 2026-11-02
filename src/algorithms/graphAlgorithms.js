// ============================================================
//  graphAlgorithms.js – Conflict graph G = (V, E)
//  Vertices = subjects, edge = the two subjects share a student
// ============================================================
import { intersection } from './mathOperations';

export const graphDensity = (n, m) => (n < 2 ? 0 : (2 * m) / (n * (n - 1)));

/** subjectId -> Set(studentId)  (each subject is a SET of students) */
export function enrollmentSets(subjects, students) {
  const map = {};
  subjects.forEach((s) => (map[s.id] = new Set()));
  students.forEach((st) => st.subjects.forEach((id) => { if (map[id]) map[id].add(st.id); }));
  return map;
}

/** Generic graph builder. pairs = [[i, j, commonStudents?], ...] */
export function graphFromEdges(vertices, pairs) {
  const n = vertices.length;
  const adj = Array.from({ length: n }, () => new Set());
  const edges = [];
  pairs.forEach(([a, b, common = []]) => {
    if (a === b || adj[a].has(b)) return;
    adj[a].add(b);
    adj[b].add(a);
    edges.push({ a, b, common });
  });
  const degree = adj.map((s) => s.size);
  const matrix = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (adj[i].has(j) ? 1 : 0)));
  const index = Object.fromEntries(vertices.map((v, i) => [v.id, i]));
  return { vertices, n, adj, edges, degree, matrix, index, density: graphDensity(n, edges.length) };
}

/** Build the conflict graph from real enrolment data using set intersection. */
export function buildConflictGraph(subjects, students) {
  const sets = enrollmentSets(subjects, students);
  const vertices = subjects.map((s) => ({
    id: s.id, label: s.code, name: s.name, dept: s.dept, subject: s, size: sets[s.id].size,
  }));
  const pairs = [];
  for (let i = 0; i < subjects.length; i++) {
    for (let j = i + 1; j < subjects.length; j++) {
      const common = intersection(sets[subjects[i].id], sets[subjects[j].id]);
      if (common.size > 0) pairs.push([i, j, [...common]]);
    }
  }
  return graphFromEdges(vertices, pairs);
}

/** Edges whose two endpoints share the same colour (improper colouring). */
export function findInvalidEdges(graph, color) {
  return graph.edges.filter((e) => color[e.a] !== null && color[e.a] !== undefined && color[e.a] === color[e.b]);
}

/** Largest clique (Bron–Kerbosch with pivoting). Its size ω(G) is a lower bound for χ(G). */
export function maxClique(graph) {
  let best = [];
  const bk = (R, P, X) => {
    if (P.size === 0 && X.size === 0) { if (R.length > best.length) best = [...R]; return; }
    let pivot = null, bestCount = -1;
    for (const u of [...P, ...X]) {
      const c = [...P].filter((v) => graph.adj[u].has(v)).length;
      if (c > bestCount) { bestCount = c; pivot = u; }
    }
    for (const v of [...P].filter((x) => !graph.adj[pivot].has(x))) {
      bk([...R, v], new Set([...P].filter((x) => graph.adj[v].has(x))), new Set([...X].filter((x) => graph.adj[v].has(x))));
      P.delete(v);
      X.add(v);
    }
  };
  bk([], new Set(graph.adj.map((_, i) => i)), new Set());
  return best;
}

export function connectedComponents(graph) {
  const seen = new Set();
  let count = 0;
  for (let s = 0; s < graph.n; s++) {
    if (seen.has(s)) continue;
    count++;
    const stack = [s];
    while (stack.length) {
      const v = stack.pop();
      if (seen.has(v)) continue;
      seen.add(v);
      graph.adj[v].forEach((u) => !seen.has(u) && stack.push(u));
    }
  }
  return count;
}

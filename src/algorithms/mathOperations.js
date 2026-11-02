// ============================================================
//  mathOperations.js – Discrete Mathematics helpers
//  Sets · Counting · Recursion · Number theory · Algebraic structures
// ============================================================

// ---------- Unit 1: Sets ----------
export const union = (a, b) => new Set([...a, ...b]);
export const intersection = (a, b) => new Set([...a].filter((x) => b.has(x)));
export const difference = (a, b) => new Set([...a].filter((x) => !b.has(x)));
export const symmetricDifference = (a, b) => union(difference(a, b), difference(b, a));
export const isSubset = (a, b) => [...a].every((x) => b.has(x));
export const isDisjoint = (a, b) => intersection(a, b).size === 0;

// ---------- Unit 2: Counting & recursion ----------
export function factorial(n) {
  let r = 1n;
  for (let i = 2; i <= n; i++) r *= BigInt(i);
  return r;
}
export const nPr = (n, r) => (r < 0 || r > n ? 0n : factorial(n) / factorial(n - r));
export const nCr = (n, r) => (r < 0 || r > n ? 0n : factorial(n) / (factorial(r) * factorial(n - r)));
export const power = (base, exp) => BigInt(base) ** BigInt(exp);

/** Recursive factorial that records its call trace (for the recursion demo). */
export function factorialRecursive(n, trace = [], depth = 0) {
  const pad = '  '.repeat(depth);
  if (n <= 1) {
    trace.push(`${pad}fact(${n}) = 1   (base case)`);
    return 1;
  }
  trace.push(`${pad}fact(${n}) = ${n} × fact(${n - 1})`);
  const r = n * factorialRecursive(n - 1, trace, depth + 1);
  trace.push(`${pad}fact(${n}) returns ${r}`);
  return r;
}

/** Recursive generation of permutations (limited so the UI never freezes). */
export function listPermutations(items, limit = 24) {
  const out = [];
  const rec = (rest, cur) => {
    if (out.length >= limit) return;
    if (rest.length === 0) { out.push(cur); return; }
    rest.forEach((x, i) => rec([...rest.slice(0, i), ...rest.slice(i + 1)], [...cur, x]));
  };
  rec(items, []);
  return out;
}

/** Pigeonhole principle: some box must contain at least ceil(items / boxes) items. */
export function pigeonhole(items, boxes) {
  return { atLeast: boxes > 0 ? Math.ceil(items / boxes) : Infinity };
}
/** k pairwise-conflicting exams need k distinct slots. */
export const cliqueFeasible = (cliqueSize, slots) => slots >= cliqueSize;

// ---------- Unit 4: Number theory ----------
export const mod = (a, m) => ((a % m) + m) % m;
export const divides = (d, n) => d !== 0 && n % d === 0;
export const gcd = (a, b) => (b === 0 ? Math.abs(a) : gcd(b, a % b));
export const isCongruent = (a, b, m) => mod(a - b, m) === 0;
export function modInverse(a, m) {
  for (let x = 1; x < m; x++) if (mod(a * x, m) === 1) return x;
  return null;
}
/** Cyclic slot index: (i + shift) mod n */
export const cyclicSlot = (i, shift, n) => mod(i + shift, n);

// ---------- Unit 3: Algebraic structures ----------
export function analyzeStructure(elements, op) {
  const has = (x) => elements.includes(x);
  let closed = true, comm = true, assoc = true;
  for (const a of elements) {
    for (const b of elements) {
      const r = op(a, b);
      if (!has(r)) closed = false;
      if (r !== op(b, a)) comm = false;
      for (const c of elements) if (op(op(a, b), c) !== op(a, op(b, c))) assoc = false;
    }
  }
  let identity = null;
  for (const e of elements) {
    if (elements.every((a) => op(e, a) === a && op(a, e) === a)) { identity = e; break; }
  }
  let inverses = null;
  if (identity !== null) {
    inverses = {};
    for (const a of elements) {
      const inv = elements.find((b) => op(a, b) === identity && op(b, a) === identity);
      inverses[a] = inv === undefined ? null : inv;
    }
  }
  const hasInverses = !!inverses && Object.values(inverses).every((v) => v !== null);
  return { closed, assoc, comm, identity, inverses, hasInverses, isGroup: closed && assoc && identity !== null && hasInverses };
}

/* 状态判定：先看矩阵结构（极差 → 纯鞍点 → 混合均衡），再按结构定状态、按量级定强度。
   深度分 =（列极小极大 − 行极大极小）/ 2：均衡面前纯策略打法能榨出多少，
   只有混合均衡才有深度。判定顺序不能换：先排除极差近 0 的退化表，
   否则「全 0.9」这种表会被判成「唯一最优」。 */

const EPS = 1e-9;

function matrixOf(cells, pick) {
  return cells.map((row) => row.map((cell) => {
    if (pick === "full") return { score: cell.n ? (cell.a + 0.5 * cell.d) / cell.n : 0, n: cell.n };
    const h = cell.halves[pick];
    return { score: h.n ? (h.a + 0.5 * h.d) / h.n : 0, n: h.n };
  }));
}

function toScores(m) {
  return m.map((row) => row.map((c) => (typeof c === "object" ? c.score : c)));
}

function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((row, i) => row.concat(b[i]));
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-12) return null;
    if (piv !== col) {
      const t = M[col];
      M[col] = M[piv];
      M[piv] = t;
    }
    const d = M[col][col];
    for (let j = col; j <= n; j++) M[col][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      if (f === 0) continue;
      for (let j = col; j <= n; j++) M[r][j] -= f * M[col][j];
    }
  }
  return M.map((row) => row[n]);
}

function subsets(n) {
  const out = [];
  for (let mask = 1; mask < 1 << n; mask++) {
    const s = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) s.push(i);
    out.push(s);
  }
  return out;
}

/* 二人零和混合均衡：支撑枚举 + 解线性方程组。
   行方最大化，收益矩阵 M；返回 { S, T, x, y, v }，取总支撑最小者；
   数值退化时返回 null。无纯鞍点的零和矩阵必有双方支撑 ≥2 的均衡。 */
export function solveMixed(m) {
  const M = toScores(m);
  const rows = M.length;
  const cols = M[0].length;
  let best = null;
  for (const S of subsets(rows)) {
    for (const T of subsets(cols)) {
      const s = S.length;
      const t = T.length;
      if (s + t < 3) continue;
      const N = s + t;
      const A = Array.from({ length: N }, () => new Array(N).fill(0));
      const b = new Array(N).fill(0);
      let r = 0;
      for (let k = 1; k < t; k++, r++) {
        for (let u = 0; u < s; u++) A[r][u] = M[S[u]][T[k]] - M[S[u]][T[0]];
      }
      for (let k = 1; k < s; k++, r++) {
        for (let u = 0; u < t; u++) A[r][s + u] = M[S[k]][T[u]] - M[S[0]][T[u]];
      }
      for (let u = 0; u < s; u++) A[r][u] = 1;
      b[r] = 1;
      r += 1;
      for (let u = 0; u < t; u++) A[r][s + u] = 1;
      b[r] = 1;
      r += 1;
      const sol = solveLinear(A, b);
      if (!sol) continue;
      const x = sol.slice(0, s);
      const y = sol.slice(s);
      if (x.some((v) => v < 1e-8) || y.some((v) => v < 1e-8)) continue;
      let v = 0;
      for (let u = 0; u < s; u++) for (let k = 0; k < t; k++) v += x[u] * y[k] * M[S[u]][T[k]];
      let ok = true;
      /* 列是极小化方：偏离到 j 只有当行方收益低于 v 才有利 → val < v 则无效 */
      for (let j = 0; j < cols; j++) {
        if (T.includes(j)) continue;
        let val = 0;
        for (let u = 0; u < s; u++) val += x[u] * M[S[u]][j];
        if (val < v - EPS) { ok = false; break; }
      }
      /* 行是极大化方：偏离到 i 只有当收益高于 v 才有利 → val > v 则无效 */
      if (ok) {
        for (let i = 0; i < rows; i++) {
          if (S.includes(i)) continue;
          let val = 0;
          for (let k = 0; k < t; k++) val += M[i][T[k]] * y[k];
          if (val > v + EPS) { ok = false; break; }
        }
      }
      if (!ok) continue;
      if (!best || s + t < best.S.length + best.T.length) best = { S, T, x, y, v };
    }
  }
  return best;
}

/* 严格支配（带裕量）：被支配的打法单列上报，给设计看 */
export function dominatedStats(m, margin = 0.02) {
  const M = toScores(m);
  const rows = [];
  for (let i = 0; i < M.length; i++) {
    for (let k = 0; k < M.length; k++) {
      if (k === i) continue;
      if (M[i].every((v, j) => v + margin < M[k][j])) { rows.push(i); break; }
    }
  }
  const cols = [];
  for (let j = 0; j < M[0].length; j++) {
    for (let k = 0; k < M[0].length; k++) {
      if (k === j) continue;
      if (M.every((row) => row[k] + margin < row[j])) { cols.push(j); break; }
    }
  }
  return { rows, cols };
}

function labelOf(m, options = {}) {
  const rows = m.length;
  const cols = m[0].length;
  const flatThreshold = options.flatThreshold == null ? 0.05 : options.flatThreshold;
  const gapThreshold = options.gapThreshold == null ? 0.10 : options.gapThreshold;
  const strongGap = options.strongGap == null ? 0.25 : options.strongGap;
  const depthStrong = options.depthStrong == null ? 0.25 : options.depthStrong;
  const depthMid = options.depthMid == null ? 0.10 : options.depthMid;
  const edgeThreshold = options.edgeThreshold == null ? 0.2 : options.edgeThreshold;

  const scores = m.flat().map((c) => c.score);
  const spread = Math.max(...scores) - Math.min(...scores);
  const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
  const rowMin = m.map((row) => Math.min(...row.map((c) => c.score)));
  const colMax = [];
  for (let j = 0; j < cols; j++) {
    let hi = -Infinity;
    for (let i = 0; i < rows; i++) hi = Math.max(hi, m[i][j].score);
    colMax.push(hi);
  }
  const rowMaximin = Math.max(...rowMin);
  const colMinimax = Math.min(...colMax);
  const depth = (colMinimax - rowMaximin) / 2;

  const brRows = new Set();
  const brCols = new Set();
  for (let j = 0; j < cols; j++) for (let i = 0; i < rows; i++) {
    if (Math.abs(m[i][j].score - colMax[j]) <= EPS) brRows.add(i);
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    if (Math.abs(m[i][j].score - rowMin[i]) <= EPS) brCols.add(j);
  }
  const support = [brRows.size, brCols.size];
  const dominated = dominatedStats(m);
  const base = {
    depth: +depth.toFixed(4),
    dominated: { rows: dominated.rows, cols: dominated.cols }
  };

  /* 1. 极差近 0：策略选择几乎不改变结果 */
  if (spread < flatThreshold) {
    if (Math.abs(mean - 0.5) >= edgeThreshold) {
      return {
        ...base,
        state: "静止",
        mode: "策略无关",
        strength: null,
        gap: null,
        cell: null,
        spread: +spread.toFixed(4),
        edge: +Math.abs(mean - 0.5).toFixed(4),
        support
      };
    }
    return {
      ...base,
      state: "开放",
      mode: "平坦",
      strength: null,
      gap: null,
      cell: null,
      spread: +spread.toFixed(4),
      support
    };
  }

  /* 2. 纯鞍点：行极小且列极大 */
  const saddles = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const v = m[i][j].score;
      if (Math.abs(v - rowMin[i]) <= EPS && Math.abs(v - colMax[j]) <= EPS) saddles.push({ i, j, v });
    }
  }
  if (saddles.length) {
    saddles.sort((x, y) => y.v - x.v);
    const chosen = saddles[0];
    const winners = rowMin.filter((v) => Math.abs(v - rowMaximin) <= EPS).length;
    let secondFloor = -Infinity;
    for (const v of rowMin) if (v < rowMaximin - EPS && v > secondFloor) secondFloor = v;
    /* 优势 = 最好行保底 − 其余行里最好的保底；并列最优不算第二名。
       不能用「与最差行保底的差」：那样把最差打法的坏算进最好打法的好。 */
    const advantage = secondFloor === -Infinity ? 0 : rowMaximin - secondFloor;
    if (advantage >= gapThreshold) {
      return {
        ...base,
        state: "静止",
        mode: winners === 1 ? "唯一最优" : "多重最优",
        strength: advantage >= strongGap ? "强" : "中",
        gap: +advantage.toFixed(4),
        edge: +Math.abs(chosen.v - 0.5).toFixed(4),
        cell: [chosen.i, chosen.j],
        value: +chosen.v.toFixed(4),
        spread: +spread.toFixed(4),
        support
      };
    }
    const rowSpread = Math.max(...rowMin) - Math.min(...rowMin);
    const colSpread = Math.max(...colMax) - Math.min(...colMax);
    const mode = rowSpread <= EPS ? "单向·甲方无选择"
      : (colSpread <= EPS ? "单向·乙方无选择" : "弱鞍点");
    return {
      ...base,
      state: "开放",
      mode,
      strength: null,
      gap: +advantage.toFixed(4),
      cell: [chosen.i, chosen.j],
      spread: +spread.toFixed(4),
      support
    };
  }

  /* 3. 无鞍点 → 混合均衡：双方支撑都 ≥2，是真克制循环 */
  const eq = solveMixed(m);
  if (eq) {
    return {
      ...base,
      state: "封闭",
      strength: depth >= depthStrong ? "强" : (depth >= depthMid ? "中" : "弱"),
      gap: null,
      cell: null,
      value: +eq.v.toFixed(4),
      spread: +spread.toFixed(4),
      support: [eq.S.length, eq.T.length],
      maximin: +rowMaximin.toFixed(4),
      maximax: +colMinimax.toFixed(4)
    };
  }
  return {
    ...base,
    state: "封闭",
    strength: depth >= depthMid ? "中" : "弱",
    gap: null,
    cell: null,
    value: null,
    spread: +spread.toFixed(4),
    support
  };
}

/* 统一均衡入口：有纯鞍点给纯均衡，否则支撑枚举求混合均衡。
   训练循环与判定器共用；返回 { S, T, x, y, v, pure }。 */
export function nashOf(m) {
  const rows = m.length;
  const cols = m[0].length;
  const rowMin = m.map((row) => Math.min(...row.map((c) => (typeof c === "object" ? c.score : c))));
  const colMax = [];
  for (let j = 0; j < cols; j++) {
    let hi = -Infinity;
    for (let i = 0; i < rows; i++) hi = Math.max(hi, m[i][j] && typeof m[i][j] === "object" ? m[i][j].score : m[i][j]);
    colMax.push(hi);
  }
  const saddles = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const v = typeof m[i][j] === "object" ? m[i][j].score : m[i][j];
      if (Math.abs(v - rowMin[i]) <= EPS && Math.abs(v - colMax[j]) <= EPS) saddles.push({ i, j, v });
    }
  }
  if (saddles.length) {
    saddles.sort((x, y) => y.v - x.v);
    const s = saddles[0];
    const x = new Array(rows).fill(0);
    const y = new Array(cols).fill(0);
    x[s.i] = 1;
    y[s.j] = 1;
    return { S: [s.i], T: [s.j], x, y, v: s.v, pure: true };
  }
  return solveMixed(m);
}

/* Wilson 区间（与 matrix.mjs 的 wilson 同式；analyze 保持无依赖，这里局部实现） */
function wilsonLocal(wins, n, z = 1.96) {
  if (!n) return { p: 0, lo: 0, hi: 1 };
  const p = wins / n;
  const denom = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return { p, lo: Math.max(0, centre - half), hi: Math.min(1, centre + half) };
}

/* 灵敏性：每格用 Wilson 区间下/上端点重判，看结论是否翻转 */
export function sensitivityOf(cells, verdict, options = {}) {
  const build = (pick) => cells.map((row) => row.map((cell) => {
    const n = cell.n;
    const w = n ? cell.a + 0.5 * cell.d : 0;
    const ci = wilsonLocal(w, n);
    return { score: ci[pick], n };
  }));
  const loLabel = labelOf(build("lo"), options);
  const hiLabel = labelOf(build("hi"), options);
  const lo = [loLabel.state, loLabel.mode || loLabel.state];
  const hi = [hiLabel.state, hiLabel.mode || hiLabel.state];
  return {
    lo,
    hi,
    stable: lo[0] === hi[0] && lo[0] === verdict.state
  };
}

export function classify(cells, options = {}) {
  const full = labelOf(matrixOf(cells, "full"), options);
  const hasHalves = cells.every((row) => row.every((c) => c.halves[0].n > 0 && c.halves[1].n > 0));
  const first = hasHalves ? labelOf(matrixOf(cells, 0), options) : full;
  const second = hasHalves ? labelOf(matrixOf(cells, 1), options) : full;
  const stable = first.state === second.state;
  let resolve = "solid";
  if (!stable) resolve = "underpowered";
  else if (full.state === "开放" && full.mode === "平坦") resolve = "flat";
  return {
    ...full,
    stable,
    resolve,
    halves: [first.state, second.state]
  };
}

/* 自检用的构造矩阵 */
export function classifyMatrix(matrix, options = {}) {
  const cells = matrix.map((row) => row.map((v) => ({
    n: 400,
    a: Math.round(v * 400),
    b: Math.round((1 - v) * 400),
    d: 0,
    halves: [
      { n: 200, a: Math.round(v * 200), b: Math.round((1 - v) * 200), d: 0 },
      { n: 200, a: Math.round(v * 200), b: Math.round((1 - v) * 200), d: 0 }
    ]
  })));
  return classify(cells, options);
}

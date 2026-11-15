/* 状态判定：只看矩阵的形状，不看训练过程。
   静止 = 存在鞍点（双方都不想换招）
   封闭 = 无鞍点且收益极差大（克制循环）
   开放 = 无鞍点且所有格子挤在一起（策略无差别） */

function matrixOf(cells, pick) {
  return cells.map((row) => row.map((cell) => {
    if (pick === "full") return { score: cell.n ? (cell.a + 0.5 * cell.d) / cell.n : 0, n: cell.n };
    const h = cell.halves[pick];
    return { score: h.n ? (h.a + 0.5 * h.d) / h.n : 0, n: h.n };
  }));
}

function labelOf(m, options = {}) {
  const rows = m.length;
  const cols = m[0].length;
  const flatThreshold = options.flatThreshold == null ? 0.15 : options.flatThreshold;
  const strongGap = options.strongGap == null ? 0.1 : options.strongGap;
  const eps = 1e-9;

  const rowMax = m.map((row) => Math.max(...row.map((c) => c.score)));
  const rowMin = m.map((row) => Math.min(...row.map((c) => c.score)));
  const colMax = [];
  const colMin = [];
  for (let j = 0; j < cols; j++) {
    let hi = -Infinity;
    let lo = Infinity;
    for (let i = 0; i < rows; i++) {
      hi = Math.max(hi, m[i][j].score);
      lo = Math.min(lo, m[i][j].score);
    }
    colMax.push(hi);
    colMin.push(lo);
  }

  const saddles = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const v = m[i][j].score;
      const others = rowMin.filter((_, k) => k !== i);
      const gap = v - (others.length ? Math.max(...others) : 0);
      if (Math.abs(v - rowMin[i]) <= eps && Math.abs(v - colMax[j]) <= eps) {
        saddles.push({ i, j, v, gap });
      }
    }
  }

  const allScores = m.flat().map((c) => c.score);
  const spread = Math.max(...allScores) - Math.min(...allScores);

  const brRows = new Set();
  const brCols = new Set();
  for (let j = 0; j < cols; j++) for (let i = 0; i < rows; i++) {
    if (Math.abs(m[i][j].score - colMax[j]) <= eps) brRows.add(i);
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    if (Math.abs(m[i][j].score - rowMin[i]) <= eps) brCols.add(j);
  }

  /* 先看策略有没有影响。整张表挤在一起时：
     一边倒 → 死局（任何打法都改不了胜负，记静止）
     五五开 → 策略无差别（记开放·平坦） */
  if (spread < flatThreshold) {
    const avg = allScores.reduce((s, v) => s + v, 0) / allScores.length;
    if (Math.abs(avg - 0.5) >= 0.2) {
      return {
        state: "静止",
        mode: "策略无关",
        strength: "强",
        gap: null,
        cell: null,
        spread: +spread.toFixed(4),
        edge: +Math.abs(avg - 0.5).toFixed(4),
        support: [brRows.size, brCols.size]
      };
    }
    return {
      state: "开放",
      mode: "平坦",
      strength: null,
      gap: null,
      cell: null,
      spread: +spread.toFixed(4),
      support: [brRows.size, brCols.size]
    };
  }

  if (saddles.length) {
    saddles.sort((x, y) => y.v - x.v);
    const chosen = saddles[0];
    /* 优势 = 最好的那行的保底 − 最差那行的保底。
       不能用"与第二名的差"：两行并列必胜时那个差是 0，会被误判成没有最优解。 */
    const advantage = rowMax.length ? Math.max(...rowMin) - Math.min(...rowMin) : 0;
    const winners = rowMin.filter((v) => Math.abs(v - Math.max(...rowMin)) <= eps).length;
    if (advantage >= strongGap) {
      return {
        state: "静止",
        mode: winners === 1 ? "唯一最优" : "多重最优",
        strength: advantage >= 0.25 ? "强" : "中",
        gap: +advantage.toFixed(4),
        edge: +Math.abs(chosen.v - 0.5).toFixed(4),
        cell: [chosen.i, chosen.j],
        value: +chosen.v.toFixed(4),
        spread: +spread.toFixed(4),
        support: [brRows.size, brCols.size]
      };
    }
    /* 换招只值几个百分点，等于没有最优解 */
    const rowSpread = Math.max(...rowMin) - Math.min(...rowMin);
    const colSpread = Math.max(...colMax) - Math.min(...colMax);
    const mode = rowSpread <= eps ? "单向·甲方无选择" : (colSpread <= eps ? "单向·乙方无选择" : "弱鞍点");
    return {
      state: "开放",
      mode,
      strength: null,
      gap: +advantage.toFixed(4),
      cell: [chosen.i, chosen.j],
      spread: +spread.toFixed(4),
      support: [brRows.size, brCols.size]
    };
  }

  return {
    state: "封闭",
    strength: null,
    gap: null,
    cell: null,
    spread: +spread.toFixed(4),
    support: [brRows.size, brCols.size],
    maximin: +Math.max(...rowMin).toFixed(4),
    maximax: +Math.max(...rowMax).toFixed(4)
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
    n: 400, a: Math.round(v * 400), b: Math.round((1 - v) * 400), d: 0,
    halves: [
      { n: 200, a: Math.round(v * 200), b: Math.round((1 - v) * 200), d: 0 },
      { n: 200, a: Math.round(v * 200), b: Math.round((1 - v) * 200), d: 0 }
    ]
  })));
  return classify(cells, options);
}

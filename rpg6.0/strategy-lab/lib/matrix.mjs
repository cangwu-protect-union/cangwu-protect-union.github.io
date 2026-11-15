/* 胜率矩阵与置信区间。
   引擎对局经常是确定性的（同一对打法定胜负），所以加自适应采样：
   打到 minGames 局后如果全是一边倒，就提前收手并标记 certain。
   否则会把几千局花在同一件事上。 */
import { play } from "./battle.mjs";

export function wilson(wins, n, z = 1.96) {
  if (!n) return { p: 0, lo: 0, hi: 1 };
  const p = wins / n;
  const denom = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return { p, lo: Math.max(0, centre - half), hi: Math.min(1, centre + half) };
}

export function scoreOfCell(cell) {
  return cell.n ? (cell.a + 0.5 * cell.d) / cell.n : 0;
}

function emptyCell() {
  return { n: 0, a: 0, b: 0, d: 0, certain: false, halves: [{ n: 0, a: 0, b: 0, d: 0 }, { n: 0, a: 0, b: 0, d: 0 }] };
}

export function makeSeeds(count, base) {
  return Array.from({ length: count }, (_, i) => base + i * 37);
}

export function rateAgainst(B, charMine, charFoe, weightsMine, weightsFoe, seeds, options = {}) {
  let total = 0;
  let stalled = 0;
  for (const seed of seeds) {
    const row = play(B, charMine, charFoe, weightsMine, weightsFoe, seed, options);
    if (row.result === "a") total += 1;
    else if (row.result === "draw") { total += 0.5; if (row.stalled) stalled += 1; }
  }
  return { rate: total / seeds.length, stalled, games: seeds.length };
}

export function estimatePair(B, charA, charB, policiesA, policiesB, seeds, options = {}) {
  const minGames = options.minGames == null ? 40 : options.minGames;
  const adaptive = options.adaptive !== false;
  const cells = policiesA.map((wa) => policiesB.map((wb) => {
    const cell = emptyCell();
    for (let i = 0; i < seeds.length; i++) {
      const row = play(B, charA, charB, wa, wb, seeds[i], options);
      cell.n += 1;
      const half = cell.halves[i % 2];
      half.n += 1;
      if (row.result === "a") { cell.a += 1; half.a += 1; }
      else if (row.result === "b") { cell.b += 1; half.b += 1; }
      else { cell.d += 1; half.d += 1; }
      if (adaptive && cell.n >= minGames && (cell.a === cell.n || cell.b === cell.n || cell.d === cell.n)) {
        cell.certain = true;
        break;
      }
    }
    return cell;
  }));
  return {
    rows: policiesA.map((_, i) => "A" + i),
    cols: policiesB.map((_, i) => "B" + i),
    cells
  };
}

export function summarize(cells) {
  let n = 0;
  let a = 0;
  let b = 0;
  let d = 0;
  let certain = 0;
  let cellsCount = 0;
  for (const row of cells) for (const cell of row) {
    n += cell.n; a += cell.a; b += cell.b; d += cell.d;
    cellsCount += 1;
    if (cell.certain) certain += 1;
  }
  return {
    games: n,
    cells: cellsCount,
    certainCells: certain,
    winA: n ? a / n : 0,
    winB: n ? b / n : 0,
    draw: n ? d / n : 0
  };
}

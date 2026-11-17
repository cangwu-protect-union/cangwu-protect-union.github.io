/* 训练：双 oracle（PSRO-lite）。
   初始种群各 start 套（legacy 分档种子 + 随机规则策略）→ 经验矩阵求均衡混合 →
   双方各进化一个对混合的最佳回应 → 入池（上限 maxPop）→
   可榨取值 < eps 或迭代满即停。矩阵按策略对缓存、只采样新格，省重复局数。 */
import { nashOf } from "./analyze.mjs";
import { behaviorSignature } from "./battle.mjs";
import { makeSeeds, rateAgainst, sampleCell } from "./matrix.mjs";
import {
  crossoverPolicy, legacyPolicy, makeRng, mutatePolicy, policyKey,
  randomPolicy, randomWeights, readablePolicy
} from "./policy.mjs";

export function trainPair(B, charA, charB, options = {}) {
  const cfg = {
    oracles: options.oracles || 6,
    pop: options.pop || 10,
    screen: options.screen || 6,
    confirm: options.confirm || 12,
    brGens: options.gens || 5,
    start: options.strategies || 4,
    maxPop: options.maxPop || 8,
    matrixGames: options.matrixGames || 120,
    matrixMinGames: options.matrixMinGames || 40,
    eps: options.eps || 0.02,
    calib: options.calib || null,
    cap: options.cap || 400,
    baseSeed: options.baseSeed || 1000
  };
  const rnd = makeRng(cfg.baseSeed * 17 + charA.name.length * 31 + charB.name.length);
  const trace = [];

  const seedPop = () => {
    const out = [legacyPolicy(randomWeights(rnd))];
    while (out.length < cfg.start) out.push(randomPolicy(rnd));
    return out;
  };
  let polA = seedPop();
  let polB = seedPop();

  /* 增量矩阵：单元格按策略对缓存 */
  const cellCache = new Map();
  const matrixSeeds = makeSeeds(cfg.matrixGames, cfg.baseSeed + 31);
  const cellOf = (pa, pb) => {
    const key = policyKey(pa) + "|" + policyKey(pb);
    if (!cellCache.has(key)) {
      cellCache.set(key, sampleCell(B, charA, charB, pa, pb, matrixSeeds,
        { calib: cfg.calib, cap: cfg.cap, minGames: cfg.matrixMinGames, adaptive: true }));
    }
    return cellCache.get(key);
  };
  const matrixOf = () => polA.map((pa) => polB.map((pb) => cellOf(pa, pb)));
  const scoreMat = (cells) => cells.map((row) => row.map((c) => (c.n ? (c.a + 0.5 * c.d) / c.n : 0)));

  /* mine 用 cand 打 foe 的加权混合对手池，返回 mine 的胜率 */
  const evalMix = (mineChar, foeChar, cand, opps, seeds) => {
    let s = 0;
    for (const o of opps) {
      s += o.x * rateAgainst(B, mineChar, foeChar, cand, o.p, seeds, { calib: cfg.calib, cap: cfg.cap }).rate;
    }
    return s;
  };

  const bestResponse = (mineChar, foeChar, opps, salt, incumbent) => {
    let elites = [incumbent, legacyPolicy(randomWeights(rnd)), randomPolicy(rnd)];
    for (let gen = 1; gen <= cfg.brGens; gen++) {
      const sigma = gen <= 2 ? 0.2 : gen <= 4 ? 0.1 : 0.05;
      const pop = elites.slice();
      while (pop.length < cfg.pop) {
        const parent = elites[pop.length % Math.max(1, elites.length)];
        const partner = elites[(pop.length + 1) % Math.max(1, elites.length)];
        pop.push(rnd() < 0.5 ? mutatePolicy(parent, sigma, rnd) : crossoverPolicy(parent, partner, rnd));
      }
      const s1 = makeSeeds(cfg.screen, cfg.baseSeed + salt * 71 + gen * 5);
      const scored = pop.map((p) => ({ p, v: evalMix(mineChar, foeChar, p, opps, s1) }));
      scored.sort((x, y) => y.v - x.v);
      const finalists = scored.slice(0, 4);
      const s2 = makeSeeds(cfg.confirm, cfg.baseSeed + salt * 71 + gen * 5 + 13);
      for (const f of finalists) f.v = evalMix(mineChar, foeChar, f.p, opps, s2);
      finalists.sort((x, y) => y.v - x.v);
      elites = finalists.slice(0, 2).map((f) => f.p);
    }
    const sF = makeSeeds(cfg.confirm, cfg.baseSeed + salt * 71 + 101);
    return { p: elites[0], v: evalMix(mineChar, foeChar, elites[0], opps, sF) };
  };

  let eq = null;
  let stopReason = "";
  for (let iter = 1; iter <= cfg.oracles; iter++) {
    eq = nashOf(scoreMat(matrixOf()));
    const oppsA = polB.map((p, j) => ({ p, x: eq.y[j] || 0 })).filter((o) => o.x > 0.001);
    const oppsB = polA.map((p, i) => ({ p, x: eq.x[i] || 0 })).filter((o) => o.x > 0.001);
    const incA = polA[eq.x.indexOf(Math.max(...eq.x))];
    const incB = polB[eq.y.indexOf(Math.max(...eq.y))];
    const brA = bestResponse(charA, charB, oppsA, iter * 2, incA);
    const brB = bestResponse(charB, charA, oppsB, iter * 2 + 1, incB);
    const gainA = brA.v - eq.v;
    const gainB = brB.v - (1 - eq.v);
    const expl = Math.max(0, gainA) + Math.max(0, gainB);
    trace.push({ iter, v: +eq.v.toFixed(4), expl: +expl.toFixed(4), popA: polA.length, popB: polB.length });
    const dupA = polA.some((p) => policyKey(p) === policyKey(brA.p));
    const dupB = polB.some((p) => policyKey(p) === policyKey(brB.p));
    if (expl < cfg.eps) { stopReason = "converged"; break; }
    if (dupA && dupB) { stopReason = "br-dup"; break; }
    if (!dupA && polA.length < cfg.maxPop) polA.push(brA.p);
    if (!dupB && polB.length < cfg.maxPop) polB.push(brB.p);
    if (polA.length >= cfg.maxPop && polB.length >= cfg.maxPop) { stopReason = "pop-cap"; break; }
  }

  /* 终局矩阵与均衡（含新加策略） */
  const cells = matrixOf();
  const eqF = nashOf(scoreMat(cells));
  const pack = (sidePolicies, mineChar, foeChar, opps) => sidePolicies.map((p, i) => {
    const seeds = makeSeeds(cfg.confirm, cfg.baseSeed + 611 + i);
    const profile = opps.map((o) => rateAgainst(B, mineChar, foeChar, p, o.p, seeds, { calib: cfg.calib, cap: cfg.cap }).rate);
    const min = Math.min(...profile);
    const obj = opps.reduce((s, o, k) => s + o.x * profile[k], 0);
    return {
      id: mineChar.name + ".vs." + foeChar.name + "." + i,
      w: p,
      obj: +obj.toFixed(3),
      min: +min.toFixed(3),
      signature: behaviorSignature(B, mineChar, foeChar, p, makeSeeds(4, cfg.baseSeed + 7), cfg.calib),
      readable: readablePolicy(p)
    };
  });

  const oppsA = polB.map((p, j) => ({ p, x: eqF.y[j] || 0 }));
  const oppsB = polA.map((p, i) => ({ p, x: eqF.x[i] || 0 }));
  const packedA = pack(polA, charA, charB, oppsA);
  const packedB = pack(polB, charB, charA, oppsB);
  const meta = {
    v: +eqF.v.toFixed(4),
    x: eqF.x.map((v) => +v.toFixed(4)),
    y: eqF.y.map((v) => +v.toFixed(4)),
    pure: eqF.pure === true,
    iterations: trace.length,
    stopReason,
    exploitability: trace.length ? trace[trace.length - 1].expl : null
  };
  return { a: packedA, b: packedB, trace, meta };
}

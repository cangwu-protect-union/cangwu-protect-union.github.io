/* 训练：双方轮流练，对手是「当前 3 套 + 历史库抽样 3 套」的混合池。
   目标函数 0.75·最差胜率 + 0.25·平均胜率：纯 maximin 会练出只针对当前三套的偏科打法，
   掺四分之一平均胜率能把它拉回来。 */
import { behaviorSignature } from "./battle.mjs";
import { makeSeeds, rateAgainst } from "./matrix.mjs";
import { makeRng, mutateWeights, randomWeights, readableRules, weightsKey } from "./policy.mjs";

export function trainPair(B, charA, charB, options = {}) {
  const cfg = {
    gens: options.gens || 4,
    pop: options.pop || 12,
    screen: options.screen || 6,
    confirm: options.confirm || 16,
    rounds: options.rounds || 2,
    strategies: options.strategies || 3,
    poolHistory: options.poolHistory || 3,
    calib: options.calib || null,
    cap: options.cap || 400,
    baseSeed: options.baseSeed || 1000
  };
  const trace = [];
  const rnd = makeRng(cfg.baseSeed * 17 + charA.name.length * 31 + charB.name.length);
  const asWeights = (p) => (Array.isArray(p) ? p : p.w);
  const history = { a: [], b: [] };

  let polA = [];
  let polB = [];
  for (let i = 0; i < cfg.strategies; i++) {
    polA.push(randomWeights(rnd));
    polB.push(randomWeights(rnd));
  }

  const poolFor = (mineSide) => {
    const foeSide = mineSide === "a" ? "b" : "a";
    const current = (foeSide === "a" ? polA : polB).map(asWeights);
    const past = history[foeSide].slice(-cfg.poolHistory).map(asWeights);
    const seen = new Set();
    const out = [];
    for (const w of current.concat(past)) {
      const key = weightsKey(w);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(w);
    }
    return out;
  };

  const evalVs = (mineChar, foeChar, w, pool, games, salt) => {
    const seeds = makeSeeds(games, cfg.baseSeed + salt * 137);
    let min = 1;
    let sum = 0;
    for (const foe of pool) {
      const r = rateAgainst(B, mineChar, foeChar, w, foe, seeds, { calib: cfg.calib, cap: cfg.cap });
      min = Math.min(min, r.rate);
      sum += r.rate;
    }
    const mean = pool.length ? sum / pool.length : 0;
    return { min, mean, obj: 0.75 * min + 0.25 * mean };
  };

  for (let round = 1; round <= cfg.rounds; round++) {
    for (const side of ["a", "b"]) {
      const isA = side === "a";
      const mineChar = isA ? charA : charB;
      const foeChar = isA ? charB : charA;
      const pool = poolFor(side);
      let elites = (isA ? polA : polB).map(asWeights);

      for (let gen = 1; gen <= cfg.gens; gen++) {
        const sigma = gen <= 2 ? 0.2 : gen <= 4 ? 0.1 : 0.05;
        const population = elites.slice(0, cfg.strategies);
        while (population.length < cfg.pop) {
          if (population.length < cfg.strategies * 5) {
            const parent = elites[population.length % Math.max(1, elites.length)];
            population.push(mutateWeights(parent, sigma, rnd));
          } else {
            population.push(randomWeights(rnd));
          }
        }

        /* 两段评估：先粗筛一半，再对晋级的一半加局数 */
        const stage1 = population.map((w, i) => ({ w, i, ...evalVs(mineChar, foeChar, w, pool, cfg.screen, gen * 2) }));
        stage1.sort((x, y) => y.obj - x.obj);
        const finalists = stage1.slice(0, Math.max(cfg.strategies, Math.ceil(cfg.pop / 2)));
        for (const item of finalists) Object.assign(item, evalVs(mineChar, foeChar, item.w, pool, cfg.confirm, gen * 2 + 1));
        finalists.sort((x, y) => y.obj - x.obj);
        elites = finalists.slice(0, cfg.strategies).map((s) => s.w);
        trace.push({ round, side, gen, best: +finalists[0].obj.toFixed(3), pool: pool.length });
      }

      history[side] = history[side].concat(elites).slice(-9);

      /* 多样性选择：矩阵里必须有"最强的"和"行为最不同的"。
         只取收敛后的前 3 名会让三套打法行为趋同，整张矩阵极差为 0。 */
      const seeds = makeSeeds(cfg.confirm, cfg.baseSeed + (cfg.gens + 1) * 137);
      const candidates = [];
      const seenKeys = new Set();
      const addCand = (w) => {
        const key = weightsKey(w);
        if (seenKeys.has(key)) return;
        seenKeys.add(key);
        const profile = pool.map((foe) => rateAgainst(B, mineChar, foeChar, w, foe, seeds, { calib: cfg.calib, cap: cfg.cap }).rate);
        const min = Math.min(...profile);
        const mean = profile.reduce((s, v) => s + v, 0) / profile.length;
        candidates.push({
          w,
          profile,
          min,
          mean,
          obj: 0.75 * min + 0.25 * mean,
          sig: behaviorSignature(B, mineChar, foeChar, w, makeSeeds(4, cfg.baseSeed + 7), cfg.calib)
        });
      };
      elites.forEach(addCand);
      history[side].slice(-6).forEach(addCand);
      for (let k = 0; k < 8; k++) addCand(randomWeights(rnd));

      candidates.sort((x, y) => y.obj - x.obj);
      const kept = [candidates[0]];
      while (kept.length < cfg.strategies) {
        let pick = null;
        let pickScore = -Infinity;
        for (const cand of candidates) {
          if (kept.some((x) => x.sig === cand.sig)) continue;
          const dist = Math.min(...kept.map((x) => x.profile.reduce((s, v, i) => s + Math.abs(v - cand.profile[i]), 0)));
          const score = dist * 2 + cand.obj;
          if (score > pickScore) { pickScore = score; pick = cand; }
        }
        if (!pick) break;
        kept.push(pick);
      }
      while (kept.length < cfg.strategies) kept.push(candidates[kept.length % candidates.length]);

      const packed = kept.map((item, i) => ({
        id: (isA ? charA.name : charB.name) + ".vs." + (isA ? charB.name : charA.name) + "." + i,
        w: item.w,
        obj: +item.obj.toFixed(3),
        min: +item.min.toFixed(3),
        signature: item.sig,
        readable: readableRules(item.w)
      }));
      if (isA) polA = packed; else polB = packed;
    }
  }

  return { a: polA, b: polB, trace };
}

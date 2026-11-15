/* 打分策略：按自身血量分三档，每档 6 个偏好权重，共 18 个参数。
   分档是为了让"血少了才换打法"这类分叉能被搜索出来。 */
export const TIERS = 3;
export const FEATURES = 6;
export const WEIGHT_COUNT = TIERS * FEATURES;

export const TIER_NAMES = ["血量≥60%", "血量30%–60%", "血量<30%"];

export function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export function randomWeights(rnd) {
  const w = [];
  for (let i = 0; i < WEIGHT_COUNT; i++) w.push(Math.round(rnd() * 1000) / 1000);
  return w;
}

export function mutateWeights(w, sigma, rnd) {
  return w.map((v) => {
    if (rnd() >= 0.5) return v;
    const next = v + (rnd() * 2 - 1) * sigma;
    return Math.round(Math.max(0, Math.min(1, next)) * 1000) / 1000;
  });
}

export function weightsKey(w) {
  return w.map((v) => v.toFixed(2)).join(",");
}

export function tierOf(B, unit) {
  const ratio = unit.hp / Math.max(1, B.state.maxHpOf(unit));
  if (ratio < 0.3) return 2;
  if (ratio < 0.6) return 1;
  return 0;
}

function mitigate(B, type, raw, foe) {
  if (!foe) return Math.max(0, raw);
  if (type === "phys") return Math.max(0, raw - B.state.defOf(foe));
  if (type === "magic") return Math.max(0, raw / 100 * (100 - B.state.mresOf(foe)));
  return Math.max(0, raw);
}

function foeOf(B, state, unit, action) {
  const uid = action.target || B.state.otherUid(state, unit.uid);
  try {
    return B.state.unitOf(state, uid);
  } catch {
    return null;
  }
}

export function estimate(B, state, unit, action, calib) {
  const foe = foeOf(B, state, unit, action);
  const foeHp = foe ? Math.max(1, foe.hp) : 1;
  const out = { dmg: 0, heal: 0, gain: 0, cost: 0, kills: 0, waste: 0 };

  if (action.kind === "basic") {
    if (action.type === "attack") {
      const type = B.traits.basicType(unit);
      out.dmg = mitigate(B, type, B.state.statOf(unit, "atk"), foe);
    } else if (action.type === "break") {
      out.gain = 0.5;
    } else if (action.type === "chargeMp") {
      out.gain = 1 / Math.max(1, B.state.maxMpOf(unit));
    }
  } else {
    const skill = B.skills.find(action.skillId);
    if (skill) {
      if (skill.cost && skill.cost.mp) out.cost += skill.cost.mp / Math.max(1, B.state.maxMpOf(unit));
      if (skill.charge) out.cost += 0.3;
    }
    const row = skill && calib && calib.entries ? calib.entries[skill.id] : null;
    if (!row || row.error || row.skip) {
      out.gain = 0.3;
    } else {
      const scale = row.atk ? B.state.statOf(unit, "atk") / row.atk : 1;
      const type = row.mixed ? "true" : (row.types[0] || "true");
      out.dmg = mitigate(B, type, (row.dmg || 0) * scale, foe);
      out.heal = (row.selfGain || 0) * scale;
      if (!row.dmg && !row.selfGain) out.gain = row.delayed ? 0.5 : 0.4;
    }
  }
  out.kills = out.dmg >= foeHp ? 1 : 0;
  out.ratio = Math.min(1, out.dmg / foeHp);
  out.waste = (out.ratio < 0.05 && !out.heal && !out.gain) ? 1 : 0;
  return out;
}

export function scoreOf(B, state, unit, action, w, calib) {
  const est = estimate(B, state, unit, action, calib);
  const hpMax = Math.max(1, B.state.maxHpOf(unit));
  const base = tierOf(B, unit) * FEATURES;
  return w[base] * est.ratio
    + w[base + 1] * est.kills
    + w[base + 2] * Math.min(1, est.heal / hpMax)
    + w[base + 3] * est.gain
    - w[base + 4] * est.cost
    - w[base + 5] * est.waste;
}

export function choose(B, state, list, weights, calib, rnd) {
  const unit = B.state.unitOf(state, state.turnUid);
  let best = -Infinity;
  const ties = [];
  for (const action of list) {
    const score = scoreOf(B, state, unit, action, weights, calib);
    if (score > best + 1e-9) {
      best = score;
      ties.length = 0;
      ties.push(action);
    } else if (Math.abs(score - best) <= 1e-9) {
      ties.push(action);
    }
  }
  if (!ties.length) return list[0];
  if (ties.length === 1) return ties[0];
  return ties[Math.floor(rnd() * ties.length) % ties.length];
}

/* 把 18 个权重翻译成三档规则句子 */
export function readableRules(w) {
  const names = ["伤害", "补刀", "回血", "攒资源", "省消耗", "避空转"];
  const lines = [];
  for (let t = 0; t < TIERS; t++) {
    const slice = w.slice(t * FEATURES, (t + 1) * FEATURES);
    const ranked = slice.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
    const top = ranked[0];
    const low = ranked[ranked.length - 1];
    let text = TIER_NAMES[t] + "：" + names[top.i] + "优先";
    if (low.v < 0.25) text += "，" + names[low.i] + "最不看重";
    lines.push(text);
  }
  return lines;
}

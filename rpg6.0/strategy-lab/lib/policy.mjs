/* 打分策略：条件规则表。
   策略 = 默认权重 + 至多 MAX_RULES 条「条件→权重」规则，自上而下命中。
   条件池见 CONDITIONS，特征全部能从引擎状态直接读出。
   旧的 18 权重（3 档血量 × 6 特征）是本空间的真子集：legacyPolicy 把它
   转成 3 条按血量分档的规则，作为种子个体保证新空间不退化。 */
export const TIERS = 3;
export const FEATURES = 6;
export const WEIGHT_COUNT = TIERS * FEATURES;
export const MAX_RULES = 4;
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

function randomWeight6(rnd) {
  const w = [];
  for (let i = 0; i < FEATURES; i++) w.push(Math.round(rnd() * 1000) / 1000);
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

/* 6 维打分（不带血量分档，档位由规则的条件承担） */
export function scoreOf6(B, state, unit, action, w, calib) {
  const est = estimate(B, state, unit, action, calib);
  const hpMax = Math.max(1, B.state.maxHpOf(unit));
  return w[0] * est.ratio
    + w[1] * est.kills
    + w[2] * Math.min(1, est.heal / hpMax)
    + w[3] * est.gain
    - w[4] * est.cost
    - w[5] * est.waste;
}

/* 旧的 18 权重打分，保留给 legacy 数组策略 */
export function scoreOf(B, state, unit, action, w, calib) {
  const base = tierOf(B, unit) * FEATURES;
  return scoreOf6(B, state, unit, action, w.slice(base, base + FEATURES), calib);
}

/* 条件池：f 是特征名，values 是可选值，labels 是翻译用词 */
export const CONDITIONS = {
  selfHp: { label: "我方血量", values: ["hi", "mid", "lo"], labels: { hi: "我方血量≥60%", mid: "我方血量30%–60%", lo: "我方血量<30%" } },
  foeHp: { label: "对方血量", values: ["hi", "mid", "lo"], labels: { hi: "对方血量≥60%", mid: "对方血量30%–60%", lo: "对方血量<30%" } },
  foeTaunt: { label: "对方嘲讽", values: [true], labels: { true: "对方有嘲讽" } },
  selfMp: { label: "我方蓝量", values: ["hi", "lo"], labels: { hi: "我方蓝量≥50%", lo: "我方蓝量<50%" } },
  round: { label: "回合", values: ["early", "late"], labels: { early: "前 2 回合", late: "第 3 回合起" } },
  foeLastAct: { label: "对方上一步", values: ["attack", "break", "charge", "skill"], labels: { attack: "对方刚普攻", break: "对方刚击溃", charge: "对方刚蓄力", skill: "对方刚放技能" } },
  summonAlive: { label: "我方召唤物", values: [true], labels: { true: "我方召唤物在场" } },
  foeBreakNear: { label: "对方击溃值", values: [true], labels: { true: "对方即将被击溃" } }
};

export function featuresOf(B, state, unit, ctx) {
  const foeUid = B.state.otherUid(state, unit.uid);
  const foe = B.state.unitOf(state, foeUid);
  const mySide = B.state.sideOf(state, unit.uid);
  const enemySide = B.state.otherSide(state, mySide);
  const taunt = !!(B.skills.maxTauntUids && B.skills.maxTauntUids(state, enemySide).length);
  return {
    selfHp: ["hi", "mid", "lo"][tierOf(B, unit)],
    foeHp: foe ? ["hi", "mid", "lo"][tierOf(B, foe)] : "hi",
    foeTaunt: taunt,
    selfMp: unit.mp >= Math.max(1, B.state.maxMpOf(unit)) / 2 ? "hi" : "lo",
    round: state.round <= 2 ? "early" : "late",
    foeLastAct: (ctx && ctx.foeLastAct) || null,
    summonAlive: B.state.summonsOf(state, mySide).some((s) => s.hp > 0),
    foeBreakNear: !!(foe && typeof foe.breakValue === "number" && B.rules.CONFIG && foe.breakValue >= B.rules.CONFIG.breakValueMax - 1)
  };
}

function matchRule(policy, f) {
  for (const rule of policy.rules) {
    let hit = true;
    for (const c of rule.when) {
      if (f[c.f] !== c.v) { hit = false; break; }
    }
    if (hit) return rule.w;
  }
  return policy.base;
}

/* policy 可以是旧 18 权重数组，也可以是 { base, rules } 对象 */
export function choose(B, state, list, policy, calib, rnd, ctx) {
  const unit = B.state.unitOf(state, state.turnUid);
  let weights;
  if (Array.isArray(policy)) {
    const base = tierOf(B, unit) * FEATURES;
    weights = policy.slice(base, base + FEATURES);
  } else {
    weights = matchRule(policy, featuresOf(B, state, unit, ctx));
  }
  let best = -Infinity;
  const ties = [];
  for (const action of list) {
    const score = scoreOf6(B, state, unit, action, weights, calib);
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

/* 旧 18 权重 → 3 条按血量分档的规则 */
export function legacyPolicy(w18) {
  return {
    base: w18.slice(0, FEATURES),
    rules: [
      { when: [{ f: "selfHp", v: "hi" }], w: w18.slice(0, FEATURES) },
      { when: [{ f: "selfHp", v: "mid" }], w: w18.slice(FEATURES, 2 * FEATURES) },
      { when: [{ f: "selfHp", v: "lo" }], w: w18.slice(2 * FEATURES) }
    ]
  };
}

function randomRule(rnd) {
  const feats = Object.keys(CONDITIONS);
  const count = 1 + Math.floor(rnd() * 2);
  const when = [];
  const used = new Set();
  while (when.length < count) {
    const f = feats[Math.floor(rnd() * feats.length)];
    if (used.has(f)) continue;
    used.add(f);
    const pool = CONDITIONS[f].values;
    when.push({ f, v: pool[Math.floor(rnd() * pool.length)] });
  }
  return { when, w: randomWeight6(rnd) };
}

export function randomPolicy(rnd) {
  const rules = [];
  const count = Math.floor(rnd() * 3);
  for (let i = 0; i < count; i++) rules.push(randomRule(rnd));
  return { base: randomWeight6(rnd), rules };
}

function perturb(w, sigma, rnd) {
  for (let i = 0; i < w.length; i++) {
    if (rnd() >= 0.5) continue;
    const next = w[i] + (rnd() * 2 - 1) * sigma;
    w[i] = Math.round(Math.max(0, Math.min(1, next)) * 1000) / 1000;
  }
}

function clonePolicy(p) {
  return {
    base: p.base.slice(),
    rules: p.rules.map((r) => ({ when: r.when.map((c) => ({ f: c.f, v: c.v })), w: r.w.slice() }))
  };
}

export function mutatePolicy(p, sigma, rnd) {
  const out = clonePolicy(p);
  const ops = [0];
  if (out.rules.length) ops.push(1, 3);
  if (out.rules.length < MAX_RULES) ops.push(2);
  if (out.rules.length >= 2) ops.push(4);
  const op = ops[Math.floor(rnd() * ops.length)];
  if (op === 0) {
    perturb(out.base, sigma, rnd);
    for (const r of out.rules) perturb(r.w, sigma, rnd);
  } else if (op === 1) {
    const rule = out.rules[Math.floor(rnd() * out.rules.length)];
    const c = rule.when[Math.floor(rnd() * rule.when.length)];
    const pool = CONDITIONS[c.f].values;
    c.v = pool[Math.floor(rnd() * pool.length)];
  } else if (op === 2 && out.rules.length < MAX_RULES) {
    out.rules.push(randomRule(rnd));
  } else if (op === 3) {
    out.rules.splice(Math.floor(rnd() * out.rules.length), 1);
  } else {
    const i = Math.floor(rnd() * out.rules.length);
    const j = (i + 1 + Math.floor(rnd() * (out.rules.length - 1))) % out.rules.length;
    const t = out.rules[i];
    out.rules[i] = out.rules[j];
    out.rules[j] = t;
  }
  return out;
}

export function crossoverPolicy(a, b, rnd) {
  const cut = Math.floor(rnd() * (a.rules.length + 1));
  const rules = a.rules.slice(0, cut).concat(b.rules.slice(cut)).slice(0, MAX_RULES);
  const base = (rnd() < 0.5 ? a.base : b.base).slice();
  return {
    base,
    rules: rules.map((r) => ({ when: r.when.map((c) => ({ f: c.f, v: c.v })), w: r.w.slice() }))
  };
}

export function policyKey(p) {
  const w6 = (w) => w.map((v) => v.toFixed(2)).join(",");
  return "b:" + w6(p.base)
    + "|" + p.rules.map((r) => r.when.map((c) => c.f + "=" + c.v).join("&") + ":" + w6(r.w)).join("||");
}

const FEATURE_NAMES = ["伤害", "补刀", "回血", "攒资源", "省消耗", "避空转"];

function describeWeights(w) {
  const ranked = w.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
  const text = FEATURE_NAMES[ranked[0].i] + "优先";
  const low = ranked[ranked.length - 1];
  return low.v < 0.25 ? text + "，" + FEATURE_NAMES[low.i] + "最不看重" : text;
}

export function readablePolicy(p) {
  const lines = [];
  for (const rule of p.rules) {
    const cond = rule.when
      .map((c) => (CONDITIONS[c.f] && CONDITIONS[c.f].labels[c.v]) || (c.f + "=" + c.v))
      .join("且");
    lines.push((cond ? cond + "：" : "总是：") + describeWeights(rule.w));
  }
  lines.push("默认：" + describeWeights(p.base));
  return lines;
}

/* 旧 18 权重的翻译，保留给 legacy 数据 */
export function readableRules(w) {
  return readablePolicy(legacyPolicy(w));
}

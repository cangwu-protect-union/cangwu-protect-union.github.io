#!/usr/bin/env node
import { classifyMatrix, nashOf, sensitivityOf, solveMixed } from "./lib/analyze.mjs";
import { play } from "./lib/battle.mjs";
import { buildCalibration } from "./lib/calibration.mjs";
/* 自检：验收清单里的四条。
   node rpg6.0/strategy-lab/selftest.mjs */
import { loadEngine, roster } from "./lib/engine.mjs";
import { enumerate } from "./lib/enumerator.mjs";
import { estimatePair, makeSeeds } from "./lib/matrix.mjs";
import { makeRng, randomWeights } from "./lib/policy.mjs";

const { B } = loadEngine();
const fail = [];
const ok = (cond, label, extra) => {
  console.log((cond ? "PASS " : "FAIL ") + label + (extra ? " · " + extra : ""));
  if (!cond) fail.push(label);
};

/* 1. 枚举器：200 个决策点，每个动作都要能真实执行 */
function checkEnumerator() {
  const chars = roster(4);
  let points = 0;
  let actions = 0;
  let bad = 0;
  let samples = 0;
  for (let g = 0; g < 40 && points < 200; g++) {
    const a = chars[g % chars.length];
    const b = chars[(g + 1) % chars.length];
    if (a === b) continue;
    let state = B.battle.create({ seed: 500 + g * 13, a, b }).state;
    const r2 = makeRng(seed(g));
    for (let step = 0; step < 40 && state.phase !== "finished"; step++) {
      const list = enumerate(B, state);
      if (!list.length) break;
      for (const action of list) {
        actions += 1;
        try {
          B.battle.apply(B.state.clone(state), action);
        } catch (err) {
          bad += 1;
          if (samples < 5) console.log("  非法动作：" + JSON.stringify(action) + " → " + err.message);
        }
      }
      points += 1;
      samples += list.length;
      state = B.battle.apply(state, list[Math.floor(r2() * list.length)]).state;
      state.log.length = 0;
    }
  }
  ok(bad === 0, "枚举器 200 点全部可执行", "检查 " + actions + " 个动作，非法 " + bad + " 个，平均 " + (actions / Math.max(1, points)).toFixed(2) + " 个/决策点");
}

function seed(n) {
  return n * 7919 + 13;
}

/* 2. 标定表：技能覆盖与类型公式 */
function checkCalibration() {
  const table = buildCalibration();
  const { LIB } = loadEngine();
  const all = [];
  for (const owner of Object.keys(LIB.characters)) for (const skill of LIB.characters[owner]) all.push(skill.id);
  const missing = all.filter((id) => !table.entries[id]);
  ok(missing.length === 0, "标定表覆盖全部技能", "共 " + all.length + " 条，缺 " + missing.length);

  let checked = 0;
  let maxErr = 0;
  let worst = "";
  for (const id of all) {
    const row = table.entries[id];
    if (!row || !row.dmg || row.mixed || row.dynamic) continue;
    const type = row.types[0] || "true";
    /* last / basic 是动态伤害，不适用固定减伤公式，跳过 */
    if (type !== "phys" && type !== "magic") continue;
    const probed = probeAt(id, 30);
    if (probed == null) continue;
    const predicted = type === "magic" ? row.dmg / 100 * 70 : Math.max(0, row.dmg - 30);
    const err = Math.abs(predicted - probed) / Math.max(1, probed);
    checked += 1;
    if (err > maxErr) { maxErr = err; worst = id + " " + type + " 预测 " + predicted.toFixed(0) + " 实测 " + probed; }
    if (checked >= 20) break;
  }
  ok(checked > 0 && maxErr < 0.25, "标定表的减伤公式对得上", checked + " 条，最大误差 " + (maxErr * 100).toFixed(1) + "%（" + worst + "）");
}

function probeAt(skillId, def) {
  const { LIB, chars } = loadEngine();
  const owner = Object.keys(LIB.characters).find((name) => LIB.characters[name].some((s) => s.id === skillId));
  const char = chars.find((c) => c.name === owner);
  const partner = chars.find((c) => c.name !== owner);
  if (!char) return null;
  const skill = LIB.characters[owner].find((s) => s.id === skillId);
  const state = B.battle.create({ seed: 1, a: char, b: partner }).state;
  state.round = 1;
  const attacker = state.units[0];
  const defender = state.units[1];
  attacker.mp = B.state.maxMpOf(attacker);
  defender.base.def = def;
  defender.base.mres = def;
  defender.base.maxHp = 1000000;
  defender.hp = 1000000;
  const before = defender.hp;
  try {
    B.effectOps.runOps(state, {
      sourceUid: attacker.uid, targetUid: defender.uid, skillId: skill.id,
      label: skill.name || skill.id, input: skill.input ? { n: Number(skill.input.min) || 1 } : {}
    }, skill.ops || [], []);
  } catch {
    return null;
  }
  return before - defender.hp;
}

/* 3. 转置自检：A vs B 与 B vs A 是同一批对局 */
function checkTranspose() {
  const chars = roster(3);
  const rnd = makeRng(77);
  const wa = [randomWeights(rnd), randomWeights(rnd)];
  const wb = [randomWeights(rnd), randomWeights(rnd)];
  const seeds = makeSeeds(40, 3000);
  const ab = estimatePair(B, chars[0], chars[1], wa, wb, seeds, { calib: null });
  const ba = estimatePair(B, chars[1], chars[0], wb, wa, seeds, { calib: null });
  let mismatch = 0;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const x = ab.cells[i][j].a;
    const y = ba.cells[j][i].b;
    if (x !== y) mismatch += 1;
  }
  ok(mismatch === 0, "转置自检（A vs B == B vs A）", "4 格不一致 " + mismatch + " 格");
}

/* 4. 判定器：构造矩阵回归集（旧口径的三条 + 弱猜拳等新口径用例） */
function checkClassifier() {
  const still = classifyMatrix([[0.9, 0.8], [0.3, 0.4]]);
  ok(still.state === "静止" && still.strength === "强", "判定器：死局 → 静止（强）", JSON.stringify({ state: still.state, strength: still.strength, gap: still.gap }));

  const rps = classifyMatrix([[0.5, 0.8], [0.8, 0.5]]);
  ok(rps.state === "封闭" && Math.abs(rps.value - 0.65) < 1e-6, "判定器：猜拳 → 封闭，均衡值 0.65", JSON.stringify({ state: rps.state, value: rps.value, strength: rps.strength, support: rps.support }));

  const flat = classifyMatrix([[0.49, 0.52, 0.48], [0.51, 0.5, 0.5], [0.5, 0.49, 0.51]]);
  ok(flat.state === "开放" && flat.resolve === "flat", "判定器：平坦 → 开放", JSON.stringify({ state: flat.state, spread: flat.spread, resolve: flat.resolve }));

  /* 旧口径把弱猜拳误判成「平坦」；新口径必须判封闭（弱） */
  const weakPennies = classifyMatrix([[0.55, 0.45], [0.45, 0.55]]);
  ok(weakPennies.state === "封闭" && weakPennies.strength === "弱", "判定器：弱猜拳 → 封闭（弱）", JSON.stringify({ state: weakPennies.state, strength: weakPennies.strength, depth: weakPennies.depth }));

  const pennies = classifyMatrix([[0.9, 0.1], [0.1, 0.9]]);
  ok(pennies.state === "封闭" && pennies.strength === "强" && Math.abs(pennies.depth - 0.4) < 1e-6, "判定器：强猜拳 → 封闭（强），深度分 0.4", JSON.stringify({ state: pennies.state, depth: pennies.depth }));

  const dead = classifyMatrix([[0.9, 0.9], [0.9, 0.9]]);
  ok(dead.state === "静止" && dead.mode === "策略无关", "判定器：全 0.9 → 静止·策略无关", JSON.stringify({ state: dead.state, mode: dead.mode }));

  const oneway = classifyMatrix([[0.65, 0.5], [0.65, 0.5]]);
  ok(oneway.state === "开放" && oneway.mode === "单向·甲方无选择", "判定器：甲方无选择 → 开放·单向", JSON.stringify({ state: oneway.state, mode: oneway.mode }));

  const rps3 = classifyMatrix([[0.5, 0.9, 0.3], [0.3, 0.5, 0.9], [0.9, 0.3, 0.5]]);
  ok(rps3.state === "封闭" && rps3.support[0] === 3 && rps3.support[1] === 3, "判定器：3×3 全循环 → 封闭（支撑 3/3）", JSON.stringify({ state: rps3.state, support: rps3.support, value: rps3.value }));

  /* 灵敏性：n=40 的弱猜拳在 Wilson 区间内仍是封闭 */
  const weakCells = [[0.55, 0.45], [0.45, 0.55]].map((row) => row.map((v) => ({
    n: 40, a: v * 40, b: (1 - v) * 40, d: 0,
    halves: [{ n: 20, a: v * 20, b: (1 - v) * 20, d: 0 }, { n: 20, a: v * 20, b: (1 - v) * 20, d: 0 }]
  })));
  const sens = sensitivityOf(weakCells, weakPennies);
  ok(sens && sens.stable === true && sens.lo[0] === "封闭" && sens.hi[0] === "封闭", "灵敏性：弱猜拳 Wilson 区间内稳定为封闭", JSON.stringify(sens));
}

/* 4b. 均衡求解器：精确值核对 */
function checkSolver() {
  const rps = solveMixed([[0.5, 0.8], [0.8, 0.5]]);
  ok(rps && Math.abs(rps.v - 0.65) < 1e-9 && rps.S.length === 2 && rps.T.length === 2, "均衡求解器：2×2 猜拳 v=0.65", JSON.stringify(rps && { v: rps.v, S: rps.S, T: rps.T }));

  const pennies = solveMixed([[0.9, 0.1], [0.1, 0.9]]);
  ok(pennies && Math.abs(pennies.v - 0.5) < 1e-9 && Math.abs(pennies.x[0] - 0.5) < 1e-9, "均衡求解器：匹配硬币 v=0.5，各 0.5", JSON.stringify(pennies && { v: pennies.v, x: pennies.x }));

  const rps3 = solveMixed([[0.5, 0.9, 0.3], [0.3, 0.5, 0.9], [0.9, 0.3, 0.5]]);
  ok(rps3 && Math.abs(rps3.v - 17 / 30) < 1e-9 && rps3.S.length === 3, "均衡求解器：3×3 全循环 v=17/30", JSON.stringify(rps3 && { v: rps3.v, S: rps3.S }));

  /* 有纯鞍点的矩阵不该被混入求解（由判定器先行拦截），求解器自身对它的行为不设断言 */
  const pure = nashOf([[0.9, 0.8], [0.3, 0.4]]);
  ok(pure && pure.pure === true && Math.abs(pure.v - 0.8) < 1e-9 && pure.S.length === 1, "均衡入口：纯鞍点矩阵返回纯均衡（鞍点 (0,1)，值 0.8）", JSON.stringify(pure && { v: pure.v, S: pure.S, pure: pure.pure }));

  /* 非对称、有支撑外策略的矩阵：曾因不等式方向写反算出 v=1，正确值是 0.5（刘文哲×江雨轩实测矩阵） */
  const asym = solveMixed([[0, 1, 1, 0], [1, 1, 1, 0], [1, 1, 1, 0], [1, 1, 1, 0], [0, 1, 1, 1]]);
  ok(asym && Math.abs(asym.v - 0.5) < 1e-9 && asym.S.length === 2 && asym.T.length === 2, "均衡求解器：非对称 5×4 支撑外校验，v=0.5", JSON.stringify(asym && { v: asym.v, S: asym.S, T: asym.T }));

  const asym3 = solveMixed([[0, 1], [1, 0], [1, 0]]);
  ok(asym3 && Math.abs(asym3.v - 0.5) < 1e-9, "均衡求解器：3×2 非对称，v=0.5", JSON.stringify(asym3 && { v: asym3.v, S: asym3.S, T: asym3.T }));
}

/* 附加：一局能正常打完 */
function checkPlay() {
  const chars = roster(3);
  const rnd = makeRng(5);
  const row = play(B, chars[0], chars[1], randomWeights(rnd), randomWeights(rnd), 900, { calib: null });
  ok(row.result === "a" || row.result === "b" || row.result === "draw", "单局执行正常", "结果 " + row.result + " · " + row.steps + " 步");
}

console.log("=== 策略实验室自检 ===");
checkEnumerator();
checkCalibration();
checkTranspose();
checkClassifier();
checkSolver();
checkPlay();
console.log("");
if (fail.length) {
  console.log("失败 " + fail.length + " 项：" + fail.join(" / "));
  process.exitCode = 1;
} else {
  console.log("全部通过");
}

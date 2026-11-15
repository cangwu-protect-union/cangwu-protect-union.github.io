#!/usr/bin/env node
import { classifyMatrix } from "./lib/analyze.mjs";
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

/* 4. 判定器：三个构造矩阵 */
function checkClassifier() {
  const still = classifyMatrix([[0.9, 0.8], [0.3, 0.4]]);
  ok(still.state === "静止" && still.strength === "强", "判定器：死局 → 静止（强）", JSON.stringify({ state: still.state, strength: still.strength, gap: still.gap }));

  const rps = classifyMatrix([[0.5, 0.8], [0.8, 0.5]]);
  ok(rps.state === "封闭", "判定器：猜拳 → 封闭", JSON.stringify({ state: rps.state, spread: rps.spread, support: rps.support }));

  const flat = classifyMatrix([[0.49, 0.52, 0.48], [0.51, 0.5, 0.5], [0.5, 0.49, 0.51]]);
  ok(flat.state === "开放" && flat.resolve === "flat", "判定器：平坦 → 开放", JSON.stringify({ state: flat.state, spread: flat.spread, resolve: flat.resolve }));
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
checkPlay();
console.log("");
if (fail.length) {
  console.log("失败 " + fail.length + " 项：" + fail.join(" / "));
  process.exitCode = 1;
} else {
  console.log("全部通过");
}

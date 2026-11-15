/* 技能标定：用引擎自己的结算代码给每条技能打表。
   造一个固定假人（def 0、mres 0、血量 100 万），把技能的 ops 直接跑一遍，读血量差。
   好处：不复制伤害公式，引擎升版重跑即可。 */
import fs from "node:fs";
import path from "node:path";
import { LAB_DIR, loadEngine } from "./engine.mjs";

export const CALIB_PATH = path.join(LAB_DIR, "data", "calibration.json");
const PROBE_HP = 1000000;

function freshProbe(B, char, partner) {
  const state = B.battle.create({ seed: 1, a: char, b: partner }).state;
  state.round = 1;
  state.phase = "fight";
  const attacker = state.units[0];
  const defender = state.units[1];
  attacker.actionsLeft = 99;
  attacker.mp = B.state.maxMpOf(attacker);
  state.turnUid = attacker.uid;
  defender.base.def = 0;
  defender.base.mres = 0;
  defender.base.maxHp = PROBE_HP;
  defender.hp = PROBE_HP;
  defender.base.atk = 0;
  return { state, attacker, defender };
}

function typeOfOps(ops) {
  const types = new Set();
  const walk = (list) => {
    if (!Array.isArray(list)) return;
    for (const op of list) {
      if (!op || typeof op !== "object") continue;
      if (op.op === "damage") types.add(op.type || "phys");
      if (op.op === "if") { walk(op.then); walk(op.else); }
      if (op.op === "choice") { for (const c of op.choices || []) walk(c.ops); }
      if (op.ops) walk(op.ops);
    }
  };
  walk(ops);
  return Array.from(types);
}

function measure(B, char, partner, skill) {
  /* 必须原样交给 runOps：展开 if/tick 的内层 ops 会改变语义
     （tick 的内层是延迟伤害，当场不该结算）。 */
  const ops = Array.isArray(skill.ops) ? skill.ops : [];
  if (!ops.length) return { skip: true, reason: "no ops" };
  const delayed = /"op":"(tick|schedule)"/.test(JSON.stringify(ops));

  const { state, attacker, defender } = freshProbe(B, char, partner);
  const before = { d: defender.hp, a: attacker.hp };
  try {
    B.effectOps.runOps(state, {
      sourceUid: attacker.uid,
      targetUid: defender.uid,
      skillId: skill.id,
      label: skill.name || skill.id,
      input: skill.input ? { n: Number(skill.input.min) || 1 } : {}
    }, ops, []);
  } catch (err) {
    return { error: String(err && err.message || err) };
  }
  const dmg = Math.max(0, before.d - defender.hp);
  const selfGain = Math.max(0, attacker.hp - before.a);
  const selfLoss = Math.max(0, before.a - attacker.hp);
  const types = typeOfOps(ops);
  const raw = JSON.stringify(ops);
  return {
    dmg,
    selfGain,
    selfLoss,
    hp: defender.hp,
    types,
    mixed: types.length > 1,
    atk: B.state.statOf(attacker, "atk"),
    dynamic: /target\.def|target\.breakValue|target\.stunValue|"mark"/.test(raw),
    delayed,
    ops: ops.length
  };
}

export function buildCalibration() {
  const { B, LIB, chars, engineVersion } = loadEngine();
  const byName = {};
  for (const c of chars) byName[c.name] = c;
  const partner = chars.find((c) => !LIB.characters[c.name]) || chars[chars.length - 1];
  const entries = {};
  let failed = 0;
  for (const owner of Object.keys(LIB.characters)) {
    const char = byName[owner];
    if (!char) continue;
    for (const skill of LIB.characters[owner]) {
      const row = measure(B, char, partner, skill);
      row.name = skill.name || "";
      row.owner = owner;
      if (row.error) failed += 1;
      entries[skill.id] = row;
    }
  }
  return {
    engineVersion,
    builtAt: new Date().toISOString(),
    probe: { def: 0, mres: 0, hp: PROBE_HP },
    total: Object.keys(entries).length,
    failed,
    entries
  };
}

export function loadCalibration() {
  if (!fs.existsSync(CALIB_PATH)) return null;
  const raw = JSON.parse(fs.readFileSync(CALIB_PATH, "utf8"));
  const { engineVersion } = loadEngine();
  if (raw.engineVersion !== engineVersion) {
    throw new Error("标定表引擎版本不符：" + raw.engineVersion + " ≠ " + engineVersion + "，跑 --stage=calibrate 重建");
  }
  return raw;
}

export function writeCalibration(table) {
  fs.mkdirSync(path.dirname(CALIB_PATH), { recursive: true });
  fs.writeFileSync(CALIB_PATH, JSON.stringify(table, null, 2) + "\n", "utf8");
  return CALIB_PATH;
}

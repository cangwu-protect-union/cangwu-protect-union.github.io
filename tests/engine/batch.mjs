/* ============================================================
   batch.mjs —— 23 名角色的批量对局压测
   ------------------------------------------------------------
   用法：
     node tests/engine/batch.mjs                # 两两配对 × 2 种子
     node tests/engine/batch.mjs --seeds=4      # 每对 4 个种子
     node tests/engine/batch.mjs --pairs=smoke  # 只跑 12 局冒烟
     node tests/engine/batch.mjs --policy=attack-only
     node tests/engine/batch.mjs --out=tests/reports/x.json

   每一局做四件事：
     1. 随机合法动作推进，直到分胜负或达到步数上限；
     2. 每步校验不变量（血量、蓝、速度条、击溃值、残留状态、NaN）；
     3. 结束后用 committed 动作重放，比对状态指纹；
     4. 记录回合、步数、胜者、技能使用次数。
   有异常就带非零退出码，并把异常写进报告。
   ============================================================ */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import "../../rpg6.0/js/engine/index.js";
import skillsLib from "../../rpg6.0/data/skills/index.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");

function arg(name, fallback) {
  const hit = process.argv.slice(2).find((a) => a.startsWith("--" + name + "="));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const SEEDS = Number(arg("seeds", "2"));
const PAIRS = arg("pairs", "all");
const POLICY = arg("policy", "random");
const LIMIT = Number(arg("limit", "400"));
const LONG_ROUNDS = Number(arg("long", "120"));
const OUT = arg("out", "");

const B = globalThis.RPG6B;
const LIB = skillsLib;
B.skills.load(LIB);

function loadCharacters() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  for (const name of ["characters.js", "characters-2.js", "characters-3.js", "characters-4.js"]) {
    const file = path.join(ROOT, "rpg6.0", "data", "seeds", name);
    vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  }
  return sandbox.window.RPG_SEED_CHARACTERS || [];
}

const rosterNames = Object.keys(LIB.characters);
const allChars = loadCharacters();
const roster = allChars.filter((c) => rosterNames.indexOf(c.name) >= 0);
const byName = {};
roster.forEach((c) => { byName[c.name] = c; });

/* ---------------- 工具 ---------------- */

function targetsFor(state, unit, skill) {
  const other = B.state.otherUid(state, unit.uid);
  const enemySide = B.state.otherSide(state, B.state.sideOf(state, unit.uid));
  /* 单体目标按嘲讽取最高者（含召唤物，射手无视嘲讽），与引擎 resolveTarget 同口径 */
  const enemyUids = B.traits && B.traits.ignoreTaunt && B.traits.ignoreTaunt(unit)
    ? B.state.combatantsOf(state, enemySide).map((x) => x.uid)
    : (B.skills.maxTauntUids ? B.skills.maxTauntUids(state, enemySide) : [other]);
  if (skill.target === "self" || skill.target === "ally" || skill.target === "allAllies") return [unit.uid];
  if (skill.target === "enemy" || skill.target === "allEnemies") return enemyUids;
  if (skill.target === "any") return [unit.uid].concat(enemyUids);
  return enemyUids;
}

function candidates(state) {
  const unit = B.state.unitOf(state, state.turnUid);
  const out = [];
  if (POLICY !== "attack-only") {
    const skills = B.skills.forUnit(unit);
    for (const skill of skills) {
      const check = B.conditions.evaluate(state, unit, skill);
      if (!check.ok) continue;
      if (check.needsCharge) {
        out.push({ kind: "skill", skillId: skill.id });
        continue;
      }
      if (skill.input) {
        const min = Number(skill.input.min) || 1;
        let max = unit.mp;
        if (skill.input.max !== "mp" && skill.input.max != null) {
          max = Math.min(max, Number(skill.input.max));
        }
        if (max >= min) {
          for (const target of targetsFor(state, unit, skill)) {
            out.push({ kind: "skill", skillId: skill.id, target: target, n: min });
            if (max !== min) out.push({ kind: "skill", skillId: skill.id, target: target, n: max });
          }
        }
        continue;
      }
      for (const target of targetsFor(state, unit, skill)) {
        if (skill.choices && skill.choices.length) {
          for (const item of skill.choices) {
            out.push({ kind: "skill", skillId: skill.id, target: target, choice: item.key });
          }
          continue;
        }
        out.push({ kind: "skill", skillId: skill.id, target: target });
      }
    }
  }
  for (const basic of B.battle.available(state)) {
    if (!basic.enabled) continue;
    /* 解锁属性是额外动作（倪曼云刚长出来），不消耗行动 */
    if (basic.kind === "unlock") {
      for (const item of basic.stats || []) out.push({ kind: "unlock", stat: item.key });
      continue;
    }
    /* 吃苹果/功德回血也是额外动作（第七批） */
    if (basic.kind === "item") {
      out.push({ kind: "item", key: basic.key });
      continue;
    }
    if (!basic.targets.length) out.push({ kind: "basic", type: basic.type });
    else for (const target of basic.targets) out.push({ kind: "basic", type: basic.type, target: target });
  }
  return out;
}

function rngFrom(seed) {
  let s = (seed >>> 0) || 1;
  return function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function problemsOf(state) {
  const out = [];
  for (const unit of state.units) {
    const maxHp = B.state.maxHpOf(unit);
    const maxMp = B.state.maxMpOf(unit);
    var allowNegativeHp = !!(unit.undying || unit.undyingEnabled);
    if (!isFinite(unit.hp) || unit.hp > maxHp || (unit.hp < 0 && !allowNegativeHp)) out.push(unit.name + " 血量越界：" + unit.hp + "/" + maxHp);
    if (!isFinite(unit.mp) || unit.mp < 0 || unit.mp > maxMp) out.push(unit.name + " 蓝越界：" + unit.mp + "/" + maxMp);
    if (!isFinite(unit.gauge) || unit.gauge < 0 || unit.gauge >= 100) out.push(unit.name + " 速度条越界：" + unit.gauge);
    if (unit.breakValue < 0 || unit.breakValue > 5) out.push(unit.name + " 击溃值越界：" + unit.breakValue);
    if (unit.stunValue < 0 || unit.stunValue > 5) out.push(unit.name + " 眩晕值越界：" + unit.stunValue);
    for (const st of unit.statuses) if (!(st.remain > 0)) out.push(unit.name + " 残留状态：" + st.kind + "/" + st.remain);
    for (const bf of unit.buffs) if (!(bf.remain > 0)) out.push(unit.name + " 残留 Buff：" + bf.kind + "/" + bf.remain);
    for (const md of unit.mods) if (!(md.remain === B.state.PERMANENT || md.remain > 0)) out.push(unit.name + " 残留修正：" + md.stat + "/" + md.remain);
    for (const ef of unit.effects) if (!(ef.remain === B.state.PERMANENT || ef.remain > 0)) out.push(unit.name + " 残留持续效果：" + (ef.label || ef.id) + "/" + ef.remain);
    for (const key of Object.keys(unit.marks || {})) {
      const mark = unit.marks[key];
      if (mark.value < 0 || mark.value > mark.max) out.push(unit.name + " 标记越界：" + key + "=" + mark.value);
    }
    if (unit.charge && unit.charge.amount < 1) out.push(unit.name + " 蓄力层数异常：" + unit.charge.amount);
  }
  if (!isFinite(state.round) || state.round < 1) out.push("回合数异常：" + state.round);
  if (state.phase === "finished" && !state.result) out.push("结束但没有结果");
  return out;
}

function playOne(a, b, seed) {
  const created = B.battle.create({ seed, a, b });
  const init = B.state.clone(created.state);
  let state = created.state;
  const actions = [];
  const skillsUsed = {};
  const problems = [];
  const rnd = rngFrom(seed * 7919 + 13);
  let steps = 0;
  let guard = 0;

  while (state.phase !== "finished" && steps < LIMIT) {
    guard += 1;
    if (guard > LIMIT + 50) {
      problems.push("推进次数超出上限，疑似死循环");
      break;
    }
    if (!state.turnUid) {
      problems.push("没有行动者但也没结束");
      break;
    }
    const list = candidates(state);
    if (!list.length) {
      problems.push("没有合法动作：" + B.state.unitOf(state, state.turnUid).name);
      break;
    }
    const pick = list[Math.floor(rnd() * list.length)];
    let result;
    try {
      result = B.battle.apply(state, pick);
    } catch (err) {
      problems.push("动作抛错：" + JSON.stringify(pick) + " → " + err.message +
        "（行动者 " + state.turnUid + "，回合 " + state.round +
        "，queue " + JSON.stringify(state.queue) +
        "，units " + state.units.map((u) => u.uid).join("/") +
        "，summons " + (state.summons || []).map((u) => u.uid).join("/") + "）");
      console.error("  stack:", (err && err.stack ? err.stack.split("\n").slice(0, 5).join("\n    ") : "无"));
      break;
    }
    state = result.state;
    actions.push(result.committed);
    steps += 1;
    if (pick.kind === "skill") skillsUsed[pick.skillId] = (skillsUsed[pick.skillId] || 0) + 1;
    const bad = problemsOf(state);
    if (bad.length) {
      problems.push(...bad.slice(0, 3));
      break;
    }
  }

  if (state.phase !== "finished") {
    /* 没打完不算引擎故障：要么是治疗抵平、要么是互相锁死，属于规则层面的僵局 */
    return {
      a: a.name,
      b: b.name,
      seed,
      rounds: state.round,
      steps,
      result: "draw",
      replayOk: null,
      stalled: true,
      longGame: state.round > LONG_ROUNDS,
      problems,
      skillsUsed
    };
  }

  let replayOk = null;
  if (actions.length) {
    try {
      const again = B.battle.replay(init, actions);
      replayOk = B.state.hash(again.state) === B.state.hash(state);
      if (!replayOk) problems.push("重放指纹不一致");
    } catch (err) {
      replayOk = false;
      problems.push("重放抛错：" + err.message);
    }
  }

  return {
    a: a.name,
    b: b.name,
    seed,
    rounds: state.round,
    steps,
    result: state.result || "",
    replayOk,
    stalled: false,
    longGame: state.round > LONG_ROUNDS,
    problems,
    skillsUsed
  };
}

/* ---------------- 跑批 ---------------- */

const pairs = [];
if (PAIRS === "smoke") {
  for (let i = 0; i < roster.length; i++) {
    pairs.push([roster[i], roster[(i + 1) % roster.length]]);
  }
} else if (PAIRS && PAIRS.indexOf(",") > 0) {
  const [an, bn] = PAIRS.split(",");
  const pick = (name) => roster.find((c) => c.name === name);
  if (pick(an) && pick(bn)) pairs.push([pick(an), pick(bn)]);
  if (!pairs.length) throw new Error("--pairs 里找不到角色：" + PAIRS);
} else {
  for (const a of roster) for (const b of roster) pairs.push([a, b]);
}

const fights = [];
const started = Date.now();
for (const [a, b] of pairs) {
  for (let s = 1; s <= SEEDS; s++) {
    const seed = 1000 + s * 37 + roster.indexOf(a) * 13 + roster.indexOf(b) * 7;
    fights.push(playOne(a, b, seed));
  }
}

const problems = fights.filter((f) => f.problems.length);
const stalls = fights.filter((f) => f.stalled);
const longs = fights.filter((f) => f.longGame && !f.stalled);
const wins = {};
const skillCount = {};
let rounds = 0;
let steps = 0;
for (const f of fights) {
  if (f.result === "a") wins[f.a] = (wins[f.a] || 0) + 1;
  if (f.result === "b") wins[f.b] = (wins[f.b] || 0) + 1;
  rounds += f.rounds;
  steps += f.steps;
  for (const id of Object.keys(f.skillsUsed)) skillCount[id] = (skillCount[id] || 0) + f.skillsUsed[id];
}

const stallPairs = {};
for (const f of stalls) {
  const key = [f.a, f.b].sort().join(" vs ");
  stallPairs[key] = (stallPairs[key] || 0) + 1;
}

const summary = {
  generatedAt: new Date().toISOString(),
  policy: POLICY,
  pairs: pairs.length,
  seeds: SEEDS,
  fights: fights.length,
  failed: problems.length,
  stalled: stalls.length,
  longGames: longs.length,
  stallPairs: stallPairs,
  avgRounds: +(rounds / fights.length).toFixed(1),
  avgSteps: +(steps / fights.length).toFixed(1),
  ms: Date.now() - started,
  roster: rosterNames,
  wins: wins,
  topSkills: Object.keys(skillCount).sort((x, y) => skillCount[y] - skillCount[x]).slice(0, 10).map((id) => [id, skillCount[id]])
};

console.log("对局 " + fights.length + " 局 · 引擎异常 " + problems.length + " 局 · 僵局 " + stalls.length +
  " 局 · 超长（>" + LONG_ROUNDS + " 回合）" + longs.length + " 局");
console.log("平均 " + summary.avgRounds + " 回合 / " + summary.avgSteps + " 步 · 用时 " + summary.ms + "ms");
console.log("胜场：" + Object.keys(wins).sort((x, y) => wins[y] - wins[x]).map((n) => n + " " + wins[n]).join(" · "));

if (problems.length) {
  console.log("\n引擎异常：");
  for (const f of problems.slice(0, 12)) {
    console.log("  " + f.a + " vs " + f.b + " · seed " + f.seed + " → " + f.problems.join(" | "));
  }
}
if (stalls.length) {
  console.log("\n僵局配对（到步数上限仍未分胜负）：");
  Object.keys(stallPairs).sort((x, y) => stallPairs[y] - stallPairs[x]).forEach(function (key) {
    console.log("  " + key + " × " + stallPairs[key]);
  });
}

if (OUT) {
  const outPath = path.isAbsolute(OUT) ? OUT : path.join(ROOT, OUT);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ summary, fights }, null, 2) + "\n", "utf8");
  console.log("报告写入：" + path.relative(ROOT, outPath));
}

if (problems.length) process.exitCode = 1;

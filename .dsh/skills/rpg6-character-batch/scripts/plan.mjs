import fs from "node:fs";
import path from "node:path";
import {
  argValue,
  eachOp,
  findRoot,
  flattenLibrary,
  hasFlag,
  loadLibrary,
  loadSeed,
  norm,
  seedStats
} from "./lib.mjs";

const argv = process.argv.slice(2);
const root = findRoot(argv);
const checkFile = argValue(argv, "--check");
const scaffoldFile = argValue(argv, "--scaffold");
/* --mode=plan（默认）：实现前校验，角色已在技能库里就算错。
   --mode=verify：实现后验收，允许角色已在库里，plan.docs 的期望值不再比对
   （文档计数由 rpg6-stats.js --check 与 audit-docs.mjs 负责，重复计数只会误报）。 */
const mode = argValue(argv, "--mode") || "plan";
if (mode !== "plan" && mode !== "verify") {
  console.error("--mode 只接受 plan 或 verify");
  process.exit(2);
}
const file = checkFile || scaffoldFile;
if (!file) {
  console.error("用法：node plan.mjs --check plan.json [--mode=plan|verify] | --scaffold plan.json [--out 文件] [--root 仓库]");
  process.exit(2);
}

const plan = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
const seed = loadSeed(root);
const lib = await loadLibrary(root);
const { all: libSkills, byId: libById } = flattenLibrary(lib);
const seedByName = new Map(seed.map((c) => [c.name, c]));
const errors = [];
const warnings = [];
const engineVersion = readEngineVersion(root);
const opNames = readOpNames(root);
const hookNames = readHookNames(root);

if (!plan || typeof plan !== "object") fail("plan 不是对象");
if (!Array.isArray(plan.characters)) fail("plan.characters 必须是数组");
const allowExisting = !!plan.allowExisting || mode === "verify";

let projectedSkills = libSkills.length;
let projectedUnsupported = libSkills.filter((s) => s.unsupported).length;
const newCharacters = [];
const seenIds = new Set();

for (const [index, character] of (plan.characters || []).entries()) {
  const where = "characters[" + index + "]";
  if (!character || !character.name) {
    fail(where + " 缺少 name");
    continue;
  }
  const seedChar = seedByName.get(character.name);
  if (!seedChar) {
    fail(where + " 的角色不在 seed 的 33 人里：" + character.name);
    continue;
  }
  const inLibrary = Object.hasOwn(lib.characters || {}, character.name);
  if (inLibrary && !allowExisting) fail(character.name + " 已在技能库里；更新已有角色要显式 allowExisting:true");
  if (!inLibrary) newCharacters.push(character.name);

  const stats = character.stats || {};
  const overrides = character.statOverrides || {};
  for (const key of Object.keys(overrides)) {
    if (!["atk", "def", "mres", "hp", "mp", "spd"].includes(key)) {
      fail(character.name + " 的 statOverrides 有不认识的属性：" + key);
    } else if (!/^-?\d+(\.\d+)?$/.test(String(overrides[key]))) {
      fail(character.name + " 的 statOverrides." + key + " 必须是数字：" + overrides[key]);
    }
  }
  for (const [key, value] of Object.entries(seedStats(seedChar))) {
    if (Object.hasOwn(overrides, key)) {
      if (String(stats[key]) !== String(overrides[key])) {
        fail(character.name + " 的 stats." + key + " 应为覆盖值 " + overrides[key] + "，实际 " + stats[key]);
      }
      continue;
    }
    if (String(stats[key]) !== String(value)) {
      fail(character.name + " 的 stats." + key + " 与 seed 不一致：" + stats[key] + " != " + value);
    }
  }
  if (character.gender !== seedChar.gender) fail(character.name + " 的 gender 与 seed 不一致");
  if (character.occupation !== seedChar.occupation) fail(character.name + " 的 occupation 与 seed 不一致");
  if ((character.sideJob || "") !== (seedChar.side_job || "")) {
    fail(character.name + " 的 sideJob 与 seed 不一致");
  }

  if (!Array.isArray(character.skills)) {
    fail(character.name + " 缺少 skills 数组");
    continue;
  }
  const planByName = new Map();
  for (const skill of character.skills) {
    if (!skill || !skill.name) {
      fail(character.name + " 有技能缺少 name");
      continue;
    }
    if (planByName.has(norm(skill.name))) fail(character.name + " 技能重名：" + skill.name);
    planByName.set(norm(skill.name), skill);
  }

  const seedSkills = Array.isArray(seedChar.skills) ? seedChar.skills : [];
  for (const source of seedSkills) {
    if (!planByName.has(norm(source.name))) {
      fail(character.name + " 漏了档案技能：" + source.name + "（不做的也要写 status/unsupported）");
    }
  }
  for (const skill of character.skills) {
    if (!seedSkills.some((s) => norm(s.name) === norm(skill.name))) {
      fail(character.name + " 的 plan 技能不在档案里：" + skill.name);
      continue;
    }
    const source = seedSkills.find((s) => norm(s.name) === norm(skill.name));
    if (norm(skill.condition) !== norm(source.condition)) {
      fail(character.name + " · " + skill.name + " 的 condition 与档案不一致");
    }
    validateSkill(character.name, skill, source);
  }
}

projectedSkills += (plan.characters || []).reduce(
  (n, c) => n + (c.skills || []).length,
  0
);

for (const [owner, marks] of Object.entries(plan.marks || {})) {
  if (!Array.isArray(marks)) {
    fail("marks." + owner + " 必须是数组");
    continue;
  }
  for (const mark of marks) {
    if (!mark || !mark.key) fail("marks." + owner + " 有标记缺少 key");
    if (mark.max != null && !(Number(mark.max) >= 0)) fail("marks." + owner + " · " + mark.key + " max 非法");
    if (mark.init != null && !(Number(mark.init) >= 0)) fail("marks." + owner + " · " + mark.key + " init 非法");
  }
}

for (const [key, summon] of Object.entries(plan.summons || {})) {
  if (!summon || typeof summon !== "object") {
    fail("summons." + key + " 不是对象");
    continue;
  }
  if (summon.stats && typeof summon.stats !== "object") fail("summons." + key + " stats 非法");
  for (const hook of ["aura", "attack", "onExpire"]) walkOps(summon[hook], "summons." + key + "." + hook);
}

for (const character of plan.characters || []) {
  for (const skill of character.skills || []) validateSummonKeys(character.name + " · " + skill.name, skill);
}

const engineGap = (plan.characters || []).some((c) =>
  (c.skills || []).some((s) => s.status === "engine-gap")
);
const changes = Array.isArray(plan.engine && plan.engine.changes) ? plan.engine.changes : [];
if (!plan.engine || !plan.engine.version) {
  warnings.push("plan.engine.version 缺省；应写当前或目标 engineVersion");
} else if (plan.engine.version !== engineVersion) {
  if (!changes.length) fail("plan.engine.version 变了但 engine.changes 为空");
} else if (changes.length && mode !== "verify") {
  /* 验收时版本已经升过了，plan.engine.version 与 version.js 相等是预期，不再提醒。 */
  warnings.push("engine.changes 非空但 engine.version 没变；改规则应升版本");
}
if (engineGap && !changes.length) fail("有 engine-gap 技能，但 plan.engine.changes 为空");

if (plan.docs && mode !== "verify") {
  const expectedChars = libCharactersCount() + newCharacters.length;
  const expectedSkills = projectedSkills;
  if (plan.docs.expectedCharacters != null && Number(plan.docs.expectedCharacters) !== expectedChars) {
    fail("plan.docs.expectedCharacters 应为 " + expectedChars);
  }
  if (plan.docs.expectedSkills != null && Number(plan.docs.expectedSkills) !== expectedSkills) {
    fail("plan.docs.expectedSkills 应为 " + expectedSkills);
  }
}

const projected = mode === "verify"
  ? {
    characters: libCharactersCount(),
    skills: libSkills.length,
    implemented: libSkills.filter((s) => !s.unsupported).length,
    unsupported: libSkills.filter((s) => s.unsupported).length
  }
  : {
    characters: libCharactersCount() + newCharacters.length,
    skills: projectedSkills,
    implemented: libSkills.filter((s) => !s.unsupported).length +
      (plan.characters || []).reduce((n, c) => n + (c.skills || []).filter((s) => s.status === "implemented").length, 0),
    unsupported: projectedUnsupported +
      (plan.characters || []).reduce((n, c) => n + (c.skills || []).filter((s) => s.status && s.status !== "implemented").length, 0)
  };

for (const warning of warnings) console.warn("WARN " + warning);
if (errors.length) {
  for (const error of errors) console.error("ERROR " + error);
  console.error("\n计划未通过：" + errors.length + " 个错误");
  process.exit(1);
}

console.log("计划通过：" + plan.characters.length + " 名角色 / " +
  plan.characters.reduce((n, c) => n + (c.skills || []).length, 0) + " 条技能");
console.log((mode === "verify" ? "技能库现状：角色 " : "预计总量：角色 ") + projected.characters + " / 技能 " + projected.skills +
  "（implemented " + projected.implemented + " / unsupported " + projected.unsupported + "）");
if (plan.engine) console.log("引擎：" + plan.engine.version + (changes.length ? "，变更 " + changes.length + " 项" : ""));

if (scaffoldFile) {
  const text = scaffold(plan);
  const out = argValue(argv, "--out");
  if (out) {
    fs.writeFileSync(path.resolve(out), text, "utf8");
    console.log("脚手架写到 " + path.resolve(out));
  } else {
    console.log("\n" + text);
  }
}

function validateSkill(owner, skill, source) {
  const name = owner + " · " + skill.name;
  if (!skill.id) fail(name + " 缺少 id");
  else {
    if (seenIds.has(skill.id)) fail(name + " 的 id 重复：" + skill.id);
    seenIds.add(skill.id);
    if (libById[skill.id] && !allowExisting) fail(name + " 的 id 已在技能库：" + skill.id);
  }
  if (!["enemy", "ally", "self", "allEnemies", "allAllies", "any"].includes(skill.target)) {
    fail(name + " target 非法：" + skill.target);
  }
  if (skill.cost != null && typeof skill.cost !== "object") fail(name + " cost 必须是对象");
  if (skill.cost && skill.cost.mp != null && !(Number(skill.cost.mp) >= 0)) fail(name + " cost.mp 非法");
  if (skill.cost && skill.cost.hp != null && !(Number(skill.cost.hp) >= 0)) fail(name + " cost.hp 非法");
  if (skill.charge != null && !(Number(skill.charge) >= 0)) fail(name + " charge 非法");
  if (skill.cooldown != null && !(Number(skill.cooldown) >= 0)) fail(name + " cooldown 非法");
  if (norm(source.condition) === "被动" && !skill.passive) fail(name + " 条件是被动，但 passive 不是 true");
  if (norm(source.condition) !== "被动" && skill.passive) fail(name + " 条件是主动，但 passive=true");
  if (!["implemented", "unsupported", "engine-gap"].includes(skill.status)) {
    fail(name + " status 非法：" + skill.status);
  }
  if (skill.status === "implemented") {
    if (skill.unsupported) fail(name + " 已实现却写了 unsupported");
    if (!Array.isArray(skill.tests) || !skill.tests.length) fail(name + " 已实现但没有 tests");
    if (!Array.isArray(skill.ops)) fail(name + " 缺少 ops 数组");
    if (skill.hooks != null && typeof skill.hooks !== "object") fail(name + " hooks 非法");
  } else {
    if (!skill.unsupported) fail(name + " 未实现但没有 unsupported 原因");
    if (!Array.isArray(skill.ops)) warn(name + " 未实现且没有 ops（可为空）");
  }
  walkOps(skill.ops, name + ".ops");
  walkOps(skill.chargeOps, name + ".chargeOps");
  for (const [hook, ops] of Object.entries(skill.hooks || {})) {
    if (!hookNames.has(hook)) fail(name + " 未知 hook：" + hook);
    walkOps(ops, name + ".hooks." + hook);
  }
  for (const choice of skill.choices || []) walkOps(choice.ops, name + ".choices");
}

function validateSummonKeys(where, skill) {
  const lists = [skill.ops, skill.chargeOps, ...Object.values(skill.hooks || {})];
  for (const choice of skill.choices || []) lists.push(choice.ops);
  for (const ops of lists) eachOp(ops, (op) => {
    if (op.op !== "summon" || !op.key) return;
    const known = (plan.summons && plan.summons[op.key]) || (lib.summons && lib.summons[op.key]);
    if (!known) fail(where + " 的 summon.key 没有定义：" + op.key);
  });
}

function walkOps(list, where) {
  if (list == null) return;
  if (!Array.isArray(list)) {
    fail(where + " 必须是数组");
    return;
  }
  for (const op of list) {
    if (!op || typeof op !== "object") {
      fail(where + " 有非对象 op");
      continue;
    }
    if (!opNames.has(op.op)) fail(where + " 的 op 不在 effect-ops 里：" + op.op);
    for (const key of ["then", "else", "ops"]) walkOps(op[key], where + "." + op.op + "." + key);
    for (const key of ["cases", "choices"]) {
      if (!Array.isArray(op[key])) continue;
      for (const item of op[key]) walkOps(item && item.ops, where + "." + op.op + "." + key);
    }
  }
}

function readEngineVersion(repo) {
  const file = path.join(repo, "rpg6.0/data/config.js");
  const text = fs.readFileSync(file, "utf8");
  const m = text.match(/engineVersion:\s*"([^"]+)"/);
  if (!m) throw new Error("无法从 data/config.js 读到 engineVersion");
  return m[1];
}

function readOpNames(repo) {
  const dir = path.join(repo, "rpg6.0/js/engine/ops");
  const set = new Set();
  if (fs.existsSync(dir)) {
    for (const name of fs.readdirSync(dir).filter((f) => f.endsWith(".js"))) {
      const text = fs.readFileSync(path.join(dir, name), "utf8");
      for (const m of text.matchAll(/registerOp\(\s*"([^"]+)"/g)) set.add(m[1]);
    }
  }
  if (!set.size) {
    const file = path.join(repo, "rpg6.0/js/engine/effect-ops.js");
    const text = fs.readFileSync(file, "utf8");
    for (const m of text.matchAll(/^\s*case\s+"([^"]+)"/gm)) set.add(m[1]);
  }
  if (!set.size) throw new Error("无法从 js/engine/ops 读到 op 名");
  return set;
}

/* hook 名单同样从引擎现扫，避免 plan.mjs 里再抄一份会过期的表。 */
function readHookNames(repo) {
  const dir = path.join(repo, "rpg6.0/js/engine");
  const set = new Set();
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith(".js")) continue;
      const text = fs.readFileSync(full, "utf8");
      for (const m of text.matchAll(/runHooks\([^;\n]*?"([A-Za-z]+)"/g)) if (m[1] !== "kind") set.add(m[1]);
    }
  };
  walk(dir);
  if (!set.size) throw new Error("无法从 js/engine 读到 hook 名");
  return set;
}

function libCharactersCount() {
  return Object.keys(lib.characters || {}).length;
}

function fail(message) {
  errors.push(message);
}

function scaffold(input) {
  const parts = [];
  const imports = [];
  const registry = [];

  for (const [index, character] of input.characters.entries()) {
    const file = character.fixture || ("char" + index);
    imports.push('import ' + file + ' from "./' + file + '.js";');
    registry.push('    ' + JSON.stringify(character.name) + ": " + file + ",");

    parts.push("// ===== rpg6.0/data/skills/" + file + ".js =====");
    parts.push("/* 回合制正传 6.0 · 技能库 · " + character.name + " */");
    parts.push("export default [");
    const list = [];
    for (const skill of character.skills) {
      const data = {
        id: skill.id,
        name: skill.name,
        conditionText: skill.condition
      };
      if (skill.passive) data.passive = true;
      data.cost = skill.cost || { mp: 0 };
      data.charge = Number(skill.charge) || 0;
      data.cooldown = Number(skill.cooldown) || 0;
      data.target = skill.target || "enemy";
      if (skill.once) data.once = true;
      if (skill.costFromLost) data.costFromLost = skill.costFromLost;
      if (skill.requires && skill.requires.length) data.requires = skill.requires;
      if (skill.input) data.input = skill.input;
      data.ops = skill.ops || [];
      if (skill.chargeOps && skill.chargeOps.length) data.chargeOps = skill.chargeOps;
      if (skill.hooks && Object.keys(skill.hooks).length) data.hooks = skill.hooks;
      if (skill.choices && skill.choices.length) data.choices = skill.choices;
      if (skill.unsupported) data.unsupported = skill.unsupported;
      list.push(JSON.stringify(data, null, 2));
    }
    const indented = list.map((item) => item.split("\n").map((line) => "    " + line).join("\n"));
    parts.push(indented.join(",\n"));
    parts.push("];");
  }

  parts.push("\n// ===== rpg6.0/data/skills/index.js · import 追加 =====");
  parts.push(imports.join("\n"));
  parts.push("\n// ===== rpg6.0/data/skills/index.js · characters 追加 =====");
  parts.push(registry.join("\n"));

  if (input.marks && Object.keys(input.marks).length) {
    parts.push("\n// ===== rpg6.0/data/skills/index.js · marks 追加 =====");
    const lines = [];
    for (const [owner, marks] of Object.entries(input.marks)) {
      lines.push("    " + JSON.stringify(owner) + ": " + JSON.stringify(marks));
    }
    parts.push(lines.join(",\n"));
  }
  if (input.summons && Object.keys(input.summons).length) {
    parts.push("\n// ===== rpg6.0/data/skills/index.js · summons 追加 =====");
    parts.push(Object.entries(input.summons)
      .map(([key, summon]) => "    " + JSON.stringify(key) + ": " + JSON.stringify(summon))
      .join(",\n"));
  }

  parts.push("\n// ===== _local/tests/engine/skills.test.mjs · SHEET 追加 =====");
  const sheet = {};
  for (const character of input.characters) {
    sheet[character.name] = character.skills.map((s) => [s.name, s.condition]);
  }
  parts.push(JSON.stringify(sheet, null, 2));

  parts.push("\n// ===== _local/tests/engine/skills.test.mjs · CHAR fixture =====");
  for (const [index, character] of input.characters.entries()) {
    const seedChar = seedByName.get(character.name);
    const fixture = character.fixture || ("c" + index);
    const fixtureId = character.fixtureId || ("t-" + fixture);
    const shown = Object.assign({}, seedStats(seedChar), character.statOverrides || {});
    parts.push(JSON.stringify(fixture) + ": { id: " + JSON.stringify(fixtureId) +
      ", name: " + JSON.stringify(character.name) +
      ", gender: " + JSON.stringify(seedChar.gender) +
      ", occupation: " + JSON.stringify(seedChar.occupation) +
      ", side_job: " + JSON.stringify(seedChar.side_job || "") +
      ", atk: " + JSON.stringify(shown.atk) +
      ", def: " + JSON.stringify(shown.def) +
      ", mres: " + JSON.stringify(shown.mres) +
      ", hp: " + JSON.stringify(shown.hp) +
      ", mp: " + JSON.stringify(shown.mp) +
      ", spd: " + JSON.stringify(shown.spd) + " },");
  }

  parts.push("\n// ===== 测试清单 =====");
  for (const character of input.characters) {
    for (const skill of character.skills) {
      if (skill.status === "implemented") {
        parts.push("- " + character.name + " · " + skill.name);
        for (const test of skill.tests || []) parts.push("  - " + test);
      }
    }
  }

  parts.push("\n// ===== 文档计数（预计） =====");
  parts.push("// 角色 " + (libCharactersCount() + newCharacters.length) +
    " / 技能 " + (libSkills.length + input.characters.reduce((n, c) => n + c.skills.length, 0)));
  parts.push("// 跑 node _local/tools/rpg6-stats.js --write 写回，再跑 audit-docs.mjs 与 check.ps1");

  return parts.join("\n");
}

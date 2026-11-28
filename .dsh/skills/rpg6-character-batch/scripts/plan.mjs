import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import {
  argValue,
  eachOp,
  findRoot,
  flattenLibrary,
  hasFlag,
  loadLibrary,
  loadSeed,
  norm,
  repoRoot,
  seedStats
} from "./lib.mjs";

const argv = process.argv.slice(2);
const root = findRoot(argv);
const checkFile = argValue(argv, "--check");
const scaffoldFile = argValue(argv, "--scaffold");
/* --scaffold --write：直接落盘（建技能文件、登记 index.js、机制文档一节、写回文档计数）。
   --check 校验后直接打印逐技能确认表，不用再加一个开关。 */
const writeFiles = hasFlag(argv, "--write");
const forceWrite = hasFlag(argv, "--force");
/* --mode=plan（默认）：实现前校验，角色已在技能库里就算错。
   --mode=verify：实现后验收，允许角色已在库里；文档计数只由 rpg6-stats.js --check 负责。 */
const mode = argValue(argv, "--mode") || "plan";
if (mode !== "plan" && mode !== "verify") {
  console.error("--mode 只接受 plan 或 verify");
  process.exit(2);
}
const file = checkFile || scaffoldFile;
if (!file) {
  console.error("用法：node plan.mjs --check plan.json [--mode=plan|verify] | --scaffold plan.json [--write] [--out 文件] [--root 仓库]");
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
  if (!/^[a-z][a-z0-9_-]*$/.test(String(character.fixture || ""))) {
    fail(character.name + " 的 fixture 只能是小写字母、数字、下划线或短横线（用作技能文件名）：" + character.fixture);
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

/* allowExisting 的条目是改已有角色，不该再加进预计总量。 */
const addedCharacters = (plan.characters || []).filter((c) => newCharacters.includes(c.name));
projectedSkills += addedCharacters.reduce((n, c) => n + (c.skills || []).length, 0);

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
      addedCharacters.reduce((n, c) => n + (c.skills || []).filter((s) => s.status === "implemented").length, 0),
    unsupported: projectedUnsupported +
      addedCharacters.reduce((n, c) => n + (c.skills || []).filter((s) => s.status && s.status !== "implemented").length, 0)
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
    parts.push(skillFileText(character));
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

  parts.push("\n// ===== 测试清单 =====");
  for (const character of input.characters) {
    for (const skill of character.skills) {
      if (skill.status === "implemented") {
        parts.push("- " + character.name + " · " + skill.name);
        for (const test of skill.tests || []) parts.push("  - " + test);
      }
    }
  }

  parts.push("\n// ===== 下一步 =====");
  parts.push("// 跑 plan.mjs --scaffold plan.json --write：建技能文件、登记 index.js、写机制文档骨架、写回文档计数");

  return parts.join("\n");
}

/* ---------------- 落盘（--scaffold --write） ---------------- */

/* index.js 里的四行锚点。删了它们 --write 会拒绝写盘，因为没法安全定位插入点。 */
const SCAFFOLD_MARKERS = {
  imports: "/* RPG6-SCAFFOLD:imports */",
  marks: "/* RPG6-SCAFFOLD:marks */",
  summons: "/* RPG6-SCAFFOLD:summons */",
  characters: "/* RPG6-SCAFFOLD:characters */"
};

function fixtureOf(character) {
  return String(character.fixture || "");
}

const KEY_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function keyText(key) {
  return KEY_RE.test(key) ? key : JSON.stringify(key);
}

/* 单行不超过 96 列的写成一行，超了才展开；输出是 JS 字面量，键名尽量不带引号。 */
function literal(value, depth) {
  const flat = flatText(value);
  if (flat.indexOf("\n") < 0 && flat.length + depth * 2 <= 96) return flat;
  const pad = "  ".repeat(depth);
  const inner = "  ".repeat(depth + 1);
  if (Array.isArray(value)) {
    return "[\n" + value.map((item) => inner + literal(item, depth + 1)).join(",\n") + "\n" + pad + "]";
  }
  const keys = Object.keys(value);
  return "{\n" + keys.map((key) => inner + keyText(key) + ": " + literal(value[key], depth + 1)).join(",\n") + "\n" + pad + "}";
}

function flatText(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "[" + value.map(flatText).join(", ") + "]";
  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (!keys.length) return "{}";
    return "{ " + keys.map((key) => keyText(key) + ": " + flatText(value[key])).join(", ") + " }";
  }
  return JSON.stringify(value);
}

/* plan 的技能对象 → 技能库里的技能对象（notes 只留在 plan 里，不写进游戏数据）。 */
function skillData(skill) {
  const data = { id: skill.id, name: skill.name, conditionText: skill.condition };
  if (skill.passive) data.passive = true;
  data.cost = skill.cost || { mp: 0 };
  data.charge = Number(skill.charge) || 0;
  data.cooldown = Number(skill.cooldown) || 0;
  data.target = skill.target || "enemy";
  if (skill.once) data.once = true;
  if (skill.noAction) data.noAction = true;
  if (skill.costFromLost) data.costFromLost = skill.costFromLost;
  if (skill.requires && skill.requires.length) data.requires = skill.requires;
  if (skill.input) data.input = skill.input;
  data.ops = skill.ops || [];
  if (skill.chargeOps && skill.chargeOps.length) data.chargeOps = skill.chargeOps;
  if (skill.hooks && Object.keys(skill.hooks).length) data.hooks = skill.hooks;
  if (skill.choices && skill.choices.length) data.choices = skill.choices;
  if (skill.unsupported) data.unsupported = skill.unsupported;
  return data;
}

function skillFileText(character) {
  const items = character.skills.map((skill) => "  " + literal(skillData(skill), 1));
  return "/* 回合制正传 6.0 · 技能库 · " + character.name + "（plan.mjs --write 生成，之后直接改这里） */\n" +
    "export default [\n" + items.join(",\n") + "\n];\n";
}

/* 逐技能确认表：条件、目标、费用、蓄力、冷却、裁定，签完再落盘。 */
function renderTable(input) {
  const lines = [
    "| 角色 | 技能 | 条件 | 目标 | 费用 | 蓄力 | 冷却 | 状态 | 裁定 |",
    "|---|---|---|---|---|---|---|---|---|"
  ];
  for (const character of input.characters) {
    for (const skill of character.skills) {
      const status = skill.status === "implemented" ? "实现" : skill.status === "engine-gap" ? "缺引擎" : "置灰";
      lines.push("| " + [
        character.name,
        skill.name,
        skill.condition,
        skill.target || "enemy",
        costText(skill),
        skill.charge ? String(skill.charge) : "-",
        skill.cooldown ? String(skill.cooldown) : "-",
        status,
        skill.notes || skill.unsupported || ""
      ].map(cellText).join(" | ") + " |");
    }
  }
  return lines.join("\n");
}

function cellText(value) {
  return String(value == null ? "" : value).replace(/\|/g, "\\|");
}

function costText(skill) {
  const cost = skill.cost || {};
  const parts = [];
  if (cost.mp) parts.push("蓝" + cost.mp);
  if (cost.hp) parts.push("血" + cost.hp);
  if (cost.def) parts.push("防" + cost.def);
  if (cost.maxMp) parts.push("蓝上限" + cost.maxMp);
  return parts.length ? parts.join(" + ") : "-";
}

const SECTION_HEADERS = {
  [SCAFFOLD_MARKERS.imports]: "import ",
  [SCAFFOLD_MARKERS.marks]: "marks: {",
  [SCAFFOLD_MARKERS.summons]: "summons: {",
  [SCAFFOLD_MARKERS.characters]: "characters: {"
};

function sectionText(text, marker) {
  const at = text.indexOf(marker);
  if (at < 0) return "";
  const from = text.lastIndexOf(SECTION_HEADERS[marker], at);
  return from < 0 ? "" : text.slice(from, at);
}

/* 插到锚点所在行的行首，块的缩进由调用方给，不会叠出 8 个空格。 */
function insertBlock(text, marker, block) {
  const at = text.indexOf(marker);
  const lineStart = text.lastIndexOf("\n", at) + 1;
  return text.slice(0, lineStart) + block + text.slice(lineStart);
}

function addImports(text, fixtures) {
  const marker = SCAFFOLD_MARKERS.imports;
  const end = text.indexOf(marker);
  const start = text.indexOf("import ");
  const lines = text.slice(start, end).split("\n").filter((line) => line.startsWith("import "));
  for (const fixture of fixtures) lines.push('import ' + fixture + ' from "./' + fixture + '.js";');
  return text.slice(0, start) + lines.sort().join("\n") + "\n" + text.slice(end);
}

/* 机制文档的骨架直接用 plan.notes 当正文：notes 是确认表里签过的那列，
   不再让人对着 plan 再抄一遍；没写 notes 的留「待补」，lint 会拦。 */
function docSkeleton(character) {
  const lines = ["", "## " + character.name + "（" + fixtureOf(character) + "）", ""];
  for (const skill of character.skills) {
    const note = String(skill.notes || "").trim();
    lines.push("- **" + skill.name + "（" + skill.condition + "）** <!-- skill:" + skill.id + " -->：" + (note || "待补"));
  }
  return lines.join("\n") + "\n";
}

async function writeScaffold(input) {
  const problems = [];
  const indexFile = path.join(root, "rpg6.0", "data", "skills", "index.js");
  const docFile = path.join(root, "_local", "docs", "回合制6.0测试功能-角色机制.md");
  const index = fs.existsSync(indexFile) ? fs.readFileSync(indexFile, "utf8") : "";

  if (!index) problems.push("读不到 rpg6.0/data/skills/index.js");
  for (const marker of Object.values(SCAFFOLD_MARKERS)) {
    const count = index.split(marker).length - 1;
    if (count !== 1) problems.push("index.js 的锚点 " + marker + " 出现 " + count + " 次，应恰好 1 次；不要删锚点行");
  }

  const planned = [];
  for (const character of input.characters) {
    const fixture = fixtureOf(character);
    const file = path.join(root, "rpg6.0", "data", "skills", fixture + ".js");
    if (fs.existsSync(file) && !forceWrite) problems.push("rpg6.0/data/skills/" + fixture + ".js 已存在（要覆盖加 --force）");
    if (index.includes('import ' + fixture + ' from "')) problems.push("index.js 里已经 import 过 " + fixture);
    if (sectionText(index, SCAFFOLD_MARKERS.characters).includes('"' + character.name + '":')) {
      problems.push("index.js 的 characters 里已经有 " + character.name);
    }
    planned.push({ character, fixture, file, text: skillFileText(character) });
  }
  for (const owner of Object.keys(input.marks || {})) {
    if (sectionText(index, SCAFFOLD_MARKERS.marks).includes('    "' + owner + '":')) {
      problems.push("index.js 的 marks 里已经有 " + owner + "（合并进已有条目，别重复登记）");
    }
  }
  for (const key of Object.keys(input.summons || {})) {
    if (sectionText(index, SCAFFOLD_MARKERS.summons).includes('"' + key + '":')) {
      problems.push("index.js 的 summons 里已经有 " + key);
    }
  }
  if (problems.length) {
    for (const problem of problems) console.error("ERROR " + problem);
    console.error("\n没有写任何文件。");
    process.exit(1);
  }

  const summary = [];
  for (const item of planned) {
    fs.writeFileSync(item.file, item.text, "utf8");
    summary.push("新建 rpg6.0/data/skills/" + item.fixture + ".js（" + item.character.skills.length + " 条技能）");
  }

  let next = addImports(index, planned.map((item) => item.fixture));
  const markEntries = Object.entries(input.marks || {});
  if (markEntries.length) {
    next = insertBlock(next, SCAFFOLD_MARKERS.marks,
      markEntries.map(([owner, marks]) => "    " + JSON.stringify(owner) + ": " + literal(marks, 2) + ",\n").join(""));
    summary.push("index.js 登记 marks：" + markEntries.map(([owner]) => owner).join("、"));
  }
  const summonEntries = Object.entries(input.summons || {});
  if (summonEntries.length) {
    next = insertBlock(next, SCAFFOLD_MARKERS.summons,
      summonEntries.map(([key, summon]) => "    " + JSON.stringify(key) + ": " + literal(summon, 2) + ",\n").join(""));
    summary.push("index.js 登记 summons：" + summonEntries.map(([key]) => key).join("、"));
  }
  next = insertBlock(next, SCAFFOLD_MARKERS.characters,
    planned.map((item) => "    " + JSON.stringify(item.character.name) + ": " + item.fixture + ",\n").join(""));
  fs.writeFileSync(indexFile, next, "utf8");
  summary.push("index.js 登记 characters：" + planned.map((item) => item.character.name).join("、") + "（" + planned.length + " 人）");

  if (fs.existsSync(docFile)) {
    let doc = fs.readFileSync(docFile, "utf8");
    for (const item of planned) {
      doc += docSkeleton(item.character);
      summary.push("机制文档追加 " + item.character.name + " 的 " + item.character.skills.length + " 个锚点（正文写「待补」）");
    }
    fs.writeFileSync(docFile, doc, "utf8");
  } else {
    summary.push("SKIP 没有 _local/docs/回合制6.0测试功能-角色机制.md，锚点骨架未写");
  }

  summary.push(...(await writeDocCounts()));

  console.log("\n已落盘：");
  for (const line of summary) console.log("  " + line);
  console.log("\n下一步：");
  console.log("  1. 有 engine-gap 才写引擎与单测；改规则后 node tools/rpg6-bump.mjs <新版本>");
  console.log("  2. 机制文档正文取自 plan.notes；notes 空着的会留「待补」，补上后 rpg6-lint 才会过");
  console.log("  3. 验收：verify.ps1 -Plan <plan>（改了页面才加 -Browser）");
}

/* 文档计数直接调 rpg6-stats 的渲染逻辑，不派生子进程（DSH 沙箱下 spawn 会 EPERM）。 */
async function writeDocCounts() {
  const file = path.join(root, "tools", "rpg6-stats.js");
  if (!fs.existsSync(file)) return ["SKIP 没有 tools/rpg6-stats.js，文档计数未写回"];
  if (path.resolve(root) !== path.resolve(repoRoot())) return ["SKIP 演练目录不写文档计数"];
  const require = createRequire(import.meta.url);
  const tool = require(file);
  const stats = await tool.computeStats();
  const out = [];
  for (const doc of tool.DOCS) {
    if (!fs.existsSync(doc.file)) continue;
    const before = fs.readFileSync(doc.file, "utf8");
    const result = tool.renderDocument(before, stats, doc.file);
    if (result.errors.length) {
      out.push("文档计数区间有问题（" + doc.file + "）：" + result.errors.join("；"));
      continue;
    }
    if (result.text === before) continue;
    fs.writeFileSync(doc.file, result.text, "utf8");
    out.push("写回文档计数 " + path.relative(root, doc.file).replace(/\\/g, "/"));
  }
  out.push("文档计数：" + stats.characters + " 名角色 / " + stats.skills + " 条技能");
  return out;
}

/* 入口放在文件末尾：上面的 const 必须先初始化，否则 writeScaffold 读标记表会撞 TDZ。 */
if (checkFile) console.log("\n" + renderTable(plan));

if (scaffoldFile) {
  if (writeFiles) {
    await writeScaffold(plan);
  } else {
    const text = scaffold(plan);
    const out = argValue(argv, "--out");
    if (out) {
      fs.writeFileSync(path.resolve(out), text, "utf8");
      console.log("脚手架写到 " + path.resolve(out));
    } else {
      console.log("\n" + text);
    }
  }
}

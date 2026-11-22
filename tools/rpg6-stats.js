/* ============================================================
   rpg6-stats.js —— 文档里的角色数 / 技能数 / op 数 / 版本号，构建时生成
   ------------------------------------------------------------
   文档不手写这些数字，改由本脚本按技能库与引擎现算，写进带名字的标记区间：

     <!-- RPG6-STATS:START ops -->34<!-- RPG6-STATS:END ops -->
     <!-- RPG6-STATS:START ops-table -->…<!-- RPG6-STATS:END ops-table -->

   区间名就是生成器名（见下面的 RENDERERS），整段内容由脚本重写，
   名字写错、START 与 END 对不上、区间为空都会报错。区间外的句子仍是手写。

   用法：
     node tools/rpg6-stats.js            # 只比对，不一致退出 1
     node tools/rpg6-stats.js --check    # 同上
     node tools/rpg6-stats.js --write    # 写回磁盘
     node tools/rpg6-stats.js --json     # 打印统计数字
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const SPEC = require("./rpg6-spec.js");

const ROOT = path.resolve(__dirname, "..");
const SKILLS_INDEX = path.join(ROOT, "rpg6.0", "data", "skills", "index.js");
const PAGE_FILE = path.join(ROOT, "rpg6.0", "test.html");

/* 参与生成的文档：面向玩家的说明、模块 README 与架构、项目自检说明、agent 用的 skill。
   其余文档不再复制这些数字——需要时指向《游戏说明》，省得为多份拷贝写巡检。 */
const DOCS = [
  { file: path.join(ROOT, "rpg6.0", "游戏说明.md"), optional: false },
  { file: path.join(ROOT, "rpg6.0", "README.md"), optional: false },
  { file: path.join(ROOT, "rpg6.0", "架构.md"), optional: false },
  { file: path.join(ROOT, "tools", "README.md"), optional: false },
  { file: path.join(ROOT, ".dsh", "skills", "rpg6-battle", "SKILL.md"), optional: false },
  { file: path.join(ROOT, ".dsh", "skills", "rpg6-character-batch", "引擎能力表.md"), optional: false }
];

/* 区间名 → 生成器。新增一处文档数字就在这里加一个生成器，文档里不用写死。 */
const RENDERERS = {
  chars: (s) => String(s.characters),
  skills: (s) => String(s.skills),
  ops: (s) => String(s.ops),
  unsupported: (s) => String(s.unsupported),
  version: (s) => s.version,
  scripts: (s) => String(s.scripts),
  charsSkills: (s) => s.characters + " 名角色 / " + s.skills + " 条技能",
  charsSkillsShort: (s) => s.characters + " 人 " + s.skills + " 条技能",
  "ops-table": (s) => SPEC.renderOpTable(s.opNames),
  hooks: () => SPEC.HOOKS.map((name) => "`" + name + "`").join("、"),
  "unsupported-table": (s) => {
    const lines = ["| 角色 · 技能 | 原因 |", "|---|---|"];
    for (const item of s.unsupportedList) {
      lines.push("| " + item.owner + " · " + item.name + " | " + String(item.reason).replace(/\|/g, "\\|") + " |");
    }
    return lines.join("\n");
  }
};

const REGION_RE = /<!--\s*RPG6-STATS:START(?:\s+([A-Za-z0-9_-]+))?\s*-->([\s\S]*?)<!--\s*RPG6-STATS:END(?:\s+([A-Za-z0-9_-]+))?\s*-->/g;

/* ---------------- 取数 ---------------- */

function readInSandbox(fileOrFiles, expr) {
  const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  for (const file of files) {
    vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  }
  return vm.runInContext(expr, sandbox);
}

function loadEngine() {
  const files = ["version.js", "effect-ops.js", "effect-ops-helpers.js", "ops/ops-damage.js", "ops/ops-flow.js", "ops/ops-state.js"].map((n) => path.join(ROOT, "rpg6.0", "js", "engine", n));
  const B = readInSandbox(files, "globalThis.RPG6B") || {};
  return { version: B.ENGINE_VERSION || "", opNames: (B.effectOps && B.effectOps.opNames) || [] };
}

function countScripts() {
  if (!fs.existsSync(PAGE_FILE)) return 0;
  const html = fs.readFileSync(PAGE_FILE, "utf8");
  return (html.match(/<script\s+src=/g) || []).length;
}

async function computeStats() {
  const lib = (await import(require("node:url").pathToFileURL(SKILLS_INDEX).href)).default;
  const engine = loadEngine();
  const chars = lib.characters || {};
  let skills = 0;
  let unsupported = 0;
  const perCharacter = {};
  const unsupportedList = [];
  for (const owner of Object.keys(chars)) {
    const list = Array.isArray(chars[owner]) ? chars[owner] : [];
    perCharacter[owner] = list.length;
    skills += list.length;
    for (const skill of list) {
      if (skill && (skill.baseUnsupported || skill.unsupported)) {
        unsupported += 1;
        unsupportedList.push({ owner, name: skill.name || "", reason: skill.unsupported || skill.baseUnsupported || "" });
      }
    }
  }
  return {
    characters: Object.keys(chars).length,
    skills,
    unsupported,
    unsupportedList,
    ops: engine.opNames.length,
    opNames: engine.opNames,
    version: engine.version,
    scripts: countScripts(),
    perCharacter
  };
}

/* ---------------- 渲染 ---------------- */

/* 把整份文件里的区间重写一遍；返回 { text, regions, errors } */
function renderDocument(text, stats, file) {
  const errors = [];
  let regions = 0;
  const out = text.replace(REGION_RE, (whole, startKey, inner, endKey) => {
    regions += 1;
    const key = startKey || "";
    if (key !== (endKey || "")) {
      errors.push(file + ": 区间的 START/END 名字不一致（" + (startKey || "无") + " / " + (endKey || "无") + "）");
      return whole;
    }
    if (!key) {
      errors.push(file + ": 区间没写名字，写成 <!-- RPG6-STATS:START 名字 -->，可用 " + Object.keys(RENDERERS).join("/"));
      return whole;
    }
    const render = RENDERERS[key];
    if (!render) {
      errors.push(file + ": 不认识的区间名 " + key + "，可用 " + Object.keys(RENDERERS).join("/"));
      return whole;
    }
    const rendered = render(stats);
    const body = rendered.indexOf("\n") >= 0 ? "\n" + rendered + "\n" : rendered;
    return "<!-- RPG6-STATS:START " + key + " -->" + body + "<!-- RPG6-STATS:END " + key + " -->";
  });
  return { text: out, regions, errors };
}

function firstDiffLine(a, b) {
  const left = a.split("\n");
  const right = b.split("\n");
  const n = Math.max(left.length, right.length);
  for (let i = 0; i < n; i++) {
    if (left[i] !== right[i]) return { line: i + 1, want: (right[i] == null ? "" : right[i]).trim(), got: (left[i] == null ? "" : left[i]).trim() };
  }
  return null;
}

/* ---------------- 入口 ---------------- */

async function main(argv) {
  const write = argv.indexOf("--write") >= 0;
  const json = argv.indexOf("--json") >= 0;
  const stats = await computeStats();

  if (json) {
    const printed = Object.assign({}, stats);
    delete printed.opNames;
    console.log(JSON.stringify(printed, null, 2));
    return 0;
  }

  console.log("统计：" + stats.characters + " 名角色 / " + stats.skills + " 条技能 / " +
    stats.unsupported + " 条 unsupported / " + stats.opNames.length + " 个 op / " + stats.version);

  const errors = [];
  let totalRegions = 0;
  const pending = [];

  for (const doc of DOCS) {
    const rel = path.relative(ROOT, doc.file).replace(/\\/g, "/");
    if (!fs.existsSync(doc.file)) {
      if (doc.optional) continue;
      errors.push(rel + ": 文件不存在");
      continue;
    }
    const before = fs.readFileSync(doc.file, "utf8");
    const result = renderDocument(before, stats, rel);
    totalRegions += result.regions;
    errors.push(...result.errors);
    pending.push({ file: doc.file, rel, before, after: result.text });
  }

  if (errors.length) {
    console.log("\n不一致（" + errors.length + "）");
    for (const err of errors) console.log("  " + err);
    return 1;
  }

  let changed = 0;
  for (const item of pending) {
    if (item.before === item.after) continue;
    if (write) {
      fs.writeFileSync(item.file, item.after, "utf8");
      changed += 1;
      console.log("  已更新 " + item.rel);
      continue;
    }
    const diff = firstDiffLine(item.before, item.after);
    errors.push(item.rel + ":" + (diff ? diff.line : "?") + " 数字与技能库不一致\n      磁盘：" +
      (diff ? diff.got : "") + "\n      应为：" + (diff ? diff.want : ""));
  }

  if (errors.length) {
    console.log("\n不一致（" + errors.length + "）");
    for (const err of errors) console.log("  " + err);
    console.log("\n跑 node tools/rpg6-stats.js --write 写回，或手工改被点名的行");
    return 1;
  }
  if (!write) console.log("\n" + totalRegions + " 个区间与技能库一致");
  else if (!changed) console.log("\n" + totalRegions + " 个区间本来就是最新的");
  return 0;
}

module.exports = { computeStats, renderDocument, RENDERERS, DOCS };

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code)).catch((err) => {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  });
}

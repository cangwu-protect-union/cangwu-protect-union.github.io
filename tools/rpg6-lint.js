/* ============================================================
   rpg6-lint.js —— 技能库结构校验（只读，不改引擎行为）
   ------------------------------------------------------------
   把「字段写错、mark 没声明、op 不存在、引用了不存在的技能」这类问题
   从运行时抛错提前到提交前失败。运行时引擎遇到未知 op 才抛错，遇到
   没声明的 mark 直接静默 return，这两种都跑不出红字。

   用法：
     node tools/rpg6-lint.js            # 人看，非零退出码表示有错
     node tools/rpg6-lint.js --json     # 机器读
     node tools/rpg6-lint.js --warn     # 只提醒，始终退出 0
     node tools/rpg6-lint.js --file=…   # 校验另一份技能库（默认 data/skills/index.js）

   校验分两层：
     lintLibrary 只看技能库本身，纯函数，单测直接喂坏样本；
     其余 check* 要读别的文件（op 表、版本号、test.html、机制文档锚点），只在 CLI 里跑。
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const SPEC = require("./rpg6-spec.js");

const ROOT = path.resolve(__dirname, "..");
const ENGINE = path.join(ROOT, "rpg6.0", "js", "engine");
const SKILLS_INDEX = path.join(ROOT, "rpg6.0", "data", "skills", "index.js");
const CHARACTERS_FILES = ["characters.js", "characters-2.js", "characters-3.js", "characters-4.js"].map((n) => path.join(ROOT, "rpg6.0", "data", "seeds", n));
const CONFIG_FILE = path.join(ROOT, "rpg6.0", "data", "config.js");
const PAGE_FILE = path.join(ROOT, "rpg6.0", "test.html");
const MECHANISM_DOC = path.join(ROOT, "_local", "docs", "回合制6.0测试功能-角色机制.md");

/* 引擎加载顺序（唯一权威在 js/engine/index.js 的 import 顺序，这里只是校验基准） */
const LOAD_ORDER = ["version", "rng", "rules", "traits", "state", "damage", "effect-ops", "effect-ops-helpers", "ops/ops-damage", "ops/ops-flow", "ops/ops-state", "timeline", "conditions", "skills", "skills-target", "summons", "actions", "battle"];

/* ---------------- 读数据 ---------------- */

function loadEngine() {
  for (const name of LOAD_ORDER) {
    const file = path.join(ENGINE, name + ".js");
    if (!fs.existsSync(file)) throw new Error("缺少引擎文件：" + file);
    require(file);
  }
  return globalThis.RPG6B;
}

function readInSandbox(fileOrFiles, expr) {
  const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  for (const file of files) {
    vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  }
  return vm.runInContext(expr, sandbox);
}

async function loadLibrary(file) {
  if (file) {
    const lib = readInSandbox([file], "window.RPG6_SKILLS");
    if (!lib || typeof lib !== "object") throw new Error("技能库没有挂到 window.RPG6_SKILLS");
    return lib;
  }
  const mod = await import(require("node:url").pathToFileURL(SKILLS_INDEX).href);
  const lib = mod.default;
  if (!lib || typeof lib !== "object") throw new Error("技能库 index.js 没有 default 导出");
  return lib;
}

function loadRoster() {
  const all = readInSandbox(CHARACTERS_FILES, "window.RPG_SEED_CHARACTERS") || [];
  return all.filter((c) => c && !c.deleted);
}

/* ---------------- 遍历 ---------------- */

function eachSkill(lib) {
  const out = [];
  const chars = lib.characters || {};
  for (const owner of Object.keys(chars)) {
    const list = chars[owner];
    if (!Array.isArray(list)) continue;
    for (const skill of list) out.push({ owner, skill });
  }
  return out;
}

/* 技能里所有的 op 树：默认 ops、choices[].ops、chargeOps、hooks.* */
function eachOpTree(skill, visit) {
  walkOpList(skill.ops, "ops", visit);
  if (Array.isArray(skill.choices)) {
    for (let i = 0; i < skill.choices.length; i++) {
      walkOpList(skill.choices[i] && skill.choices[i].ops, "choices[" + i + "].ops", visit);
    }
  }
  walkOpList(skill.chargeOps, "chargeOps", visit);
  const hooks = skill.hooks || {};
  for (const kind of Object.keys(hooks)) walkOpList(hooks[kind], "hooks." + kind, visit);
}

function walkOpList(list, at, visit) {
  if (list == null) return;
  if (!Array.isArray(list)) {
    visit(null, at);
    return;
  }
  for (let i = 0; i < list.length; i++) walkOp(list[i], at + "[" + i + "]", visit);
}

function walkOp(op, at, visit) {
  visit(op, at);
  if (!op || typeof op !== "object" || Array.isArray(op)) return;
  walkOpList(op.ops, at + ".ops", visit);
  walkOpList(op.then, at + ".then", visit);
  walkOpList(op.else, at + ".else", visit);
  if (Array.isArray(op.cases)) {
    for (let i = 0; i < op.cases.length; i++) {
      walkOpList(op.cases[i] && op.cases[i].ops, at + ".cases[" + i + "].ops", visit);
    }
  }
}

/* 全库扫描一遍：谁声明了哪些标记、哪些计数器被写过 */
function collectUsage(lib) {
  const marksByOwner = {};
  for (const owner of Object.keys(lib.marks || {})) {
    const defs = lib.marks[owner] || [];
    marksByOwner[owner] = defs.map((d) => (d && d.key) || "").filter(Boolean);
  }
  const allMarks = new Set();
  for (const owner of Object.keys(marksByOwner)) for (const key of marksByOwner[owner]) allMarks.add(key);

  const countersWritten = new Set();
  for (const entry of eachSkill(lib)) {
    eachOpTree(entry.skill, (op) => {
      if (!op || typeof op !== "object") return;
      if ((op.op === "counter" || op.op === "roll") && op.key) countersWritten.add(String(op.key));
    });
  }
  return { marksByOwner, allMarks, countersWritten };
}

function isFiniteNumber(v) {
  return typeof v === "number" && isFinite(v);
}

/* ---------------- 一层：只校验技能库 ---------------- */

function lintLibrary(lib, options) {
  const opts = options || {};
  const B = opts.B || null;
  const problems = [];
  const warnings = [];

  function fail(owner, skill, where, reason) {
    problems.push({ owner, skill, where, reason });
  }
  function warn(owner, skill, where, reason) {
    warnings.push({ owner, skill, where, reason });
  }

  if (!lib || typeof lib !== "object") {
    fail("", "", "library", "技能库不是对象");
    return { problems, warnings };
  }

  const chars = lib.characters || {};
  const summons = lib.summons || {};
  const usage = collectUsage(lib);
  const marksByOwner = usage.marksByOwner;
  const allMarks = usage.allMarks;
  const countersWritten = usage.countersWritten;
  const skillIds = new Set(eachSkill(lib).map((e) => (e.skill || {}).id).filter(Boolean));
  const idCount = {};
  for (const entry of eachSkill(lib)) {
    const id = (entry.skill || {}).id;
    if (id) idCount[id] = (idCount[id] || 0) + 1;
  }

  function declaredFor(owner, key) {
    return (marksByOwner[owner] || []).indexOf(key) >= 0;
  }

  /* 角色块与标记声明 */
  for (const owner of Object.keys(marksByOwner)) {
    if (!chars[owner]) warn(owner, "", "marks", "声明了标记，但技能库里没有这个角色");
    const defs = lib.marks[owner] || [];
    for (let i = 0; i < defs.length; i++) {
      const def = defs[i] || {};
      const where = "marks[" + i + "]";
      if (!def.key) fail(owner, "", where, "标记缺少 key");
      if (def.max != null && !isFiniteNumber(def.max)) fail(owner, "", where, "max 不是数字");
      if (def.init != null && !isFiniteNumber(def.init)) fail(owner, "", where, "init 不是数字");
    }
  }
  for (const owner of Object.keys(chars)) {
    if (!Array.isArray(chars[owner])) fail(owner, "", "characters", "角色块不是数组");
    else if (!chars[owner].length) warn(owner, "", "characters", "角色块是空的");
  }

  /* 召唤物定义 */
  for (const key of Object.keys(summons)) {
    const def = summons[key] || {};
    if (!def.name) fail("", key, "summons", "召唤物缺少 name");
    if (def.ttl != null && !isFiniteNumber(def.ttl)) fail("", key, "summons", "ttl 不是数字");
    if (def.stats && typeof def.stats !== "object") fail("", key, "summons", "stats 不是对象");
    if (def.attack && !(def.stats && Number(def.stats.spd) > 0)) {
      fail("", key, "summons", "定义了 attack 的召唤物必须有正数速度，否则按速度攒条永远不出手");
    }
  }

  /* 技能对象 + op 树 */
  for (const entry of eachSkill(lib)) {
    const owner = entry.owner;
    const skill = entry.skill || {};
    const label = skill.name || skill.id || "(未命名)";

    for (const key of Object.keys(skill)) {
      if (SPEC.SKILL_FIELDS.indexOf(key) < 0) warn(owner, label, key, "技能对象上没见过的字段，引擎不会读它");
    }

    if (!skill.id) fail(owner, label, "id", "缺少 id");
    else if (idCount[skill.id] > 1) fail(owner, label, "id", "id 重复：" + skill.id + "（skills.load 会直接抛错）");
    if (!skill.name) fail(owner, label, "name", "缺少 name");
    if (!skill.conditionText) fail(owner, label, "conditionText", "缺少 conditionText，无法与档案比对");
    if (SPEC.TARGETS.indexOf(skill.target) < 0) {
      fail(owner, label, "target", "target 取值非法：" + JSON.stringify(skill.target) + "，应为 " + SPEC.TARGETS.join("/"));
    }

    const cost = skill.cost || {};
    if (cost.mp != null && !isFiniteNumber(cost.mp)) fail(owner, label, "cost.mp", "不是数字");
    if (cost.hp != null && !isFiniteNumber(cost.hp)) fail(owner, label, "cost.hp", "不是数字");
    if (skill.charge != null && !isFiniteNumber(skill.charge)) fail(owner, label, "charge", "不是数字");
    if (skill.cooldown != null && !isFiniteNumber(skill.cooldown)) fail(owner, label, "cooldown", "不是数字");
    if (skill.once != null && typeof skill.once !== "boolean") fail(owner, label, "once", "只接受 true/false");
    if (skill.passive != null && typeof skill.passive !== "boolean") fail(owner, label, "passive", "只接受 true/false");
    if (skill.costFromLost && (!isFiniteNumber(skill.costFromLost.per) || skill.costFromLost.per <= 0)) {
      fail(owner, label, "costFromLost.per", "需要正数");
    }
    if (skill.input && !isFiniteNumber(skill.input.min)) fail(owner, label, "input.min", "需要数字");
    if (skill.rollDodge) {
      if (!isFiniteNumber(skill.rollDodge.sides)) fail(owner, label, "rollDodge.sides", "需要数字");
      if (!Array.isArray(skill.rollDodge.values) || !skill.rollDodge.values.length) {
        fail(owner, label, "rollDodge.values", "需要非空数组");
      }
    }
    if (skill.buffImmune != null) {
      if (!Array.isArray(skill.buffImmune)) fail(owner, label, "buffImmune", "需要数组");
      else for (const kind of skill.buffImmune) {
        if (SPEC.BUFF_KINDS.indexOf(kind) < 0) fail(owner, label, "buffImmune", "不是四类 Buff：" + kind);
      }
    }
    if (skill.ops != null && !Array.isArray(skill.ops)) fail(owner, label, "ops", "需要数组");
    if (skill.chargeOps != null && !Array.isArray(skill.chargeOps)) fail(owner, label, "chargeOps", "需要数组");
    if (skill.choices != null && !Array.isArray(skill.choices)) fail(owner, label, "choices", "需要数组");

    const hooks = skill.hooks || {};
    for (const kind of Object.keys(hooks)) {
      if (SPEC.HOOKS.indexOf(kind) < 0) {
        fail(owner, label, "hooks." + kind, "引擎不会调用这个钩子，应为 " + SPEC.HOOKS.join("/"));
      }
      if (hooks[kind] != null && !Array.isArray(hooks[kind])) fail(owner, label, "hooks." + kind, "需要数组");
    }

    if (Array.isArray(skill.choices)) {
      skill.choices.forEach((choice, i) => {
        const where = "choices[" + i + "]";
        if (!choice || typeof choice !== "object") {
          fail(owner, label, where, "不是对象");
          return;
        }
        if (!choice.key) fail(owner, label, where, "缺少 key");
        if (!Array.isArray(choice.ops)) fail(owner, label, where + ".ops", "需要数组");
      });
    }

    if (Array.isArray(skill.requires)) {
      skill.requires.forEach((req, i) => {
        const where = "requires[" + i + "]";
        if (!req || typeof req !== "object") {
          fail(owner, label, where, "不是对象");
          return;
        }
        if (!req.mark) fail(owner, label, where, "缺少 mark");
        else if (!declaredFor(owner, req.mark)) fail(owner, label, where + ".mark", "「" + req.mark + "」没有在 marks 里声明");
        if (req.gte == null && req.lte == null && req.eq == null) fail(owner, label, where, "需要 gte / lte / eq 之一");
      });
    }

    eachOpTree(skill, (op, at) => checkOpNode(op, at, owner, label));
  }

  function checkOpNode(op, at, owner, label) {
    if (!op || typeof op !== "object" || Array.isArray(op)) {
      fail(owner, label, at, "不是对象");
      return;
    }
    const name = op.op;
    if (!name || typeof name !== "string") {
      fail(owner, label, at, "缺少 op 字段");
      return;
    }
    const spec = SPEC.OPS[name];
    if (!spec) {
      fail(owner, label, at, "未知 op：" + name + "（engine/ops/ 里没有注册）");
      return;
    }
    if (B && B.effectOps && Array.isArray(B.effectOps.opNames) && B.effectOps.opNames.indexOf(name) < 0) {
      fail(owner, label, at, "未知 op：" + name + "（不在 opNames 里）");
      return;
    }
    for (const key of Object.keys(op)) {
      if (SPEC.allowedFields(name).indexOf(key) < 0) {
        fail(owner, label, at + "." + key, "这个 op 不认的字段（引擎会静默忽略）");
      }
    }
    for (const key of spec.required || []) {
      /* 防护层 tick：ops 可为空，取消次数用完后执行的是 guard.ops */
      if (name === "tick" && key === "ops" && op.guard) continue;
      if (op[key] == null) fail(owner, label, at, "缺少必填字段 " + key);
    }
    for (const key of Object.keys(spec.enums || {})) {
      if (op[key] == null) continue;
      if (spec.enums[key].indexOf(op[key]) < 0) {
        fail(owner, label, at + "." + key, "取值非法：" + JSON.stringify(op[key]) + "，应为 " + spec.enums[key].join("/"));
      }
    }
    if (op.who != null) {
      const whoList = typeof op.who === "object"
        ? [op.who && op.who.of]
        : [op.who];
      const whoBad = whoList.some((w) => SPEC.WHOS.indexOf(w) < 0);
      if (whoBad) {
        fail(owner, label, at + ".who", "取值非法：" + JSON.stringify(op.who) + "，应为 " + SPEC.WHOS.join("/") + " 或 {of,limit}");
      }
    }
    for (const key of ["value", "delta", "percent", "bonus"]) {
      if (op[key] != null && typeof op[key] === "object") checkExpr(op[key], at + "." + key, owner, label);
    }

    if (name === "mark") {
      if (op.key && (op.who == null || op.who === "self")) {
        if (!declaredFor(owner, op.key)) {
          fail(owner, label, at + ".key", "「" + op.key + "」没有在本角色的 marks 里声明（运行时会静默不生效）");
        }
      } else if (op.key && !allMarks.has(op.key)) {
        fail(owner, label, at + ".key", "「" + op.key + "」在任何角色的 marks 里都没有声明");
      }
      if (op.mode === "set" && op.value == null) fail(owner, label, at, "mode:\"set\" 必须带 value");
    }
    if (name === "markClear" && op.key && !allMarks.has(op.key)) {
      fail(owner, label, at + ".key", "「" + op.key + "」在任何角色的 marks 里都没有声明");
    }
    if (name === "use" && op.skillId && !skillIds.has(op.skillId)) {
      fail(owner, label, at + ".skillId", "引用的技能不存在：" + op.skillId);
    }
    if (name === "summon" && op.key && !summons[op.key]) {
      fail(owner, label, at + ".key", "summons 里没有这个召唤物：" + op.key);
    }
    if (name === "dice") {
      const cases = op.cases || [];
      if (!cases.length) fail(owner, label, at, "dice 没有 cases");
      cases.forEach((item, i) => {
        const where = at + ".cases[" + i + "]";
        if (!item || typeof item !== "object") {
          fail(owner, label, where, "不是对象");
          return;
        }
        if (item.in == null && item.roll == null) fail(owner, label, where, "需要 in 或 roll");
        if (item.in != null) {
          if (!Array.isArray(item.in)) fail(owner, label, where + ".in", "需要数组");
          else if (!item.in.length) fail(owner, label, where + ".in", "不能是空数组");
          else for (const n of item.in) if (!isFiniteNumber(n)) fail(owner, label, where + ".in", "需要数字");
        }
        if (!Array.isArray(item.ops)) fail(owner, label, where + ".ops", "需要数组");
      });
    }
    if (name === "if") {
      const cond = op.cond;
      if (!cond || typeof cond !== "object") {
        fail(owner, label, at + ".cond", "需要对象");
      } else {
        const kinds = ["gender", "status", "effect", "summon", "summonCount"].filter((k) => cond[k] != null);
        if (!kinds.length && cond.left == null) fail(owner, label, at + ".cond", "没有可判定的条件");
        if (cond.left != null) {
          if (["lt", "le", "gt", "ge", "eq", "ne"].indexOf(cond.op) < 0) {
            fail(owner, label, at + ".cond.op", "比较方式非法：" + JSON.stringify(cond.op));
          }
          if (cond.right == null) fail(owner, label, at + ".cond", "left 需要配 right");
          checkExpr(cond.left, at + ".cond.left", owner, label);
          checkExpr(cond.right, at + ".cond.right", owner, label);
        }
        if (cond.summonCount && ["lt", "le", "gt", "ge", "eq"].indexOf(cond.summonCount.op) < 0) {
          fail(owner, label, at + ".cond.summonCount.op", "比较方式非法");
        }
      }
    }
    if (name === "tick" && op.gate != null) {
      if (typeof op.gate !== "object") fail(owner, label, at + ".gate", "需要对象");
      else {
        if (op.gate.sides != null && !isFiniteNumber(op.gate.sides)) fail(owner, label, at + ".gate.sides", "需要数字");
        if (!Array.isArray(op.gate.cancel)) fail(owner, label, at + ".gate.cancel", "需要数组");
      }
    }
    if (name === "clearMods" && op.stats != null && !Array.isArray(op.stats)) {
      fail(owner, label, at + ".stats", "需要数组");
    }
    if (name === "schedule" && op.after != null && !isFiniteNumber(op.after)) {
      fail(owner, label, at + ".after", "需要数字");
    }
    if (name === "status" && op.kind && SPEC.STATUS_KINDS_KNOWN.indexOf(op.kind) < 0) {
      warn(owner, label, at + ".kind", "界面没有这个状态名，会直接显示 kind：" + op.kind);
    }
  }

  function checkExpr(expr, at, owner, label) {
    if (expr == null) return;
    if (typeof expr === "number") {
      if (!isFinite(expr)) fail(owner, label, at, "不是有限数字");
      return;
    }
    if (typeof expr === "string") {
      if (!isFinite(Number(expr))) fail(owner, label, at, "字符串不是数字：" + expr);
      return;
    }
    if (typeof expr !== "object" || Array.isArray(expr)) {
      fail(owner, label, at, "数值表达式只能是数字或对象");
      return;
    }
    const keys = Object.keys(expr).filter((k) => SPEC.VALUE_EXPR_KEYS.indexOf(k) >= 0);
    if (!keys.length) {
      fail(owner, label, at, "数值表达式不认识这些键：" + Object.keys(expr).join(",") + "，可用 " + SPEC.VALUE_EXPR_KEYS.join("/"));
      return;
    }
    if (keys.length > 1) {
      fail(owner, label, at, "数值表达式只能有一个键，现在是 " + keys.join("+"));
      return;
    }
    const key = keys[0];
    if (key === "stat") {
      if (typeof expr.stat !== "string" || !/^(self|target|enemyHero)\.[A-Za-z]+$/.test(expr.stat)) {
        fail(owner, label, at + ".stat", "写成 self.atk / target.def / enemyHero.hp");
      }
    } else if (key === "hpPercent") {
      if (typeof expr.hpPercent !== "string" || !/^(self|target)\.(lost|current)$/.test(expr.hpPercent)) {
        fail(owner, label, at + ".hpPercent", "写成 self.lost / target.current");
      }
      if (!isFiniteNumber(expr.percent)) fail(owner, label, at + ".percent", "需要数字");
    } else if (key === "plus") {
      if (!Array.isArray(expr.plus) || !expr.plus.length) fail(owner, label, at + ".plus", "需要非空数组");
      else expr.plus.forEach((item, i) => checkExpr(item, at + ".plus[" + i + "]", owner, label));
    } else if (key === "minus") {
      if (!Array.isArray(expr.minus) || expr.minus.length !== 2) fail(owner, label, at + ".minus", "需要 [被减数, 减数]");
      else expr.minus.forEach((item, i) => checkExpr(item, at + ".minus[" + i + "]", owner, label));
    } else if (key === "mult" || key === "per") {
      checkExpr(expr[key], at + "." + key, owner, label);
      if (expr.factor != null && !isFiniteNumber(expr.factor)) fail(owner, label, at + ".factor", "需要数字");
    } else if (key === "counter") {
      if (typeof expr.counter !== "string") fail(owner, label, at + ".counter", "需要字符串");
      else if (!countersWritten.has(expr.counter)) {
        fail(owner, label, at + ".counter", "「" + expr.counter + "」没有任何 counter / roll 写它，读出来恒为 0");
      }
    } else if (key === "mark") {
      if (typeof expr.mark !== "string") {
        fail(owner, label, at + ".mark", "需要字符串");
      } else {
        const parts = expr.mark.split(".");
        const markOwner = parts.length > 1 && parts[0] !== "self" ? "" : owner;
        const markKey = parts.length > 1 ? parts[1] : parts[0];
        if (markOwner ? !declaredFor(markOwner, markKey) : !allMarks.has(markKey)) {
          fail(owner, label, at + ".mark", "「" + markKey + "」没有声明");
        }
      }
    } else if (key === "ctx") {
      if (typeof expr.ctx !== "string" || !expr.ctx) fail(owner, label, at + ".ctx", "需要字符串，如 amount");
    }
  }

  return { problems, warnings };
}

/* ---------------- 二层：跨文件检查（CLI） ---------------- */

function checkOpNames(B) {
  const out = [];
  const engineNames = B && B.effectOps && Array.isArray(B.effectOps.opNames) ? B.effectOps.opNames.slice() : [];
  const specNames = Object.keys(SPEC.OPS);
  if (!engineNames.length) {
    out.push({ owner: "引擎", skill: "effect-ops.js", where: "opNames", reason: "没有导出 opNames" });
    return out;
  }
  for (const name of engineNames) {
    if (engineNames.indexOf(name) !== engineNames.lastIndexOf(name)) {
      out.push({ owner: "引擎", skill: "effect-ops.js", where: "opNames", reason: "重复：" + name });
    }
  }
  for (const name of specNames) {
    if (engineNames.indexOf(name) < 0) {
      out.push({ owner: "引擎", skill: "rpg6-spec.js", where: name, reason: "字典里有这个 op，effect-ops.js 的 opNames 没有" });
    }
  }
  for (const name of engineNames) {
    if (specNames.indexOf(name) < 0) {
      out.push({ owner: "引擎", skill: "rpg6-spec.js", where: name, reason: "opNames 有这个 op，字典没登记（文档表格会缺行）" });
    }
  }
  return out;
}

function checkVersion(B) {
  const out = [];
  const engineVersion = B && B.ENGINE_VERSION;
  if (!engineVersion) {
    out.push({ owner: "引擎", skill: "version.js", where: "ENGINE_VERSION", reason: "没有导出引擎版本" });
    return out;
  }
  const config = readInSandbox(CONFIG_FILE, "window.RPG_APP") || {};
  if (config.engineVersion !== engineVersion) {
    out.push({
      owner: "版本",
      skill: "data/config.js",
      where: "engineVersion",
      reason: "config.js 是 " + JSON.stringify(config.engineVersion) + "，version.js 是 " + JSON.stringify(engineVersion)
    });
  }
  return out;
}

function checkPageScripts() {
  const out = [];
  const html = fs.readFileSync(PAGE_FILE, "utf8");
  if (!/<script\s+type="module"\s+src="js\/battle\/entry\.js"/.test(html)) {
    out.push({ owner: "页面", skill: "test.html", where: "js/battle/entry.js", reason: "没有以 type=module 加载对局页单入口" });
    return out;
  }
  const entryFile = path.join(ROOT, "rpg6.0", "js", "battle", "entry.js");
  if (!fs.existsSync(entryFile)) {
    out.push({ owner: "页面", skill: "js/battle/entry.js", where: "文件", reason: "不存在" });
    return out;
  }
  const entry = fs.readFileSync(entryFile, "utf8");
  if (!/import\s+"\.\.\/engine\/index\.js"/.test(entry)) {
    out.push({ owner: "页面", skill: "js/battle/entry.js", where: "engine/index.js", reason: "入口没有 import 引擎聚合入口" });
  }
  if (!/import\s+skillsLib\s+from\s+"\.\.\/\.\.\/data\/skills\/index\.js"/.test(entry)) {
    out.push({ owner: "页面", skill: "js/battle/entry.js", where: "data/skills/index.js", reason: "入口没有 import 技能库聚合入口" });
  }
  const idx = fs.readFileSync(path.join(ROOT, "rpg6.0", "js", "engine", "index.js"), "utf8");
  const imported = [...idx.matchAll(/import\s+"\.\/([a-z0-9/.-]+)\.js"/g)].map((m) => m[1]);
  const want = LOAD_ORDER.slice();
  const missing = want.filter((n) => imported.indexOf(n) < 0);
  const extra = imported.filter((n) => want.indexOf(n) < 0);
  if (missing.length) out.push({ owner: "引擎", skill: "engine/index.js", where: "import 清单", reason: "缺：" + missing.join(",") });
  if (extra.length) out.push({ owner: "引擎", skill: "engine/index.js", where: "import 清单", reason: "多：" + extra.join(",") });
  const pos = {};
  imported.forEach((n, i) => { pos[n] = i; });
  for (let i = 1; i < want.length; i++) {
    if (pos[want[i]] == null || pos[want[i - 1]] == null) continue;
    if (pos[want[i]] < pos[want[i - 1]]) {
      out.push({ owner: "引擎", skill: "engine/index.js", where: "import 顺序", reason: want[i - 1] + " 必须在 " + want[i] + " 之前" });
      break;
    }
  }
  return out;
}

const ANCHOR_RE = /<!--\s*skill:([A-Za-z0-9_.\-]+)\s*-->/g;

function checkAnchors(lib) {
  const out = [];
  if (!fs.existsSync(MECHANISM_DOC)) {
    out.push({ owner: "文档", skill: "机制文档", where: "_local/docs", reason: "找不到角色机制文档（_local 不入库，缺失时跳过这一项）" });
    return out;
  }
  const text = fs.readFileSync(MECHANISM_DOC, "utf8");
  const anchors = [];
  ANCHOR_RE.lastIndex = 0;
  let m;
  while ((m = ANCHOR_RE.exec(text))) anchors.push(m[1]);
  const seen = new Set();
  for (const id of anchors) {
    if (seen.has(id)) out.push({ owner: "文档", skill: "机制文档", where: "skill:" + id, reason: "锚点重复" });
    seen.add(id);
  }
  /* plan.mjs --write 先插骨架，正文写「待补」；骨架没补就被拦下。 */
  for (const line of text.split("\n")) {
    if (line.includes("待补") && /<!--\s*skill:/.test(line)) {
      out.push({ owner: "文档", skill: "机制文档", where: "锚点骨架", reason: "正文还是「待补」：" + line.trim().slice(0, 40) });
    }
  }
  for (const entry of eachSkill(lib)) {
    const skill = entry.skill || {};
    if (!skill.id) continue;
    if (!seen.has(skill.id)) {
      const cond = String(skill.conditionText || "").trim();
      out.push({
        owner: entry.owner,
        skill: skill.name || "",
        where: "机制文档",
        reason: "缺少锚点 <!-- skill:" + skill.id + " -->",
        fix: "- **" + (skill.name || "") + "（" + cond + "）** <!-- skill:" + skill.id + " -->："
      });
    }
  }
  const ids = new Set(eachSkill(lib).map((e) => (e.skill || {}).id).filter(Boolean));
  for (const id of anchors) {
    if (!ids.has(id)) out.push({ owner: "文档", skill: "机制文档", where: "skill:" + id, reason: "技能库里没有这个技能 id" });
  }
  return out;
}

function checkAgainstSheet(B, lib, roster) {
  const out = [];
  const names = Object.keys(lib.characters || {});
  for (const name of names) {
    if (!roster.some((c) => c.name === name)) {
      out.push({ owner: name, skill: "", where: "档案", reason: "角色档案里没有这个人，技能库里的技能永远不会被加载" });
    }
  }
  B.skills.load(lib);
  return out;
}

/* ---------------- 三层：架构边界与孤儿模块 ---------------- */

function importSpecsOf(text) {
  const out = [];
  const re = /(?:import\s+(?:[^"']*\s+from\s+)?|import\s*\()["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(text))) out.push(m[1]);
  return out;
}

function walkJs(rootDir, visit) {
  for (const name of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const file = path.join(rootDir, name.name);
    if (name.isDirectory()) {
      walkJs(file, visit);
      continue;
    }
    if (!name.name.endsWith(".js")) continue;
    visit(file, fs.readFileSync(file, "utf8"));
  }
}

function checkArchBoundaries() {
  const out = [];
  /* 引擎文件只经 index.js 按序加载，内部走 root.RPG6B 共享命名空间，不允许 import 与 DOM 引用 */
  for (const name of LOAD_ORDER) {
    const file = path.join(ENGINE, name + ".js");
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    for (const spec of importSpecsOf(text)) {
      out.push({ owner: "架构", skill: "js/engine/" + name + ".js", where: spec, reason: "引擎文件不允许 import；引擎内部走 root.RPG6B 共享命名空间" });
    }
    if (/\b(window|document|localStorage)\./.test(text)) {
      out.push({ owner: "架构", skill: "js/engine/" + name + ".js", where: "DOM", reason: "引擎不允许引用 window/document/localStorage" });
    }
  }
  /* battle 层与页面脚本的 import 不得越出 rpg6.0/js 与 rpg6.0/data */
  const dir = path.join(ROOT, "rpg6.0");
  walkJs(path.join(dir, "js"), (file, text) => {
    const rel = path.relative(dir, file).replace(/\\/g, "/");
    for (const spec of importSpecsOf(text)) {
      if (!/^\.\.?\.?\//.test(spec)) continue;
      const target = path.normalize(path.join(path.dirname(file), spec)).replace(/\\/g, "/");
      const relTarget = path.relative(dir, target).replace(/\\/g, "/");
      if (!(relTarget.startsWith("js/") || relTarget.startsWith("data/"))) {
        out.push({ owner: "架构", skill: rel, where: spec, reason: "import 越出了 rpg6.0/js 与 rpg6.0/data 的边界" });
      }
    }
  });
  return out;
}

function checkOrphanModules() {
  const out = [];
  const dir = path.join(ROOT, "rpg6.0");
  const htmlRefs = new Set();
  const collectHtml = (rootDir) => {
    for (const name of fs.readdirSync(rootDir, { withFileTypes: true })) {
      const file = path.join(rootDir, name.name);
      if (name.isDirectory()) {
        collectHtml(file);
        continue;
      }
      if (!name.name.endsWith(".html")) continue;
      const text = fs.readFileSync(file, "utf8");
      const re = /<script[^>]+src="([^"]+)"/g;
      let m;
      while ((m = re.exec(text))) {
        htmlRefs.add(path.normalize(path.join(path.dirname(file), m[1])).replace(/\\/g, "/"));
      }
    }
  };
  collectHtml(dir);

  const importedBy = new Map();
  const all = [];
  for (const rootDir of [path.join(dir, "js"), path.join(dir, "data", "skills")]) {
    if (!fs.existsSync(rootDir)) continue;
    walkJs(rootDir, (file, text) => {
      all.push(file);
      for (const spec of importSpecsOf(text)) {
        if (!/^\.\.?\.?\//.test(spec)) continue;
        const target = path.normalize(path.join(path.dirname(file), spec)).replace(/\\/g, "/");
        const list = importedBy.get(target) || [];
        list.push(path.relative(dir, file).replace(/\\/g, "/"));
        importedBy.set(target, list);
      }
    });
  }
  for (const file of all) {
    const norm = file.replace(/\\/g, "/");
    if (htmlRefs.has(norm) || (importedBy.get(norm) || []).length) continue;
    out.push({ owner: "架构", skill: path.relative(dir, norm).replace(/\\/g, "/"), where: "孤儿模块", reason: "没有任何 HTML 或 import 引用它" });
  }
  return out;
}

/* ---------------- 输出 ---------------- */

function format(problem) {
  const head = [problem.owner, problem.skill].filter(Boolean).join(" / ");
  const line = (head ? head + " / " : "") + problem.where + ": " + problem.reason;
  /* fix：可直接粘进文档/代码的那一行，省得再手抄技能名与锚点 */
  return problem.fix ? line + "\n      粘这个：" + problem.fix : line;
}

function printGroup(title, items) {
  if (!items.length) return;
  console.log("\n" + title + "（" + items.length + "）");
  for (const item of items) console.log("  " + format(item));
}

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = [item.owner, item.skill, item.where, item.reason].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

async function main(argv) {
  const json = argv.indexOf("--json") >= 0;
  const warnOnly = argv.indexOf("--warn") >= 0;
  const fileArg = argv.find((a) => a.startsWith("--file="));

  const B = loadEngine();
  const lib = await loadLibrary(fileArg ? path.resolve(ROOT, fileArg.slice(7)) : null);

  const one = lintLibrary(lib, { B });
  const errors = dedupe(one.problems
    .concat(checkOpNames(B))
    .concat(checkVersion(B))
    .concat(checkPageScripts())
    .concat(checkAnchors(lib))
    .concat(checkAgainstSheet(B, lib, loadRoster()))
    .concat(checkArchBoundaries())
    .concat(checkOrphanModules()));

  const chars = lib.characters || {};
  const skillCount = Array.isArray(B.skills.all()) ? B.skills.all().length : 0;

  if (json) {
    console.log(JSON.stringify({
      ok: errors.length === 0,
      errors,
      warnings: one.warnings,
      stats: {
        characters: Object.keys(chars).length,
        skills: skillCount,
        ops: B.effectOps && B.effectOps.opNames ? B.effectOps.opNames.length : 0,
        engineVersion: B.ENGINE_VERSION || ""
      }
    }, null, 2));
  } else {
    console.log("技能库 " + Object.keys(chars).length + " 名角色 / " + skillCount + " 条技能 · " +
      (B.effectOps.opNames || []).length + " 个 op · " + (B.ENGINE_VERSION || "无版本"));
    printGroup("错误", errors);
    printGroup("提醒", one.warnings);
    if (!errors.length) console.log("\n结构校验通过");
  }

  if (errors.length && warnOnly) {
    console.log("\n--warn：只提醒，不阻断");
    return 0;
  }
  return errors.length ? 1 : 0;
}

module.exports = {
  LOAD_ORDER,
  loadEngine,
  loadLibrary,
  loadRoster,
  lintLibrary,
  checkOpNames,
  checkVersion,
  checkAnchors,
  checkPageScripts,
  checkArchBoundaries,
  checkOrphanModules,
  eachSkill,
  eachOpTree,
  format
};

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code)).catch((err) => {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  });
}

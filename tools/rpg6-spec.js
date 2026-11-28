/* ============================================================
   rpg6-spec.js —— 技能 DSL 的字段字典：op 表的唯一来源
   ------------------------------------------------------------
   一处写，两处用：
     · tools/rpg6-lint.js  按它校验技能库（字段、必填、枚举）
     · tools/rpg6-stats.js 按它生成文档里的 op 表
   新增 op 的步骤：effect-ops.js 加 case、effect-ops.js 的 opNames 加名字、
   这里的 OPS 加一条；漏了任何一处，lint 的 opNames 比对会失败。
   ============================================================ */
"use strict";

/* 技能对象的 target 取值，与 skills.resolveTarget 的分支一一对应 */
const TARGETS = ["enemy", "ally", "self", "allEnemies", "allAllies", "any"];

/* op 的 who 取值，与 effect-ops.sideUnits 的分支一一对应 */
const WHOS = ["target", "self", "allEnemies", "allAllies", "enemyHero"];

/* 四类 Buff + 法伤一次性易伤，label 在 battle-view 里 */
const BUFF_KINDS = ["strong", "fragile", "brave", "panic", "magicVuln"];

/* 界面有名字的状态；其余 kind 也能跑，只是显示原始 kind，lint 只提醒不拦 */
const STATUS_KINDS_KNOWN = ["break", "stun", "daze", "noSkill", "noBasic", "noCharge", "noMpCharge", "cannotAct", "onlyBasic", "noBreakOut", "noDeath", "breakLock", "undying", "strongImmune", "extraActions", "wlk", "ducai", "chedi", "xipi", "zhiyin"];

/* skills.runHooks 的钩子名，写错的钩子永远不会被调用 */
const HOOKS = [
  "battleStart", "roundStart", "basicGate", "basicMod", "basicMode", "basicHit",
  "breakAction", "beforeDamage", "damageDealt", "damageTaken", "statDrained", "afterAction"
];

/* 技能对象的字段，与引擎里 skill.X 的读取一一对应 */
const SKILL_FIELDS = [
  "id", "owner", "name", "conditionText", "target", "ops", "choices", "chargeOps", "hooks",
  "cost", "charge", "cooldown", "once", "costFromLost", "requires", "input", "passive",
  "unsupported", "rollDodge", "buffImmune", "baseUnsupported", "items", "forbidEffect",
  "noAction", "undying", "selfKillWin"
];

/* 数值表达式认的键，与 effect-ops.evalValue 的分支一一对应 */
const VALUE_EXPR_KEYS = ["stat", "mult", "per", "hpPercent", "plus", "minus", "counter", "mark", "ctx", "summonCount", "pow"];

/* 每个 op 都允许的字段 */
const GLOBAL_OP_FIELDS = ["op", "who", "label"];

/* op 表：desc 进文档「作用」列，fields 进「参数」列并作为字段白名单。
   required 里的字段缺了直接报错；enums 里的字段值超出枚举报错。 */
const OPS = {
  damage: {
    desc: "造成伤害；默认只加击溃值，`addStun` 才加眩晕值；`healBack` 按造成的伤害给自己回血",
    fields: { value: "必填", type: "phys/magic/true/last/basic", times: "段数", factor: "倍率", noBreak: "", addStun: "计眩晕值", fromBuff: "", healBack: "" },
    required: ["value"],
    enums: { type: ["phys", "magic", "true", "last", "basic"] },
    extra: ["typeFrom"]
  },
  directLoss: {
    desc: "强扣：不减免、不加击溃值",
    fields: { value: "必填" },
    required: ["value"]
  },
  heal: {
    desc: "回血，受血量上限钳制",
    fields: { value: "必填", bonus: "额外值", rounding: "round5/int/ten/none" },
    required: ["value"],
    enums: { rounding: ["round5", "int", "ten", "none"] }
  },
  healFull: {
    desc: "回满血",
    fields: {}
  },
  mp: {
    desc: "蓝增减，钳制在 0..蓝上限",
    fields: { delta: "必填" },
    required: ["delta"]
  },
  maxHp: {
    desc: "血上限增减，常驻修正",
    fields: { delta: "增减量", percent: "按当前上限的百分比", untilRecast: "removeEffect 按 key 回滚", debuff: "负面标记，dispel marked 清除" }
  },
  maxMp: {
    desc: "蓝上限增减，常驻修正",
    fields: { delta: "增减量", percent: "按当前上限的百分比", untilRecast: "removeEffect 按 key 回滚", debuff: "负面标记，dispel marked 清除" }
  },
  stat: {
    desc: "面板修改，进 `mods`；`restore` 让 set 归零后逐标准回合恢复原值",
    fields: { stat: "必填", mode: "add/set/mul，默认 add", value: "", duration: "数字或 {unit,count}", restore: "每标准回合恢复量（配合 mode:set）", untilRecast: "removeEffect 按 key 回滚", debuff: "负面标记，dispel marked 清除" },
    required: ["stat"],
    enums: { mode: ["add", "set", "mul"] }
  },
  buff: {
    desc: "四类 Buff",
    fields: { kind: "strong/fragile/brave/panic", percent: "必填", duration: "", stacking: "false 则不叠层" },
    required: ["kind", "percent"],
    enums: { kind: BUFF_KINDS }
  },
  status: {
    desc: "状态，按标准回合计时；permanent 表示整局",
    fields: { kind: "必填", duration: "数字或 {unit,count}", rounds: "同 duration", permanent: "整局", skillId: "只封锁该技能时填", chargeOk: "noSkill 下仍可蓄力（只禁释放）" },
    required: ["kind"]
  },
  breakValue: {
    desc: "击溃值增减，钳制在 0..上限",
    fields: { delta: "必填" },
    required: ["delta"]
  },
  stunValue: {
    desc: "眩晕值增减，钳制在 0..上限",
    fields: { delta: "必填" },
    required: ["delta"]
  },
  forceBreak: {
    desc: "按当前击溃值直接进入击溃，击溃值不足时不生效",
    fields: {}
  },
  dice: {
    desc: "掷骰分支；`times` 连续独立掷",
    fields: { sides: "默认 6", times: "掷几次", cases: "[{in|roll, ops}]", else: "都没命中时" },
    extra: ["cases"]
  },
  roll: {
    desc: "掷骰并存进计数器，供 `{counter}` 读取",
    fields: { sides: "默认 6", key: "计数器名", perTarget: "默认 true" },
    required: ["key"]
  },
  strike: {
    desc: "立刻执行一次普攻",
    fields: { target: "source 表示打来源", victim: "显式指定打谁（target/enemyHero 等）", noBreak: "" },
    enums: { target: ["source"] }
  },
  deny: {
    desc: "否决这次动作，`reason` 显示给玩家",
    fields: { reason: "" }
  },
  if: {
    desc: "条件分支；`cond` 支持 gender/status/effect/summon/summonCount/left+op+right",
    fields: { cond: "必填", then: "必填", else: "可选" },
    required: ["cond", "then"],
    extra: ["then", "else"]
  },
  dispel: {
    desc: "清 Debuff / 清异常状态 / 清带标记的负面修正 / 清击溃值 / 清标记",
    fields: { scope: "debuff/all/status/marked/breakValue/marks，默认 debuff" },
    enums: { scope: ["debuff", "all", "status", "marked", "breakValue", "marks"] }
  },
  tick: {
    desc: "逐标准回合重复执行的持续效果（DoT、回蓝、属性）；`when:\"turnStart\"` 改为持有者回合开始时结算并在此时扣层；`gate` 是持有者行动前掷骰跳过行动，`period` 是每 N 个标准回合结算一次，`breakOnSourceStatus` 是来源被击晕/击溃即结束，`breakOnHolderStatus` 是持有者进入指定状态即结束；`guard` 是防护层（取消 N 次伤害 + onCancel ops），`immune`/`breakImmune`/`chargeGuard` 是防护声明",
    fields: {
      ops: "必填", duration: "", period: "每 N 回合", permanent: "", unstoppable: "", desc: "chip 说明",
      when: "turnStart 时在持有者回合开始时结算",
      tag: "给 interrupt 用", key: "给 if.cond.effect 用", gate: "{sides,cancel}",
      breakOnSourceStatus: "", breakOnHolderStatus: "", fromBuff: "", debuff: "负面标记，dispel marked 清除",
      guard: "{remaining,onBreak,ops}", immune: "{buffs,statuses}", breakImmune: "",
      chargeGuard: "", enemyNoSkill: "", selfNoBasic: "", onExpire: "到期时执行的 ops"
    },
    required: ["ops"],
    extra: ["on", "ops"]
  },
  reflect: {
    desc: "蓄力期间的伤害反射（江雨轩）；带 `charges` 时改为固定值 + 次数的反弹（泥浩恺扣分!）",
    fields: { factor: "默认 2", stunRounds: "", charges: "固定反弹次数", value: "固定反弹伤害", type: "phys/magic/true，默认 magic", noBreak: "反弹不加击溃值" },
    enums: { type: ["phys", "magic", "true"] }
  },
  interrupt: {
    desc: "打断带 `tag` 的持续效果",
    fields: { tag: "" }
  },
  schedule: {
    desc: "延迟结算；`after` 是几个标准回合后；`atPhase:\"roundStart\"` 改在下一标准回合开始时结算；`capture` 把数值在调度时快照下来供 ops 用 `{ctx:键}` 读取",
    fields: { after: "必填", ops: "必填", atPhase: "默认 roundEnd；roundStart 表示回合开始", capture: "调度时求值的数值快照" },
    required: ["after", "ops"],
    extra: ["on", "ops"]
  },
  mark: {
    desc: "标记层数增减，`mode:\"set\"` 直接赋值；delta 支持数值表达式",
    fields: { key: "必填", mode: "add/set，默认 add", value: "set 时必填", delta: "默认 +1" },
    required: ["key"],
    enums: { mode: ["add", "set"] }
  },
  markClear: {
    desc: "清空标记，不写 `key` 就清该单位全部标记",
    fields: { key: "" }
  },
  taunt: {
    desc: "嘲讽值增减",
    fields: { delta: "必填" },
    required: ["delta"]
  },
  counter: {
    desc: "计数器增减，供 `{counter}` 读取",
    fields: { key: "必填", delta: "默认 +1", perTarget: "默认 true" },
    required: ["key"]
  },
  rewind: {
    desc: "反方向的钟：奇数次记录全状态快照，偶数次回到快照；独立 clock 计时，回溯不重置",
    fields: {}
  },
  use: {
    desc: "内联执行另一个技能的 ops",
    fields: { skillId: "必填", times: "重复次数" },
    required: ["skillId"]
  },
  setBasicMod: {
    desc: "改这次普攻：类型、倍率、段数、回血、无击溃、哑火",
    fields: { type: "", factor: "", healInstead: "", healBack: "普攻回复实际造成的伤害", hits: "", noBreak: "", misfire: "" },
    enums: { type: ["phys", "magic", "true"] }
  },
  clearMods: {
    desc: "按来源移除属性修正，`stats` 只清指定属性",
    fields: { source: "来源标记", stats: "属性名数组" }
  },
  summon: {
    desc: "生成召唤物，`key` 指向 `summons` 定义",
    fields: { key: "必填", ttl: "覆盖定义里的 ttl" },
    required: ["key"]
  },
  setBasicMode: {
    desc: "把普攻改成给召唤物回血",
    fields: { healSummon: "召唤物 key", mode: "" }
  },
  dodge: {
    desc: "把这次受击标记为已闪避",
    fields: {}
  },
  shield: {
    desc: "护盾：独立血量池，伤害全额吸收；标准回合末计时，到期执行 `onExpire`（杨冬明坚若磐石）",
    fields: { hp: "必填", duration: "标准回合数，默认 1", label: "", onExpire: "到期执行的 ops" },
    required: ["hp"]
  },
  note: {
    desc: "只产出日志，不改变状态；用于「无法打断」这类声明的落点",
    fields: { text: "必填" },
    required: ["text"]
  },
  removeEffect: {
    desc: "按 key 移除持续效果，并把 `untilRecast` 标记为该 key 的属性修正一并回滚（剃发为僧复原）",
    fields: { key: "必填" },
    required: ["key"]
  },
  decay: {
    desc: "把目标身上指定 kind 的 Buff 百分比减 delta，减到 0 移除（我是天才的勇猛逐回合 −20%）",
    fields: { kind: "必填", delta: "必填" },
    required: ["kind", "delta"],
    enums: { kind: BUFF_KINDS }
  },
  convert: {
    desc: "配合 beforeDamage 钩子：把这次受击标记为伤害转血上限（不扣血、等量加血上限）",
    fields: { to: "必填" },
    required: ["to"],
    enums: { to: ["maxHp"] }
  }
};

/* 某个 op 允许出现的全部字段 */
function allowedFields(name) {
  const spec = OPS[name];
  const out = GLOBAL_OP_FIELDS.slice();
  if (!spec) return out;
  for (const key of Object.keys(spec.fields)) out.push(key);
  for (const key of spec.extra || []) out.push(key);
  return out;
}

/* 文档「参数」列：只列有意义的字段，`op` / `who` / `label` 不列 */
function argsText(name) {
  const spec = OPS[name];
  if (!spec) return "";
  const parts = [];
  for (const key of Object.keys(spec.fields)) {
    const note = spec.fields[key];
    parts.push("`" + key + "`" + (note ? " " + note : ""));
  }
  return parts.length ? parts.join("、") : "无";
}

/* 生成整张 op 表。列与 plan 第 5.2 节一致，行序按 opNames 走。 */
function renderOpTable(opNames) {
  const lines = ["| op | 参数 | 作用 |", "|---|---|---|"];
  for (const name of opNames) {
    const spec = OPS[name];
    lines.push("| `" + name + "` | " + argsText(name) + " | " + (spec ? spec.desc : "（未登记）") + " |");
  }
  return lines.join("\n");
}

module.exports = {
  TARGETS,
  WHOS,
  BUFF_KINDS,
  STATUS_KINDS_KNOWN,
  HOOKS,
  SKILL_FIELDS,
  VALUE_EXPR_KEYS,
  GLOBAL_OP_FIELDS,
  OPS,
  allowedFields,
  argsText,
  renderOpTable
};

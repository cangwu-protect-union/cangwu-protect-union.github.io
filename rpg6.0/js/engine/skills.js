/* 回合制正传 6.0 · 战斗引擎 · 技能库
   执行技能、处理蓄力、校验技能库与角色档案是否一致。
   技能数据在 data/skills/，这里不写任何具体技能。 */
(function (root) {
  "use strict";
  var B = root.RPG6B || (root.RPG6B = {});
  var api = B.skills = B.skills || {};

  var byId = {};
  var byOwner = {};
  var all = [];
  var markDefs = {};
  var summonDefs = {};
  var panelDefs = {};
  var basicAtkDefs = {};

  function norm(text) {
    return String(text == null ? "" : text).replace(/\s+/g, "");
  }

  /* ---------------- 库索引与查询 ---------------- */

  function load(library) {
    byId = {};
    byOwner = {};
    all = [];
    markDefs = (library && library.marks) || {};
    summonDefs = (library && library.summons) || {};
    /* 面板覆盖：档案里攻击格写的是注记（孙嘉怿「受攻击者当前血量的20%」），
       用技能库的 panels 给数字，再用 basicAtk 表达式算实际攻击值。 */
    panelDefs = (library && library.panels) || {};
    basicAtkDefs = (library && library.basicAtk) || {};
    var chars = library && library.characters ? library.characters : {};
    Object.keys(chars).forEach(function (owner) {
      chars[owner].forEach(function (skill) {
        if (!skill || !skill.id) throw new Error("技能缺少 id：" + owner);
        if (byId[skill.id]) throw new Error("技能 id 重复：" + skill.id);
        skill.owner = owner;
        skill.baseUnsupported = skill.unsupported || "";
        byId[skill.id] = skill;
        all.push(skill);
        if (!byOwner[owner]) byOwner[owner] = [];
        byOwner[owner].push(skill);
      });
    });
    return all.length;
  }

  function find(id) {
    return byId[id] || null;
  }

  function summonDef(key) {
    return summonDefs[key] || null;
  }

  function panelOf(name) {
    return panelDefs[name] || null;
  }

  /* 动态普攻攻击值：返回数值表达式，没有就返回 null（用面板攻击） */

  function basicAtkOf(unit) {
    if (!unit || !unit.name) return null;
    return basicAtkDefs[unit.name] || null;
  }

  /* 动态费用：按「累计已损失血量」每 per 点降 1 蓝 1 力，最低 0 */

  /* ---------------- 单位初始化与被动加成 ---------------- */

  function effectiveCost(unit, skill) {
    var mp = skill && skill.cost && skill.cost.mp ? Number(skill.cost.mp) : 0;
    var charge = skill && skill.charge ? Number(skill.charge) : 0;
    var def = skill && skill.cost && skill.cost.def ? Number(skill.cost.def) : 0;
    var maxMp = skill && skill.cost && skill.cost.maxMp ? Number(skill.cost.maxMp) : 0;
    var steps = 0;
    if (skill && skill.costFromLost) {
      var per = Number(skill.costFromLost.per) || 100;
      steps = Math.floor((unit && unit.hpLost ? unit.hpLost : 0) / per);
      mp = Math.max(0, mp - steps);
      charge = Math.max(0, charge - steps);
    }
    return { mp: mp, charge: charge, def: def, maxMp: maxMp, steps: steps };
  }

  /* 建单位时把角色的标记声明挂上去；标记对所有人生效，双方都能看到与操作。
     on:"opponent" 的标记不挂自己，等双方都建好后由 initOpponentMarks 挂到对方身上。 */

  function initUnit(unit) {
    var defs = markDefs[unit.name] || [];
    if (!unit.marks) unit.marks = {};
    for (var i = 0; i < defs.length; i++) {
      var def = defs[i];
      if (def.on === "opponent") continue;
      unit.marks[def.key] = {
        value: Number(def.init) || 0,
        name: def.name || def.key,
        max: def.max == null ? 99 : Number(def.max),
        hideMax: !!def.hideMax
      };
    }
  }

  /* 把对方声明为 on:"opponent" 的标记挂到本侧英雄身上 */

  function initOpponentMarks(state) {
    var units = state.units || [];
    for (var i = 0; i < units.length; i++) {
      var unit = units[i];
      var other = units[i === 0 ? 1 : 0];
      if (!other) continue;
      var defs = markDefs[other.name] || [];
      if (!unit.marks) unit.marks = {};
      for (var d = 0; d < defs.length; d++) {
        var def = defs[d];
        if (def.on !== "opponent" || unit.marks[def.key]) continue;
        unit.marks[def.key] = {
          value: Number(def.init) || 0,
          name: def.name || def.key,
          max: def.max == null ? 99 : Number(def.max),
          hideMax: !!def.hideMax
        };
      }
    }
  }

  function forUnit(unit) {
    return (byOwner[unit.name] || []).slice();
  }

  function has(unit) {
    return !!(byOwner[unit.name] && byOwner[unit.name].length);
  }

  /* 受击掷骰免疫：伤害结算前先掷骰，掷出 values 里的点数就整体免疫。
     不放在 beforeDamage 钩子里，因为那条路径对 noReaction 的二次伤害（反弹、被动强制普攻）会被跳过。 */

  function rollDodge(state, unit, events) {
    var list = byOwner[unit.name] || [];
    for (var i = 0; i < list.length; i++) {
      var def = list[i].rollDodge;
      if (!def) continue;
      var sides = Number(def.sides) || B.rules.CONFIG.diceSides;
      var values = def.values || [];
      var roll = B.rng.dice(state, sides);
      if (events) {
        events.push({
          type: "dice",
          round: state.round,
          uid: unit.uid,
          sides: sides,
          value: roll,
          label: list[i].name,
          skillId: list[i].id
        });
      }
      if (values.indexOf(roll) >= 0) return list[i].name;
    }
    return "";
  }

  /* 随身 Buff 免疫：技能上的 buffImmune 列表，加 Buff 时拦截、标准回合开始再清一次兜底 */

  function immuneBuffs(unit) {
    var list = byOwner[unit.name] || [];
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var kinds = list[i].buffImmune || [];
      for (var j = 0; j < kinds.length; j++) {
        if (out.indexOf(kinds[j]) < 0) out.push(kinds[j]);
      }
    }
    return out;
  }

  /* ---------------- 释放流程 ---------------- */

  function walk(value, visit) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (var i = 0; i < value.length; i++) walk(value[i], visit);
      return;
    }
    visit(value);
    var keys = ["ops", "then", "else"];
    for (var k = 0; k < keys.length; k++) {
      if (value[keys[k]]) walk(value[keys[k]], visit);
    }
    if (value.cases) {
      for (var c = 0; c < value.cases.length; c++) walk(value.cases[c].ops, visit);
    }
  }

  function prepareOps(ops, unit) {
    var copy = JSON.parse(JSON.stringify(ops || []));
    var lastType = unit.lastDamageType || "phys";
    walk(copy, function (node) {
      if (node.op === "damage" && (node.type === "last" || node.typeFrom === "self.lastDamageType")) {
        node.type = lastType;
        delete node.typeFrom;
      }
    });
    return copy;
  }


  /* 额外动作（E5）的库存与可用性在 actions.js（itemsOf/itemAvailable）：
     技能库只负责按单位给技能清单，items 字段由动作层展开。 */


  function chargeSkill(state, unit, skill, action, events, actionId) {
    if (unit.charge && unit.charge.skillId !== skill.id) {
      unit.charge = null;
    }
    if (!unit.charge) unit.charge = { skillId: skill.id, amount: 0 };
    unit.charge.amount += 1;
    unit.flags.chargedThisTurn = true;
    events.push({
      type: "charg",
      round: state.round,
      uid: unit.uid,
      skillId: skill.id,
      amount: unit.charge.amount,
      need: effectiveCost(unit, skill).charge
    });
    if (skill.chargeOps) {
      var tUid = skill.target === "self" || skill.target === "ally" ? unit.uid : (action.target || unit.uid);
      B.effectOps.runOps(state, {
        sourceUid: unit.uid,
        targetUid: tUid,
        skillId: skill.id,
        label: skill.name,
        actionId: actionId || ""
      }, prepareOps(skill.chargeOps, unit), events);
    }
    return { kind: "charge", skillId: skill.id, amount: unit.charge.amount };
  }

  function pickChoice(skill, action) {
    if (!skill.choices || !skill.choices.length) return { ops: skill.ops || [], key: "" };
    var key = action && action.choice ? String(action.choice) : "";
    /* 旧战报（6.0-engine.3 及更早）没有 choice 字段，按技能原来的整套 ops 回放 */
    if (!key) return { ops: skill.ops || [], key: "" };
    for (var i = 0; i < skill.choices.length; i++) {
      if (skill.choices[i].key === key) {
        return { ops: skill.choices[i].ops || [], key: key };
      }
    }
    throw new Error("未知的伤害类型：" + key);
  }

  function releaseSkill(state, unit, skill, action, events, actionId) {
    var targetUid = api.resolveTarget(state, unit, skill, action.target);
    var ctx = {
      sourceUid: unit.uid,
      targetUid: targetUid,
      skillId: skill.id,
      label: skill.name,
      actionId: actionId || "",
      scope: skill.target === "allEnemies" ? "allEnemies" : (skill.target === "allAllies" ? "allAllies" : ""),
      input: {}
    };

    var mpCost = effectiveCost(unit, skill).mp;
    var defCost = effectiveCost(unit, skill).def;
    var maxMpCost = effectiveCost(unit, skill).maxMp;
    var inputValue = 0;
    if (skill.input) {
      var key = skill.input.key || "n";
      var min = Number(skill.input.min) || 1;
      var max = unit.mp - mpCost;
      if (skill.input.max != null && skill.input.max !== "mp") {
        max = Math.min(max, Number(skill.input.max));
      }
      var n = Math.floor(Number(action ? action[key] : NaN));
      if (!isFinite(n) || n < min || n > max) {
        throw new Error("需要支付 " + min + " 到 " + Math.max(min, max) + " 蓝");
      }
      inputValue = n;
      ctx.input[key] = n;
    }
    if (mpCost > 0) {
      unit.mp = Math.max(0, unit.mp - mpCost);
      events.push({ type: "mp", round: state.round, uid: unit.uid, delta: -mpCost, mp: unit.mp, reason: "cost" });
    }
    if (inputValue > 0) {
      unit.mp = Math.max(0, unit.mp - inputValue);
      events.push({ type: "mp", round: state.round, uid: unit.uid, delta: -inputValue, mp: unit.mp, reason: "costInput" });
    }
    if (skill.cost && skill.cost.hp) {
      B.damage.directLoss(state, {
        sourceUid: unit.uid,
        targetUid: unit.uid,
        amount: skill.cost.hp,
        skillId: skill.id,
        label: "代价"
      }, events);
      if (state.phase === "finished") {
        return { kind: "skill", skillId: skill.id, target: targetUid };
      }
    }
    /* 防御代价（杨冬明竹光法杖「10防」）：释放时扣自身防御，可减到 0 */
    if (defCost > 0) {
      B.state.addMod(unit, {
        stat: "def",
        mode: "add",
        value: -defCost,
        remain: B.state.PERMANENT,
        source: "cost.def." + skill.id,
        label: "防御代价"
      });
      events.push({
        type: "stat",
        round: state.round,
        uid: unit.uid,
        stat: "def",
        mode: "add",
        value: -defCost,
        remain: -1,
        skillId: skill.id
      });
    }
    /* 蓝上限代价（E10：机枪射手「5蓝上限」）：永久 −5 蓝上限，当前蓝钳到新上限 */
    if (maxMpCost > 0) {
      B.state.addMod(unit, {
        stat: "maxMp",
        mode: "add",
        value: -maxMpCost,
        remain: B.state.PERMANENT,
        source: "cost.maxMp." + skill.id,
        label: "蓝上限代价"
      });
      var mpBeforeCap = unit.mp;
      unit.mp = Math.min(unit.mp, B.state.maxMpOf(unit));
      events.push({
        type: "stat",
        round: state.round,
        uid: unit.uid,
        stat: "maxMp",
        mode: "add",
        value: -maxMpCost,
        remain: -1,
        skillId: skill.id
      });
      if (unit.mp !== mpBeforeCap) {
        events.push({ type: "mp", round: state.round, uid: unit.uid, delta: unit.mp - mpBeforeCap, mp: unit.mp, reason: "maxMpCost" });
      }
    }

    unit.charge = null;
    unit.reflect = null;
    clearGuardsOfSkill(unit, skill.id);
    if (skill.once) unit.flags["used." + skill.id] = true;
    if (skill.cooldown) unit.cooldowns[skill.id] = state.round;
    unit.stats.casts += 1;
    events.push({
      type: "action",
      round: state.round,
      uid: unit.uid,
      kind: "skill",
      skillId: skill.id,
      name: skill.name,
      target: targetUid
    });

    var choice = pickChoice(skill, action);
    B.effectOps.runOps(state, ctx, prepareOps(choice.ops, unit), events);
    var done = { kind: "skill", skillId: skill.id, target: targetUid };
    if (choice.key) done.choice = choice.key;
    if (skill.input) done[skill.input.key || "n"] = inputValue;
    return done;
  }

  function execute(state, unit, action, events, actionId) {
    var skill = find(action.skillId);
    if (!skill) throw new Error("技能不存在：" + action.skillId);
    if (skill.owner !== unit.name) throw new Error("这不是「" + unit.name + "」的技能");
    if (skill.unsupported) throw new Error(skill.unsupported);
    var check = B.conditions.evaluate(state, unit, skill);
    if (!check.ok) throw new Error(check.reason);
    if ((action.kind === "charge" || check.needsCharge) && B.state.hasStatus(unit, "noCharge")) {
      throw new Error("现在无法蓄力");
    }
    if (action.kind === "charge" || check.needsCharge) {
      return chargeSkill(state, unit, skill, action, events, actionId);
    }
    return releaseSkill(state, unit, skill, action, events, actionId);
  }

  /* 释放蓄力型技能时，把蓄力期间挂的防护层一起清掉（顾文达硕哥过肩摔） */

  function clearGuardsOfSkill(unit, skillId) {
    if (!unit.effects || !unit.effects.length) return;
    var kept = [];
    for (var i = 0; i < unit.effects.length; i++) {
      var effect = unit.effects[i];
      if (effect.guard && effect.skillId === skillId) continue;
      kept.push(effect);
    }
    unit.effects = kept;
  }

  /* ---------------- 被动钩子与普攻前置 ---------------- */

  function runHooks(state, unit, kind, ctx, events) {
    ctx.ownerUid = unit.uid;
    ctx.ownerName = unit.name;
    var list = byOwner[unit.name] || [];
    for (var i = 0; i < list.length; i++) {
      var hooks = list[i].hooks;
      if (hooks && hooks[kind]) {
        B.effectOps.runOps(state, ctx, prepareOps(hooks[kind], unit), events);
      }
    }
  }

  function runBattleStart(state, events) {
    for (var i = 0; i < state.units.length; i++) {
      var unit = state.units[i];
      if (unit.hp <= 0) continue;
      runHooks(state, unit, "battleStart", {
        sourceUid: unit.uid,
        targetUid: B.state.otherUid(state, unit.uid),
        skillId: "passive.battleStart",
        label: "开局被动"
      }, events);
    }
  }

  /* 普攻前的被动修正：返回 {type, factor, healInstead, hits, noBreak, misfire} */

  function basicMod(state, unit, target, events) {
    var ctx = {
      sourceUid: unit.uid,
      targetUid: target.uid,
      skillId: "basic.mod",
      label: "普攻修正",
      mod: {}
    };
    runHooks(state, unit, "basicMod", ctx, events);
    return ctx.mod;
  }

  /* 普攻门槛：返回 {allow, reason}，由角色的 basicGate 被动决定 */

  function basicGate(state, unit, targetUid, events) {
    var ctx = {
      sourceUid: unit.uid,
      targetUid: targetUid || "",
      skillId: "passive.basicGate",
      label: "普攻前置",
      denied: false,
      reason: ""
    };
    runHooks(state, unit, "basicGate", ctx, events || []);
    return { allow: !ctx.denied, reason: ctx.reason || "" };
  }

  /* ---------------- 技能库校验 ---------------- */

  function validate(characters) {
    var problems = [];
    var list = characters || [];
    for (var i = 0; i < all.length; i++) {
      all[i].unsupported = all[i].baseUnsupported;
    }
    for (var c = 0; c < list.length; c++) {
      var character = list[c];
      var defs = byOwner[character.name] || [];
      var sheet = character.skills || [];
      for (var d = 0; d < defs.length; d++) {
        var def = defs[d];
        var hitSkill = null;
        for (var s = 0; s < sheet.length; s++) {
          if (norm(sheet[s].name) === norm(def.name)) {
            hitSkill = sheet[s];
            break;
          }
        }
        if (!hitSkill) {
          def.unsupported = "档案里没有「" + def.name + "」";
          problems.push({ name: character.name, skill: def.name, reason: def.unsupported });
          continue;
        }
        if (norm(hitSkill.condition) !== norm(def.conditionText)) {
          def.unsupported = "条件与档案不一致（档案：" + hitSkill.condition + "）";
          problems.push({ name: character.name, skill: def.name, reason: def.unsupported });
        }
      }
    }
    return problems;
  }

  function statusOf(character) {
    var defs = byOwner[character.name] || [];
    var usable = [];
    var blocked = [];
    for (var i = 0; i < defs.length; i++) {
      if (defs[i].unsupported) blocked.push({ id: defs[i].id, name: defs[i].name, reason: defs[i].unsupported });
      else usable.push(defs[i].id);
    }
    return { covered: defs.length > 0, usable: usable, blocked: blocked };
  }

  api.load = load;
  api.find = find;
  api.summonDef = summonDef;
  api.panelOf = panelOf;
  api.basicAtkOf = basicAtkOf;
  api.effectiveCost = effectiveCost;
  api.forUnit = forUnit;
  api.has = has;
  api.rollDodge = rollDodge;
  api.immuneBuffs = immuneBuffs;
  api.initUnit = initUnit;
  api.initOpponentMarks = initOpponentMarks;
  api.execute = execute;
  api.prepareOps = prepareOps;
  api.runHooks = runHooks;
  api.runBattleStart = runBattleStart;
  api.basicMod = basicMod;
  api.basicGate = basicGate;
  api.validate = validate;
  api.statusOf = statusOf;
  api.all = function () { return all.slice(); };

  if (typeof module === "object" && module.exports) module.exports = B;
})(typeof globalThis !== "undefined" ? globalThis : this);

/* 回合制正传 6.0 · 战斗引擎 · 技能库
   执行技能、处理蓄力、校验技能库与角色档案是否一致。
   技能数据在 data/battle-skills.js，这里不写任何具体技能。 */
(function (root) {
  "use strict";
  var B = root.RPG6B || (root.RPG6B = {});
  var api = B.skills = B.skills || {};

  var byId = {};
  var byOwner = {};
  var all = [];

  function norm(text) {
    return String(text == null ? "" : text).replace(/\s+/g, "");
  }

  function load(library) {
    byId = {};
    byOwner = {};
    all = [];
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

  function forUnit(unit) {
    return (byOwner[unit.name] || []).slice();
  }

  function has(unit) {
    return !!(byOwner[unit.name] && byOwner[unit.name].length);
  }

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

  function resolveTarget(state, unit, skill, requested) {
    var other = B.state.otherUid(state, unit.uid);
    var kind = skill.target || "enemy";
    if (kind === "self") {
      if (requested && requested !== unit.uid) throw new Error("这个技能只能对自己使用");
      return unit.uid;
    }
    if (kind === "ally") {
      if (requested && requested !== unit.uid) throw new Error("1v1 没有其他队友");
      return unit.uid;
    }
    if (kind === "allAllies") return unit.uid;
    if (kind === "allEnemies") return other;
    if (kind === "any") {
      if (!requested) throw new Error("没有选目标");
      if (requested !== "a" && requested !== "b") throw new Error("目标非法：" + requested);
      B.state.unitOf(state, requested);
      return requested;
    }
    if (!requested) throw new Error("没有选目标");
    if (requested !== "a" && requested !== "b") throw new Error("目标非法：" + requested);
    if (requested === unit.uid) throw new Error("这个技能不能对自己使用");
    return requested;
  }

  function chargeSkill(state, unit, skill, action, events) {
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
      need: skill.charge || 0
    });
    if (skill.chargeOps) {
      var tUid = skill.target === "self" || skill.target === "ally" ? unit.uid : (action.target || unit.uid);
      B.effectOps.runOps(state, {
        sourceUid: unit.uid,
        targetUid: tUid,
        skillId: skill.id,
        label: skill.name
      }, prepareOps(skill.chargeOps, unit), events);
    }
    return { kind: "charge", skillId: skill.id, amount: unit.charge.amount };
  }

  function releaseSkill(state, unit, skill, action, events) {
    var targetUid = resolveTarget(state, unit, skill, action.target);
    var ctx = {
      sourceUid: unit.uid,
      targetUid: targetUid,
      skillId: skill.id,
      label: skill.name
    };

    var mpCost = skill.cost && skill.cost.mp ? skill.cost.mp : 0;
    if (mpCost > 0) {
      unit.mp = Math.max(0, unit.mp - mpCost);
      events.push({ type: "mp", round: state.round, uid: unit.uid, delta: -mpCost, mp: unit.mp, reason: "cost" });
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

    unit.charge = null;
    unit.reflect = null;
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

    B.effectOps.runOps(state, ctx, prepareOps(skill.ops, unit), events);
    return { kind: "skill", skillId: skill.id, target: targetUid };
  }

  function execute(state, unit, action, events) {
    var skill = find(action.skillId);
    if (!skill) throw new Error("技能不存在：" + action.skillId);
    if (skill.owner !== unit.name) throw new Error("这不是「" + unit.name + "」的技能");
    if (skill.unsupported) throw new Error(skill.unsupported);
    var check = B.conditions.evaluate(state, unit, skill);
    if (!check.ok) throw new Error(check.reason);
    if (action.kind === "charge" || check.needsCharge) {
      return chargeSkill(state, unit, skill, action, events);
    }
    return releaseSkill(state, unit, skill, action, events);
  }

  function runHooks(state, unit, kind, ctx, events) {
    var list = byOwner[unit.name] || [];
    for (var i = 0; i < list.length; i++) {
      var hooks = list[i].hooks;
      if (hooks && hooks[kind]) {
        B.effectOps.runOps(state, ctx, prepareOps(hooks[kind], unit), events);
      }
    }
  }

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
  api.forUnit = forUnit;
  api.has = has;
  api.execute = execute;
  api.resolveTarget = resolveTarget;
  api.prepareOps = prepareOps;
  api.runHooks = runHooks;
  api.validate = validate;
  api.statusOf = statusOf;
  api.all = function () { return all.slice(); };

  if (typeof module === "object" && module.exports) module.exports = B;
})(typeof globalThis !== "undefined" ? globalThis : this);

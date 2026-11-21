/* 回合制正传 6.0 · 战斗引擎 · 动作
   普攻、击溃、蓄蓝；技能执行与档案校验在 skills.js。 */
(function (root) {
  "use strict";
  var B = root.RPG6B || (root.RPG6B = {});
  var api = B.actions = B.actions || {};

  function currentUnit(state) {
    if (state.phase === "finished") throw new Error("对局已结束");
    if (!state.turnUid) throw new Error("没有正在行动的角色");
    var unit = B.state.unitOf(state, state.turnUid);
    if (unit.actionsLeft <= 0) throw new Error("本回合行动已用完");
    return unit;
  }

  function requireTarget(state, unit, uid) {
    if (!uid) throw new Error("没有选目标");
    var target;
    try {
      target = B.state.unitOf(state, uid);
    } catch (err) {
      throw new Error("目标非法：" + uid);
    }
    var healUid = B.skills && B.skills.basicHealTarget ? B.skills.basicHealTarget(state, unit) : null;
    if (healUid && uid === healUid) return target;
    var mySide = B.state.sideOf(state, unit.uid);
    var targetSide = B.state.sideOf(state, uid);
    var isSelf = uid === unit.uid;
    var canAlly = !!(unit.trait && unit.trait.canHitAlly);
    if (isSelf && !canAlly) throw new Error("不能以自己为目标");
    if (targetSide !== mySide) {
      if (B.skills && B.skills.checkTaunt) B.skills.checkTaunt(state, unit, uid);
    } else if (!isSelf && !canAlly) {
      throw new Error("不能以队友为目标");
    }
    return target;
  }

  var BASIC_CHARGE_ID = "basic.attack";

  function basicAttack(state, unit, target, events, opts) {
    opts = opts || {};
    var healUid = !opts.forced && B.skills && B.skills.basicHealTarget
      ? B.skills.basicHealTarget(state, unit)
      : null;
    if (healUid) {
      var healTarget = B.state.unitOf(state, healUid);
      B.damage.heal(state, {
        uid: healTarget.uid,
        amount: B.state.statOf(unit, "atk"),
        rounding: "round5",
        skillId: "basic.attack",
        label: "给墓回血"
      }, events);
      return { kind: "basic", type: "attack", target: healTarget.uid, charged: false, healed: true };
    }
    var need = unit.trait && unit.trait.basicCharge ? unit.trait.basicCharge : 0;
    if (!opts.forced && need > 0) {
      var have = unit.charge && unit.charge.skillId === BASIC_CHARGE_ID ? unit.charge.amount : 0;
      if (have < need) {
        if (!unit.charge || unit.charge.skillId !== BASIC_CHARGE_ID) {
          unit.charge = { skillId: BASIC_CHARGE_ID, amount: 0 };
        }
        unit.charge.amount += 1;
        unit.flags.chargedThisTurn = true;
        events.push({
          type: "charg",
          round: state.round,
          uid: unit.uid,
          skillId: BASIC_CHARGE_ID,
          amount: unit.charge.amount,
          need: need,
          reason: "basicCharge"
        });
        return { kind: "basic", type: "attack", target: target.uid, charged: true };
      }
      unit.charge = null;
    }
    var type = B.traits.basicType(unit);
    var amount = B.state.statOf(unit, "atk");
    var selfHit = target.uid === unit.uid;
    var mod = {};
    if (selfHit) {
      type = "true";
    } else if (!opts.forced && B.skills && B.skills.basicMod) {
      mod = B.skills.basicMod(state, unit, target, events) || {};
      if (mod.healInstead) {
        B.damage.heal(state, {
          uid: unit.uid,
          amount: amount * (mod.factor ? mod.factor : 1),
          rounding: "round5",
          skillId: "basic.attack",
          label: "普攻回血"
        }, events);
        return { kind: "basic", type: "attack", target: target.uid, charged: false, healed: true };
      }
      if (mod.type) type = mod.type;
      if (mod.factor) amount = amount * mod.factor;
    }
    var hits = Math.max(1, Math.floor(Number(mod.hits) || 1));
    var noBreak = !!mod.noBreak || !!opts.noBreak;
    var dodged = 0;
    if (mod.misfire) {
      events.push({
        type: "misfire",
        round: state.round,
        uid: unit.uid,
        targetUid: target.uid,
        label: mod.misfireLabel || "哑火"
      });
      hits = 0;
    } else {
      for (var i = 0; i < hits; i++) {
        if (state.phase === "finished") break;
        var hitSpec = {
          sourceUid: unit.uid,
          targetUid: target.uid,
          type: type,
          amount: amount,
          noBreak: noBreak,
          noReaction: !!opts.noReaction,
          healBack: selfHit,
          skillId: opts.skillId || "basic.attack",
          label: opts.label || "普攻"
        };
        B.damage.hit(state, hitSpec, events);
        if (hitSpec.dodged) dodged += 1;
      }
    }
    if (state.phase !== "finished" && dodged < hits && !opts.skipHooks && B.skills && B.skills.runHooks) {
      B.skills.runHooks(state, unit, "basicHit", {
        sourceUid: unit.uid,
        targetUid: target.uid,
        skillId: "passive.basicHit",
        label: "普攻被动"
      }, events);
    }
    return { kind: "basic", type: "attack", target: target.uid, charged: false, hits: hits, dodged: dodged };
  }

  /* 被技能强制执行的一次普攻：不消耗行动、不检查普攻门槛、不跑 basicMod */
  function strike(state, unit, target, events, opts) {
    return basicAttack(state, unit, target, events, {
      forced: true,
      noReaction: true,
      noBreak: !!(opts && opts.noBreak),
      label: (opts && opts.label) || "普攻"
    });
  }

  function basicBreak(state, unit, target, events) {
    if (target.breakImmune) throw new Error("这个单位无法被击溃");
    var threshold = B.rules.CONFIG.breakThreshold;
    if (target.breakValue < threshold) {
      throw new Error("击溃值不足 " + threshold + "（现在 " + target.breakValue + "）");
    }
    var rounds = B.rules.breakRounds(target.breakValue);
    /* 被动先按进入击溃前的击溃值结算（如以德服人），再清零并进入击溃 */
    if (state.phase !== "finished" && B.skills && B.skills.runHooks) {
      B.skills.runHooks(state, unit, "breakAction", {
        sourceUid: unit.uid,
        targetUid: target.uid,
        skillId: "passive.breakAction",
        label: "击溃被动"
      }, events);
    }
    if (state.phase === "finished") {
      return { kind: "basic", type: "break", target: target.uid };
    }
    var applied = B.state.enterBreak(target, rounds, "break." + unit.uid, "击溃");
    events.push({
      type: "statusAdd",
      round: state.round,
      uid: target.uid,
      kind: "break",
      remain: applied.remain,
      source: "break",
      label: "击溃"
    });
    return { kind: "basic", type: "break", target: target.uid };
  }

  function basicChargeMp(state, unit, events) {
    var max = B.state.maxMpOf(unit);
    if (unit.mp >= max) throw new Error("蓝已满");
    unit.mp += 1;
    events.push({ type: "mp", round: state.round, uid: unit.uid, delta: 1, mp: unit.mp, reason: "chargeMp" });
    return { kind: "basic", type: "chargeMp" };
  }

  function execute(state, action, events) {
    if (!action || typeof action !== "object") throw new Error("动作格式错误");
    var unit = currentUnit(state);
    /* 行动前的持续效果判定（高猿长啸）：跳过时行动照样消耗，committed 仍是原动作，
       因为掷骰由种子决定，回放会得到同一次判定。 */
    if (B.effectOps && B.effectOps.actionGate && !B.effectOps.actionGate(state, unit, events)) {
      return action;
    }
    var result;
    if (action.kind === "basic") {
      var onlyBasic = B.state.hasStatus(unit, "onlyBasic");
      if (onlyBasic && action.type !== "attack") {
        throw new Error("现在只能普攻");
      }
      if (action.type === "attack") {
        if (B.state.hasStatus(unit, "noBasic")) throw new Error("无法普攻");
        var targetUnit = requireTarget(state, unit, action.target);
        var gate = B.skills && B.skills.basicGate
          ? B.skills.basicGate(state, unit, targetUnit.uid, events)
          : { allow: true, reason: "" };
        if (!gate.allow) throw new Error(gate.reason || "无法普攻");
        result = basicAttack(state, unit, targetUnit, events);
      } else if (action.type === "break") {
        result = basicBreak(state, unit, requireTarget(state, unit, action.target), events);
      } else if (action.type === "chargeMp") {
        result = basicChargeMp(state, unit, events);
      } else {
        throw new Error("未知的基础动作：" + action.type);
      }
    } else if (action.kind === "skill" || action.kind === "charge") {
      if (!B.skills || !B.skills.execute) throw new Error("技能系统尚未接入");
      result = B.skills.execute(state, unit, action, events);
    } else {
      throw new Error("未知的动作类型：" + action.kind);
    }
    if (state.phase !== "finished" && B.skills && B.skills.runHooks) {
      B.skills.runHooks(state, unit, "afterAction", {
        sourceUid: unit.uid,
        targetUid: (result && result.target) || action.target || "",
        skillId: "passive.afterAction",
        label: "行动后",
        actionKind: action.kind,
        actionType: action.type || "",
        usedSkill: action.skillId || ""
      }, events);
    }
    return result;
  }

  function list(state) {
    var out = [];
    if (state.phase === "finished" || !state.turnUid) return out;
    var unit = B.state.unitOf(state, state.turnUid);
    var mySide = B.state.sideOf(state, unit.uid);
    var enemySide = B.state.otherSide(state, mySide);
    var enemyList = B.state.combatantsOf(state, enemySide);
    var allowedUids = B.traits && B.traits.ignoreTaunt && B.traits.ignoreTaunt(unit)
      ? enemyList.map(function (u) { return u.uid; })
      : (B.skills && B.skills.maxTauntUids ? B.skills.maxTauntUids(state, enemySide) : enemyList.map(function (u) { return u.uid; }));
    var targets = enemyList.filter(function (u) { return allowedUids.indexOf(u.uid) >= 0; }).map(function (u) { return u.uid; });
    var hasAction = unit.actionsLeft > 0;
    var basicNeed = unit.trait && unit.trait.basicCharge ? unit.trait.basicCharge : 0;
    var basicHave = basicNeed > 0 && unit.charge && unit.charge.skillId === BASIC_CHARGE_ID
      ? unit.charge.amount
      : 0;
    var onlyBasic = B.state.hasStatus(unit, "onlyBasic");
    var noBasic = B.state.hasStatus(unit, "noBasic");
    var gate = B.skills && B.skills.basicGate
      ? B.skills.basicGate(state, unit, targets[0] || "", [])
      : { allow: true, reason: "" };
    var breakable = targets.filter(function (uid) {
      var t = B.state.unitOf(state, uid);
      return !t.breakImmune && t.breakValue >= B.rules.CONFIG.breakThreshold;
    });
    out.push({
      kind: "basic",
      type: "attack",
      label: "普攻",
      enabled: hasAction && !noBasic && gate.allow,
      reason: !hasAction
        ? "本回合行动已用完"
        : (noBasic ? "无法普攻" : (gate.allow ? "" : (gate.reason || "无法普攻"))),
      targets: targets,
      chargeNeed: basicNeed,
      chargeHave: basicHave
    });
    out.push({
      kind: "basic",
      type: "break",
      label: "击溃",
      enabled: hasAction && !onlyBasic && breakable.length > 0,
      reason: !hasAction
        ? "本回合行动已用完"
        : (onlyBasic
          ? "现在只能普攻"
          : (breakable.length ? "" : "目标击溃值不足 " + B.rules.CONFIG.breakThreshold)),
      targets: breakable
    });
    out.push({
      kind: "basic",
      type: "chargeMp",
      label: "蓄蓝",
      enabled: hasAction && !onlyBasic && unit.mp < B.state.maxMpOf(unit),
      reason: !hasAction
        ? "本回合行动已用完"
        : (onlyBasic
          ? "现在只能普攻"
          : (unit.mp < B.state.maxMpOf(unit) ? "" : "蓝已满")),
      targets: []
    });
    return out;
  }

  api.execute = execute;
  api.list = list;
  api.currentUnit = currentUnit;
  api.strike = strike;

  if (typeof module === "object" && module.exports) module.exports = B;
})(typeof globalThis !== "undefined" ? globalThis : this);

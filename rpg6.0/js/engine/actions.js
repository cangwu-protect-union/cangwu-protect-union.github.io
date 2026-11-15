/* 回合制正传 6.0 · 战斗引擎 · 动作
   M1 只做普攻、击溃、蓄蓝；技能的合法性与结算在 M4 接进来。 */
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
    if (uid !== "a" && uid !== "b") throw new Error("目标非法：" + uid);
    B.state.unitOf(state, uid);
    var isSelf = uid === unit.uid;
    var canAlly = !!(unit.trait && unit.trait.canHitAlly);
    if (isSelf && !canAlly) throw new Error("不能以自己为目标");
    return B.state.unitOf(state, uid);
  }

  var BASIC_CHARGE_ID = "basic.attack";

  function basicAttack(state, unit, target, events) {
    var need = unit.trait && unit.trait.basicCharge ? unit.trait.basicCharge : 0;
    if (need > 0) {
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
    if (selfHit) {
      type = "true";
    } else if (B.skills && B.skills.basicMod) {
      var mod = B.skills.basicMod(state, unit, target, events) || {};
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
    B.damage.hit(state, {
      sourceUid: unit.uid,
      targetUid: target.uid,
      type: type,
      amount: amount,
      healBack: selfHit,
      skillId: "basic.attack",
      label: "普攻"
    }, events);
    if (state.phase !== "finished" && B.skills && B.skills.runHooks) {
      B.skills.runHooks(state, unit, "basicHit", {
        sourceUid: unit.uid,
        targetUid: target.uid,
        skillId: "passive.basicHit",
        label: "普攻被动"
      }, events);
    }
    return { kind: "basic", type: "attack", target: target.uid, charged: false };
  }

  function basicBreak(state, unit, target, events) {
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
    if (action.kind === "basic") {
      if (action.type === "attack") {
        return basicAttack(state, unit, requireTarget(state, unit, action.target), events);
      }
      if (action.type === "break") {
        return basicBreak(state, unit, requireTarget(state, unit, action.target), events);
      }
      if (action.type === "chargeMp") {
        return basicChargeMp(state, unit, events);
      }
      throw new Error("未知的基础动作：" + action.type);
    }
    if (action.kind === "skill" || action.kind === "charge") {
      if (!B.skills || !B.skills.execute) throw new Error("技能系统尚未接入");
      return B.skills.execute(state, unit, action, events);
    }
    throw new Error("未知的动作类型：" + action.kind);
  }

  function list(state) {
    var out = [];
    if (state.phase === "finished" || !state.turnUid) return out;
    var unit = B.state.unitOf(state, state.turnUid);
    var other = B.state.otherUid(state, unit.uid);
    var hasAction = unit.actionsLeft > 0;
    var basicNeed = unit.trait && unit.trait.basicCharge ? unit.trait.basicCharge : 0;
    var basicHave = basicNeed > 0 && unit.charge && unit.charge.skillId === BASIC_CHARGE_ID
      ? unit.charge.amount
      : 0;
    out.push({
      kind: "basic",
      type: "attack",
      label: "普攻",
      enabled: hasAction,
      reason: hasAction ? "" : "本回合行动已用完",
      targets: [other],
      chargeNeed: basicNeed,
      chargeHave: basicHave
    });
    out.push({
      kind: "basic",
      type: "break",
      label: "击溃",
      enabled: hasAction && B.state.unitOf(state, other).breakValue >= B.rules.CONFIG.breakThreshold,
      reason: hasAction
        ? (B.state.unitOf(state, other).breakValue >= B.rules.CONFIG.breakThreshold
          ? ""
          : "目标击溃值不足 " + B.rules.CONFIG.breakThreshold)
        : "本回合行动已用完",
      targets: [other]
    });
    out.push({
      kind: "basic",
      type: "chargeMp",
      label: "蓄蓝",
      enabled: hasAction && unit.mp < B.state.maxMpOf(unit),
      reason: hasAction ? (unit.mp < B.state.maxMpOf(unit) ? "" : "蓝已满") : "本回合行动已用完",
      targets: []
    });
    return out;
  }

  api.execute = execute;
  api.list = list;
  api.currentUnit = currentUnit;

  if (typeof module === "object" && module.exports) module.exports = B;
})(typeof globalThis !== "undefined" ? globalThis : this);

/* 回合制正传 6.0 · 战斗引擎 · 伤害、回血、强扣
   所有血量变化都经过这里，方便一处管住击溃值、蓄力打断、死亡判定。 */
(function (root) {
  "use strict";
  var B = root.RPG6B || (root.RPG6B = {});
  var api = B.damage = B.damage || {};

  function pushEvent(events, event) {
    if (events) events.push(event);
    return event;
  }

  function clearCharge(state, unit, reason, events) {
    if (!unit.charge) return false;
    var lost = unit.charge.amount;
    var skillId = unit.charge.skillId;
    unit.charge = null;
    unit.reflect = null;
    pushEvent(events, {
      type: "chargeLost",
      round: state.round,
      uid: unit.uid,
      skillId: skillId,
      amount: lost,
      reason: reason
    });
    return true;
  }

  function canBreakCharge(unit) {
    if (!unit.charge) return false;
    if (unit.charge.indestructible) return false;
    if (B.traits.chargeUnbreakable(unit)) return false;
    return true;
  }

  function addBreakValue(state, unit, events) {
    if (B.state.hasStatus(unit, "break")) {
      unit.breakValue = 0;
      return false;
    }
    var max = B.rules.CONFIG.breakValueMax;
    if (unit.breakValue >= max) return false;
    unit.breakValue += 1;
    pushEvent(events, { type: "breakValue", round: state.round, uid: unit.uid, value: unit.breakValue });
    return true;
  }

  function addStunValue(state, unit, events) {
    var max = B.rules.CONFIG.stunValueMax;
    if (unit.stunValue >= max) return false;
    unit.stunValue += 1;
    pushEvent(events, { type: "stunValue", round: state.round, uid: unit.uid, value: unit.stunValue });
    return true;
  }

  function resolveDeath(state, unit, events) {
    if (unit.hp > 0) return false;
    if (B.state.hasStatus(unit, "noDeath")) {
      unit.hp = 1;
      pushEvent(events, { type: "noDeath", round: state.round, uid: unit.uid });
      return false;
    }
    if (unit.isSummon) {
      if (B.summons && B.summons.remove) B.summons.remove(state, unit.uid, "death", events);
      pushEvent(events, { type: "summonDeath", round: state.round, uid: unit.uid, name: unit.name, ownerUid: unit.ownerUid });
      return false;
    }
    var winnerSide = B.state.otherSide(state, unit.side);
    var winner = B.state.heroOf(state, winnerSide);
    B.state.finish(state, winner ? winner.uid : winnerSide);
    pushEvent(events, { type: "death", round: state.round, uid: unit.uid });
    if (B.summons && B.summons.clearSide) B.summons.clearSide(state, unit.side, "ownerDeath", events);
    return true;
  }

  function hit(state, spec, events) {
    var target = B.state.unitOf(state, spec.targetUid);
    var source = null;
    if (spec.sourceUid) {
      try {
        source = B.state.unitOf(state, spec.sourceUid);
      } catch (err) {
        source = null;
      }
    }
    var type = spec.type || "phys";
    var amount = Number(spec.amount) || 0;
    var targetStats = { def: B.state.defOf(target), mres: B.state.mresOf(target) };
    var raw = B.rules.rawByType(type, amount, targetStats);
    var mul = source ? B.rules.multiplier(source, target) : 1;
    var dmg = B.rules.finalDamage(raw, mul);
    var fromBuff = !!spec.fromBuff;
    var noBreak = !!spec.noBreak;
    var noStun = !!spec.noStun;
    if (source && source.isSummon) {
      noBreak = true;
      noStun = true;
    }
    if (source && B.state.hasStatus(source, "noBreakOut")) noBreak = true;

    if (dmg > 0 && !spec.noReaction && B.skills && B.skills.runHooks) {
      var pre = {
        sourceUid: spec.sourceUid || "",
        targetUid: target.uid,
        skillId: "passive.beforeDamage",
        label: "受击判定",
        damageType: type,
        amount: dmg,
        dodge: false
      };
      B.skills.runHooks(state, target, "beforeDamage", pre, events);
      if (pre.dodge) {
        spec.dodged = true;
        pushEvent(events, {
          type: "dodge",
          round: state.round,
          uid: target.uid,
          sourceUid: spec.sourceUid || "",
          label: pre.label || "闪避",
          skillId: spec.skillId || ""
        });
        return 0;
      }
      if (state.phase === "finished") return 0;
    }

    if (dmg > 0 && target.reflect && target.charge && !spec.reflected) {
      pushEvent(events, {
        type: "reflect",
        round: state.round,
        uid: target.uid,
        against: spec.sourceUid || "",
        amount: dmg,
        factor: target.reflect.factor || 2
      });
      if (source && spec.sourceUid) {
        hit(state, {
          sourceUid: target.uid,
          targetUid: source.uid,
          type: type,
          amount: dmg * (target.reflect.factor || 2),
          noBreak: true,
          noReaction: true,
          reflected: true,
          skillId: spec.skillId
        }, events);
        if (target.reflect.stunRounds > 0) {
          var stun = B.state.addStatus(source, {
            kind: "stun",
            remain: target.reflect.stunRounds,
            source: "reflect",
            label: "眩晕"
          });
          pushEvent(events, {
            type: "statusAdd",
            round: state.round,
            uid: source.uid,
            kind: "stun",
            remain: stun.remain,
            source: "reflect",
            label: "眩晕"
          });
        }
      }
      return 0;
    }

    var beforeHp = target.hp;
    target.hp = Math.max(0, target.hp - dmg);
    B.state.markHpLoss(target, beforeHp);
    target.lastDamageType = type;
    if (dmg > 0) {
      target.stats.hitsTaken += 1;
      B.state.addHpLog(target, state.round, -dmg);
      if (source && source !== target) source.stats.hitsDealt += 1;
    }

    pushEvent(events, {
      type: "damage",
      round: state.round,
      sourceUid: spec.sourceUid || "",
      uid: target.uid,
      damageType: type,
      amount: dmg,
      raw: raw,
      multiplier: mul,
      noBreak: noBreak,
      fromBuff: fromBuff,
      skillId: spec.skillId || "",
      label: spec.label || "",
      hpAfter: target.hp
    });

    if (dmg > 0 && !noBreak && !fromBuff) {
      addBreakValue(state, target, events);
      if (!noStun) addStunValue(state, target, events);
    }
    if (dmg > 0 && !fromBuff && canBreakCharge(target)) {
      clearCharge(state, target, "damage", events);
    }
    if (spec.healBack && source && dmg > 0) {
      heal(state, { uid: source.uid, amount: dmg, rounding: "none", reason: "healBack" }, events);
    }
    resolveDeath(state, target, events);
    if (dmg > 0 && state.phase !== "finished" && B.skills && B.skills.runHooks) {
      var post = {
        sourceUid: spec.sourceUid || "",
        targetUid: target.uid,
        skillId: "passive.afterDamage",
        label: "伤害结算后",
        damageType: type,
        amount: dmg,
        fromBuff: fromBuff
      };
      if (source) B.skills.runHooks(state, source, "damageDealt", post, events);
      if (state.phase !== "finished") B.skills.runHooks(state, target, "damageTaken", post, events);
    }
    return dmg;
  }

  function directLoss(state, spec, events) {
    var target = B.state.unitOf(state, spec.targetUid);
    var amount = B.rules.round5(Number(spec.amount) || 0);
    if (amount <= 0) return 0;
    var beforeHp = target.hp;
    target.hp = Math.max(0, target.hp - amount);
    B.state.markHpLoss(target, beforeHp);
    B.state.addHpLog(target, state.round, -amount);
    pushEvent(events, {
      type: "directLoss",
      round: state.round,
      sourceUid: spec.sourceUid || "",
      uid: target.uid,
      amount: amount,
      skillId: spec.skillId || "",
      label: spec.label || "",
      hpAfter: target.hp
    });
    resolveDeath(state, target, events);
    return amount;
  }

  function heal(state, spec, events) {
    var unit = B.state.unitOf(state, spec.uid);
    var raw = Number(spec.amount) || 0;
    if (raw <= 0) return 0;
    var rounding = spec.rounding || "round5";
    var amount = raw;
    if (rounding === "round5") amount = B.rules.round5(raw);
    else if (rounding === "int") amount = B.rules.ceilTo(raw, 1);
    else if (rounding === "ten") amount = B.rules.ceilTo(raw, 10);
    var max = B.state.maxHpOf(unit);
    var applied = Math.max(0, Math.min(amount, max - unit.hp));
    unit.hp += applied;
    B.state.addHpLog(unit, state.round, applied);
    pushEvent(events, {
      type: "heal",
      round: state.round,
      uid: unit.uid,
      amount: applied,
      raw: raw,
      rounding: rounding,
      skillId: spec.skillId || "",
      label: spec.label || "",
      hpAfter: unit.hp
    });
    return applied;
  }

  function healFull(state, spec, events) {
    var unit = B.state.unitOf(state, spec.uid);
    return heal(state, { uid: unit.uid, amount: B.state.maxHpOf(unit) - unit.hp, rounding: "none", skillId: spec.skillId, label: spec.label }, events);
  }

  api.hit = hit;
  api.directLoss = directLoss;
  api.heal = heal;
  api.healFull = healFull;
  api.clearCharge = clearCharge;

  if (typeof module === "object" && module.exports) module.exports = B;
})(typeof globalThis !== "undefined" ? globalThis : this);

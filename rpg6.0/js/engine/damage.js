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
    if (B.state.effectHasFlag && B.state.effectHasFlag(unit, "chargeGuard")) return false;
    return true;
  }

  /* 防护层取消一次伤害：一次动作的多段伤害只算一次免疫（actionId 相同）。
     次数用完后移除该效果并执行 onCancel。 */
  function consumeGuard(state, target, spec, events) {
    if (!B.state.guardEffectOf) return false;
    var effect = B.state.guardEffectOf(target);
    if (!effect) return false;
    var guard = effect.guard;
    var actionId = spec.actionId || "";
    if (actionId && guard.blockedActionId === actionId) return true;
    if (actionId) guard.blockedActionId = actionId;
    guard.remaining -= 1;
    pushEvent(events, {
      type: "guardBlock",
      round: state.round,
      uid: target.uid,
      sourceUid: spec.sourceUid || "",
      label: effect.label || "防护",
      remain: Math.max(0, guard.remaining),
      skillId: spec.skillId || ""
    });
    if (guard.remaining <= 0) {
      var kept = [];
      for (var i = 0; i < target.effects.length; i++) {
        if (target.effects[i] !== effect) kept.push(target.effects[i]);
      }
      target.effects = kept;
      pushEvent(events, {
        type: "effectExpire",
        round: state.round,
        uid: target.uid,
        kind: "effect",
        label: effect.label || ""
      });
      if (guard.ops && guard.ops.length && B.effectOps && B.effectOps.runOps) {
        /* 触发/反击类后续 ops 的目标固定取敌方英雄：召唤物攻击不算「对方本人」，
           也避免把无血计时物当目标后因 hp=0 被立即移除而找不到单位。 */
        var foeHero = B.state.heroOf(state, B.state.otherSide(state, target.side));
        B.effectOps.runOps(state, {
          sourceUid: effect.sourceUid || target.uid,
          targetUid: foeHero ? foeHero.uid : "",
          skillId: effect.skillId || "",
          label: effect.label || ""
        }, guard.ops, events);
      }
    }
    return true;
  }

  /* 护盾全额吸收：护盾在时这一段伤害全部吃掉、不扣血；破盾后的多余伤害也消失 */
  function shieldAbsorb(state, target, amount, events) {
    if (!target.shield || target.shield.hp <= 0) return false;
    var label = target.shield.label || "";
    target.shield.hp -= amount;
    var broke = target.shield.hp <= 0;
    pushEvent(events, {
      type: "shieldHit",
      round: state.round,
      uid: target.uid,
      absorbed: amount,
      remain: Math.max(0, target.shield.hp),
      label: label
    });
    if (broke) {
      target.shield = null;
      pushEvent(events, { type: "shieldBreak", round: state.round, uid: target.uid, label: label });
    }
    return true;
  }

  function addBreakValue(state, unit, events) {
    if (B.state.hasStatus(unit, "breakLock")) return false;
    if (B.state.strongImmune && B.state.strongImmune(unit)) return false;
    if (B.state.hasStatus(unit, "break")) {
      unit.breakValue = 0;
      return false;
    }
    var max = B.rules.CONFIG.breakValueMax;
    if (unit.breakValue >= max) return false;
    unit.breakValue += 1;
    pushEvent(events, { type: "breakValue", round: state.round, uid: unit.uid, value: unit.breakValue });
    var foe = B.state.heroOf(state, B.state.otherSide(state, B.state.sideOf(state, unit.uid)));
    if (foe && B.state.effectHasFlag(foe, "autoBreakAtCap") && unit.breakValue >= max) {
      var rounds = B.rules.breakRounds(unit.breakValue);
      var st = B.state.enterBreak(unit, rounds, "autoBreak", "击溃（旱葱大祓）");
      if (st && st.remain > 0) {
        pushEvent(events, {
          type: "statusAdd",
          round: state.round,
          uid: unit.uid,
          kind: "break",
          remain: st.remain,
          source: "autoBreak",
          label: "击溃（旱葱大祓）"
        });
      }
    }
    return true;
  }

  function addStunValue(state, unit, events) {
    if (B.state.strongImmune && B.state.strongImmune(unit)) return false;
    var max = B.rules.CONFIG.stunValueMax;
    if (unit.stunValue >= max) return false;
    unit.stunValue += 1;
    pushEvent(events, { type: "stunValue", round: state.round, uid: unit.uid, value: unit.stunValue });
    return true;
  }

  /* 不死窗口（甲天浩向死而生）：血量 ≤0 不判负，第 5 个标准回合结束判定。
     触发当回合算第 1 个；窗口内可负血、可行动，普攻真伤/回血/击溃值锁定。 */
  function startUndying(state, unit, events) {
    unit.undying = { untilRound: state.round + 4 };
    unit.breakValue = 0;
    if (unit.marks && unit.marks.deaths) {
      var mark = unit.marks.deaths;
      mark.value = Math.min(mark.max == null ? 99 : mark.max, mark.value + 1);
    }
    B.state.addStatus(unit, { kind: "undying", remain: 5, unit: "standard", source: "undying", label: "向死而生" });
    B.state.addStatus(unit, { kind: "noBreakOut", remain: 5, unit: "standard", source: "undying", label: "向死而生·不造成击溃值" });
    B.state.addStatus(unit, { kind: "breakLock", remain: 5, unit: "standard", source: "undying", label: "向死而生·击溃值锁定" });
    pushEvent(events, {
      type: "undying",
      round: state.round,
      uid: unit.uid,
      untilRound: unit.undying.untilRound,
      deaths: unit.marks && unit.marks.deaths ? unit.marks.deaths.value : 0
    });
  }

  function clearUndying(unit) {
    unit.undying = null;
    unit.statuses = (unit.statuses || []).filter(function (status) {
      return status.source !== "undying";
    });
  }

  function checkUndying(state, events) {
    for (var i = 0; i < state.units.length; i++) {
      var unit = state.units[i];
      if (!unit.undying) continue;
      if (state.round < unit.undying.untilRound) continue;
      var revived = unit.hp > 0;
      clearUndying(unit);
      if (revived) {
        B.state.addMod(unit, {
          stat: "maxHp",
          mode: "add",
          value: -100,
          remain: B.state.PERMANENT,
          source: "undying.revive",
          label: "向死而生·复活"
        });
        B.state.clampHpToMax(unit);
        revived = unit.hp > 0;
      }
      if (revived) {
        pushEvent(events, {
          type: "undyingRevive",
          round: state.round,
          uid: unit.uid,
          hp: unit.hp,
          maxHp: B.state.maxHpOf(unit)
        });
      } else {
        unit.undyingLethal = true;
        resolveDeath(state, unit, events);
        unit.undyingLethal = false;
        if (state.phase === "finished") return;
      }
    }
  }

  function resolveDeath(state, unit, events) {
    if (unit.hp > 0) return false;
    if (unit.undying) return false;
    if (state.selfKillWinner && state.selfKillWinner === unit.uid) {
      B.state.finish(state, unit.uid);
      pushEvent(events, { type: "death", round: state.round, uid: unit.uid });
      if (B.summons && B.summons.clearSide) B.summons.clearSide(state, unit.side, "ownerDeath", events);
      return true;
    }
    if (B.state.hasStatus(unit, "noDeath")) {
      unit.hp = 1;
      pushEvent(events, { type: "noDeath", round: state.round, uid: unit.uid });
      return false;
    }
    if (unit.rewind && unit.rewind.pending && unit.rewind.snapshot) {
      state.pendingRewind = { uid: unit.uid, mode: "death" };
      return false;
    }
    if (unit.undyingEnabled && !unit.undyingLethal) {
      startUndying(state, unit, events);
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

  /* 法伤一次性易伤：命中后消耗一层 magicVuln（技能「高冷如冰」） */
  function consumeMagicVuln(state, target, events) {
    var list = target.buffs || [];
    for (var i = list.length - 1; i >= 0; i--) {
      if (list[i].kind !== "magicVuln") continue;
      var buff = list.splice(i, 1)[0];
      pushEvent(events, {
        type: "buffConsume",
        round: state.round,
        uid: target.uid,
        kind: buff.kind,
        percent: buff.percent,
        label: buff.label || ""
      });
      return true;
    }
    return false;
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
    if (B.state.strongImmune && B.state.strongImmune(target) && type !== "true") {
      pushEvent(events, {
        type: "strongImmune",
        round: state.round,
        uid: target.uid,
        sourceUid: spec.sourceUid || "",
        damageType: type,
        skillId: spec.skillId || "",
        label: spec.label || ""
      });
      return 0;
    }
    var targetStats = { def: B.state.defOf(target), mres: B.state.mresOf(target) };
    var raw = B.rules.rawByType(type, amount, targetStats);
    var mul = source ? B.rules.multiplier(source, target, type) : 1;
    var dmg = B.rules.finalDamage(raw, mul);
    var fromBuff = !!spec.fromBuff;
    var noBreak = !!spec.noBreak;
    var addStun = !!spec.addStun;
    if (source && source.isSummon) {
      noBreak = true;
      addStun = false;
    }
    if (source && B.state.hasStatus(source, "noBreakOut")) noBreak = true;

    /* 主动闪避（卫委壮观）：受击方在扣血前选择花防御/法抗取消这一段。
       只有真的能付得起才询问；两项都不够时既不询问也不递增 hitSeq。
       选支付立即永久扣属性并取消该段（不加击溃/眩晕、不清蓄力、不触发受击后被动）。 */
    if (dmg > 0 && B.skills && B.skills.activeDodgeOf) {
      var ad = B.skills.activeDodgeOf(target);
      if (ad) {
        var options = [];
        if (B.state.defOf(target) >= ad.costDef) options.push({ key: "def", label: "花 " + ad.costDef + " 防御" });
        if (B.state.mresOf(target) >= ad.costMres) options.push({ key: "mres", label: "花 " + ad.costMres + " 法抗" });
        if (options.length) {
          var seq = (state.hitSeq || 0) + 1;
          state.hitSeq = seq;
          /* 全局段号，整局唯一：持续/召唤/反弹伤害没有 actionId，也不会和旧响应撞车；重放稳定 */
          var key = "hit:" + seq;
          var resp = state.responses && state.responses[key];
          if (resp == null) {
            var err = new Error("需要选择是否闪避");
            err.pending = {
              key: key,
              kind: "dodge",
              responderUid: target.uid,
              requesterUid: spec.sourceUid || "",
              skillId: spec.skillId || "",
              round: state.round,
              prompt: "卫委壮观：是否闪避这次伤害？",
              options: options.concat([{ key: "none", label: "不闪" }]),
              defaultChoice: "none",
              payload: { defCost: ad.costDef, mresCost: ad.costMres }
            };
            throw err;
          }
          if (resp === "def" || resp === "mres") {
            var cost = resp === "def" ? ad.costDef : ad.costMres;
            B.state.addMod(target, {
              stat: resp,
              mode: "add",
              value: -cost,
              remain: B.state.PERMANENT,
              source: "weixiang." + resp,
              label: "卫委壮观"
            });
            pushEvent(events, {
              type: "dodge",
              round: state.round,
              uid: target.uid,
              sourceUid: spec.sourceUid || "",
              label: "卫委壮观（花 " + cost + (resp === "def" ? " 防御" : " 法抗") + "）",
              skillId: spec.skillId || ""
            });
            spec.dodged = true;
            return 0;
          }
        }
      }
    }

    /* 防护层：完全免疫该次（不掉血、不加击溃/眩晕值、不清蓄力、不触发受击后被动） */
    if (dmg > 0 && consumeGuard(state, target, spec, events)) return 0;
    if (state.phase === "finished") return 0;

    /* 受击掷骰免疫：任何伤害（含 Buff 持续伤害、反弹与被动强制普攻）都先掷骰 */
    if (dmg > 0 && B.skills && B.skills.rollDodge) {
      var dodgeLabel = B.skills.rollDodge(state, target, events);
      if (dodgeLabel) {
        spec.dodged = true;
        pushEvent(events, {
          type: "dodge",
          round: state.round,
          uid: target.uid,
          sourceUid: spec.sourceUid || "",
          label: dodgeLabel,
          skillId: spec.skillId || ""
        });
        return 0;
      }
    }

    if (dmg > 0 && !spec.noReaction && B.skills && B.skills.runHooks) {
      var pre = {
        sourceUid: spec.sourceUid || "",
        targetUid: target.uid,
        skillId: "passive.beforeDamage",
        label: "受击判定",
        damageType: type,
        amount: dmg,
        dodge: false,
        convert: ""
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
      /* 伤害转血上限（学富五车 E3）：不扣血、等量加血上限；强扣不是伤害、不转换；
         转换后不触发击溃/眩晕/蓄力打断与伤害后被动，事件单独一条，避免被当成闪避。 */
      if (pre.convert === "maxHp") {
        B.state.addMod(target, {
          stat: "maxHp",
          mode: "add",
          value: dmg,
          remain: B.state.PERMANENT,
          source: "convert.maxHp",
          label: "伤害转血上限"
        });
        pushEvent(events, {
          type: "convertMaxHp",
          round: state.round,
          sourceUid: spec.sourceUid || "",
          uid: target.uid,
          amount: dmg,
          skillId: spec.skillId || "",
          label: spec.label || ""
        });
        return 0;
      }
      if (state.phase === "finished") return 0;
    }

    /* 固定值反弹（扣分!）：取消该次伤害，对攻击者造成固定法伤，消耗 1 次 */
    if (dmg > 0 && target.reflectFixed && target.reflectFixed.charges > 0 && source && !spec.reflected) {
      var rf = target.reflectFixed;
      rf.charges -= 1;
      pushEvent(events, {
        type: "reflectFixed",
        round: state.round,
        uid: target.uid,
        against: source.uid,
        value: rf.value,
        damageType: rf.type,
        remain: rf.charges,
        label: rf.label || "",
        skillId: spec.skillId || ""
      });
      hit(state, {
        sourceUid: target.uid,
        targetUid: source.uid,
        type: rf.type,
        amount: rf.value,
        noBreak: true,
        noReaction: true,
        reflected: true,
        skillId: spec.skillId,
        label: rf.label || ""
      }, events);
      if (rf.charges <= 0) target.reflectFixed = null;
      return 0;
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
    /* 护盾：全吸收这一段，不扣血也不触发伤害后被动 */
    if (dmg > 0 && shieldAbsorb(state, target, dmg, events)) {
      target.lastDamageType = type;
      return 0;
    }
    if (dmg > 0 && type === "magic") consumeMagicVuln(state, target, events);
    var hpFloor = target.undying || (target.undyingEnabled && !target.undyingLethal) ? -Infinity : 0;
    target.hp = Math.max(hpFloor, target.hp - dmg);
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

    /* 默认只有击溃值；眩晕值必须在技能里显式写「造成眩晕值」（damage.addStun） */
    if (dmg > 0 && !noBreak && !fromBuff) addBreakValue(state, target, events);
    if (dmg > 0 && addStun && !fromBuff) addStunValue(state, target, events);
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
    if (B.state.strongImmune && B.state.strongImmune(target)) {
      pushEvent(events, {
        type: "strongImmune",
        round: state.round,
        uid: target.uid,
        sourceUid: spec.sourceUid || "",
        skillId: spec.skillId || "",
        label: spec.label || ""
      });
      return 0;
    }
    var amount = B.rules.round5(Number(spec.amount) || 0);
    if (amount <= 0) return 0;
    var beforeHp = target.hp;
    var hpFloor = target.undying || (target.undyingEnabled && !target.undyingLethal) ? -Infinity : 0;
    target.hp = Math.max(hpFloor, target.hp - amount);
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
  api.consumeGuard = consumeGuard;
  api.shieldAbsorb = shieldAbsorb;
  api.checkUndying = checkUndying;

  if (typeof module === "object" && module.exports) module.exports = B;
})(typeof globalThis !== "undefined" ? globalThis : this);

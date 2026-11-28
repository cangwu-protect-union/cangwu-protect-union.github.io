/* 回合制正传 6.0 · 战斗引擎 · 效果解释器
   技能数据里的 ops 全部在这里执行。不认识的 op 直接抛错，不静默跳过。
   实现拆成多个文件：本文件是框架与出口，helpers 与各 op 在分片里按顺序加载。 */
(function (root) {
  "use strict";
  var B = root.RPG6B || (root.RPG6B = {});
  var api = B.effectOps = B.effectOps || {};
  var H = {};
  api._helpers = H;
  H.DEBUFF_KINDS = { fragile: true, panic: true };
  H.STATUS_DEBUFF = { break: true, stun: true, noSkill: true, noBasic: true, noCharge: true, cannotAct: true };
  /* 文学巨作「清除异常状态」的范围：眩晕/击溃/眩晕余波 + 封锁类（Q18） */
  H.STATUS_CLEAR = { break: true, stun: true, daze: true, noSkill: true, noBasic: true, noCharge: true, onlyBasic: true, cannotAct: true };

  var OP_REGISTRY = {};
  function registerOp(name, fn) {
    if (OP_REGISTRY[name]) throw new Error("重复注册 op：" + name);
    OP_REGISTRY[name] = fn;
  }
  api.registerOp = registerOp;
  api._registry = OP_REGISTRY;

  function runOp(state, ctx, op, events) {
    if (!op || !op.op) throw new Error("op 缺少 op 字段");
    var handler = OP_REGISTRY[op.op];
    if (!handler) throw new Error("未知的 op：" + op.op);
    return handler(state, ctx, op, events);
  }
  H.runOp = runOp;
  function runOps(state, ctx, ops, events) {
    if (!ops) return;
    for (var i = 0; i < ops.length; i++) {
      if (state.phase === "finished") return;
      H.runOp(state, ctx, ops[i], events);
    }
  }

  function ctxOfEffect(effect) {
    var ctx = {
      sourceUid: effect.sourceUid,
      targetUid: effect.targetUid,
      skillId: effect.skillId,
      label: effect.label,
      fromBuff: effect.fromBuff
    };
    if (effect.capture) {
      for (var key in effect.capture) {
        if (Object.prototype.hasOwnProperty.call(effect.capture, key)) ctx[key] = effect.capture[key];
      }
    }
    return ctx;
  }

  function tickDown(list, events, state, uid, kind, unitFilter) {
    var kept = [];
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (unitFilter && item.unit !== unitFilter) {
        kept.push(item);
        continue;
      }
      if (item.remain === B.state.PERMANENT) {
        kept.push(item);
        continue;
      }
      item.remain -= 1;
      if (item.remain > 0) {
        kept.push(item);
        continue;
      }
      H.pushEvent(state, events, { type: kind + "Expire", uid: uid, kind: item.kind || item.stat || "", label: item.label || "" });
    }
    return kept;
  }

  function dropBrokenEffects(state, unit, events) {
    var kept = [];
    for (var i = 0; i < unit.effects.length; i++) {
      var effect = unit.effects[i];
      var broken = false;
      if (effect.breakOnSourceStatus && effect.sourceUid) {
        var src = H.tryUnit(state, effect.sourceUid);
        if (src) {
          for (var j = 0; j < effect.breakOnSourceStatus.length; j++) {
            if (B.state.hasStatus(src, effect.breakOnSourceStatus[j])) {
              broken = true;
              break;
            }
          }
        }
      }
      /* 持有者自己进入指定状态（如旋转：目标被击溃）时，效果立即结束 */
      if (!broken && effect.breakOnHolderStatus) {
        for (var k = 0; k < effect.breakOnHolderStatus.length; k++) {
          if (B.state.hasStatus(unit, effect.breakOnHolderStatus[k])) {
            broken = true;
            break;
          }
        }
      }
      if (broken) {
        H.pushEvent(state, events, {
          type: "effectExpire",
          uid: unit.uid,
          kind: "effect",
          label: effect.label || ""
        });
        continue;
      }
      kept.push(effect);
    }
    unit.effects = kept;
  }

  function effectDue(effect, state) {
    if (!effect.period) return true;
    var diff = state.round - (effect.bornRound || 0) + 1;
    return diff > 0 && diff % effect.period === 0;
  }

  /* 属性归零后逐标准回合恢复原值（李雨轩「小学生人大代表」）：
     每次 +restore，最后一跳补足到 origin，之后移除整条 set 修正。 */
  function advanceRestores(state, unit, events) {
    var mods = unit.mods || [];
    if (!mods.length) return;
    var kept = [];
    for (var i = 0; i < mods.length; i++) {
      var mod = mods[i];
      if (!mod.restore || mod.mode !== "set") {
        kept.push(mod);
        continue;
      }
      var origin = Number(mod.origin) || 0;
      var current = B.state.statOf(unit, mod.stat);
      if (current >= origin) {
        H.pushEvent(state, events, { type: "modExpire", uid: unit.uid, kind: mod.stat, label: mod.label || "" });
        continue;
      }
      var step = Math.min(Number(mod.restore) || 0, origin - current);
      if (step > 0) mod.progress = (Number(mod.progress) || 0) + step;
      kept.push(mod);
    }
    unit.mods = kept;
  }

  /* 护盾按标准回合计时：到期移除并执行 onExpire（杨冬明「坚若磐石」加防） */
  function expireShields(state, events) {
    for (var i = 0; i < state.units.length; i++) {
      var unit = state.units[i];
      if (!unit.shield) continue;
      unit.shield.remain -= 1;
      if (unit.shield.remain > 0) continue;
      var ops = unit.shield.ops;
      var label = unit.shield.label;
      unit.shield = null;
      H.pushEvent(state, events, { type: "shieldExpire", uid: unit.uid, label: label });
      if (ops && ops.length) {
        H.runOps(state, {
          sourceUid: unit.uid,
          targetUid: B.state.otherUid(state, unit.uid),
          skillId: "shield.expire",
          label: label
        }, ops, events);
      }
    }
  }

  function standardRoundEnd(state, events) {
    for (var i = 0; i < state.units.length; i++) {
      var unit = state.units[i];
      dropBrokenEffects(state, unit, events);
      var active = unit.effects.slice();
      for (var e = 0; e < active.length; e++) {
        if (state.phase === "finished") break;
        /* 回合开始时结算的效果（无能狂怒）只在持有者回合开始跑，不在标准回合末重复跑 */
        if (active[e].when === "turnStart") continue;
        if (!effectDue(active[e], state)) continue;
        H.runOps(state, ctxOfEffect(active[e]), active[e].ops, events);
      }
      var due = [];
      var later = [];
      for (var s = 0; s < unit.scheduled.length; s++) {
        if (unit.scheduled[s].atPhase === "roundStart") {
          later.push(unit.scheduled[s]);
        } else if (unit.scheduled[s].atRound <= state.round) due.push(unit.scheduled[s]);
        else later.push(unit.scheduled[s]);
      }
      unit.scheduled = later;
      for (var d = 0; d < due.length; d++) {
        if (state.phase === "finished") break;
        H.runOps(state, ctxOfEffect(due[d]), due[d].ops, events);
      }
    }
    if (B.summons && B.summons.tick) B.summons.tick(state, events);
    expireShields(state, events);
    var summonList = (state.summons || []).slice();
    for (var si = 0; si < summonList.length; si++) {
      var summon = null;
      for (var sj = 0; sj < state.summons.length; sj++) {
        if (state.summons[sj].uid === summonList[si].uid) summon = state.summons[sj];
      }
      if (!summon || (summon.targetable && summon.hp <= 0)) continue;
      dropBrokenEffects(state, summon, events);
      var sEffects = summon.effects.slice();
      for (var se = 0; se < sEffects.length; se++) {
        if (state.phase === "finished") break;
        if (!effectDue(sEffects[se], state)) continue;
        H.runOps(state, ctxOfEffect(sEffects[se]), sEffects[se].ops, events);
      }
      var sDue = [];
      var sLater = [];
      for (var sc = 0; sc < summon.scheduled.length; sc++) {
        if (summon.scheduled[sc].atRound <= state.round) sDue.push(summon.scheduled[sc]);
        else sLater.push(summon.scheduled[sc]);
      }
      summon.scheduled = sLater;
      for (var sd = 0; sd < sDue.length; sd++) {
        if (state.phase === "finished") break;
        H.runOps(state, ctxOfEffect(sDue[sd]), sDue[sd].ops, events);
      }
    }
    for (var u = 0; u < state.units.length; u++) {
      var target = state.units[u];
      target.effects = tickDown(target.effects, events, state, target.uid, "effect", "standard");
      target.buffs = tickDown(target.buffs, events, state, target.uid, "buff", "standard");
      target.statuses = tickDown(target.statuses, events, state, target.uid, "status", "standard");
      target.mods = tickDown(target.mods, events, state, target.uid, "mod", "standard");
      advanceRestores(state, target, events);
    }
    var tickSummons = (state.summons || []).slice();
    for (var ti = 0; ti < tickSummons.length; ti++) {
      var item = tickSummons[ti];
      var live = null;
      for (var tj = 0; tj < state.summons.length; tj++) {
        if (state.summons[tj].uid === item.uid) live = state.summons[tj];
      }
      if (!live) continue;
      live.effects = tickDown(live.effects, events, state, live.uid, "effect", "standard");
      live.buffs = tickDown(live.buffs, events, state, live.uid, "buff", "standard");
      live.statuses = tickDown(live.statuses, events, state, live.uid, "status", "standard");
      live.mods = tickDown(live.mods, events, state, live.uid, "mod", "standard");
      advanceRestores(state, live, events);
    }
  }

  function turnEnd(state, unit, events) {
    if (!unit) return;
    for (var b = 0; b < state.units.length; b++) {
      dropBrokenEffects(state, state.units[b], events);
    }
    /* 以「回合」计时、且这一回合轮到它的效果，先结算再扣时间 */
    for (var u = 0; u < state.units.length; u++) {
      var owner = state.units[u];
      var active = owner.effects.slice();
      for (var i = 0; i < active.length; i++) {
        if (!isDueForTurn(state, active[i], unit)) continue;
        if (state.phase === "finished") break;
        H.runOps(state, ctxOfEffect(active[i]), active[i].ops, events);
      }
    }
    for (var k = 0; k < state.units.length; k++) {
      var holder = state.units[k];
      holder.effects = tickTurnList(holder.effects, state, unit, events, "effect");
      holder.buffs = tickTurnList(holder.buffs, state, unit, events, "buff");
      holder.statuses = tickTurnList(holder.statuses, state, unit, events, "status");
      holder.mods = tickTurnList(holder.mods, state, unit, events, "mod");
    }
  }

  function isDueForTurn(state, item, unit) {
    if (item.unit === "selfRound") return item.sourceUid === unit.uid;
    if (item.unit === "targetRound") return item.targetUid === unit.uid;
    /* 按持有者对手英雄的回合计时（王春雨「学富五车」） */
    if (item.unit === "enemyRound") return B.state.otherUid(state, item.targetUid) === unit.uid;
    return false;
  }

  /* 一个单位的回合被跳过（眩晕/击溃/无法行动）时，按「它的回合」计时的状态照常走一格。
     跳过的是谁就按谁的回合结算，所以所有单位身上 due 于该单位的计时都走一格（含 enemyRound）。 */
  function skippedTurn(state, unit, events) {
    for (var u = 0; u < state.units.length; u++) {
      var holder = state.units[u];
      holder.effects = tickTurnList(holder.effects, state, unit, events, "effect");
      holder.buffs = tickTurnList(holder.buffs, state, unit, events, "buff");
      holder.statuses = tickTurnList(holder.statuses, state, unit, events, "status");
      holder.mods = tickTurnList(holder.mods, state, unit, events, "mod");
    }
  }

  /* 按「持有者回合开始」计时的状态/效果：在该单位回合开始时先走一格（彻底疯狂的眩晕余波）。
     when:"turnStart" 的 tick 效果在这里结算：能行动才执行 ops，按时长在回合开始时扣层。 */
  function turnStart(state, unit, events) {
    var statuses = unit.statuses || [];
    var kept = [];
    for (var i = 0; i < statuses.length; i++) {
      var st = statuses[i];
      if (st.unit !== "turnStart") {
        kept.push(st);
        continue;
      }
      st.remain -= 1;
      if (st.remain > 0) {
        kept.push(st);
        continue;
      }
      H.pushEvent(state, events, { type: "statusExpire", uid: unit.uid, kind: st.kind, label: st.label || "" });
    }
    unit.statuses = kept;

    var effects = unit.effects || [];
    var keptEffects = [];
    for (var e = 0; e < effects.length; e++) {
      var effect = effects[e];
      if (effect.when !== "turnStart") {
        keptEffects.push(effect);
        continue;
      }
      if (state.phase !== "finished" && B.state.canAct(unit)) {
        H.runOps(state, ctxOfEffect(effect), effect.ops, events);
      }
      if (effect.remain === B.state.PERMANENT) {
        keptEffects.push(effect);
        continue;
      }
      effect.remain -= 1;
      if (effect.remain > 0) {
        keptEffects.push(effect);
        continue;
      }
      H.pushEvent(state, events, { type: "effectExpire", uid: unit.uid, kind: "effect", label: effect.label || "" });
    }
    unit.effects = keptEffects;
  }

  function tickTurnList(list, state, unit, events, kind) {
    var kept = [];
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (!isDueForTurn(state, item, unit)) {
        kept.push(item);
        continue;
      }
      if (item.remain === B.state.PERMANENT) {
        kept.push(item);
        continue;
      }
      item.remain -= 1;
      if (item.remain > 0) {
        kept.push(item);
        continue;
      }
      if (item.onExpire && item.onExpire.length) {
        H.runOps(state, ctxOfEffect(item), item.onExpire, events);
      }
      H.pushEvent(state, events, { type: kind + "Expire", uid: unit.uid, kind: item.kind || item.stat || "", label: item.label || "" });
    }
    return kept;
  }

  function roundStart(state, events) {
    /* 回合开始结算的延迟效果（核蔼可氢复燃）：在标准回合开始、速度条之前跑 */
    for (var s = 0; s < state.units.length; s++) {
      var owner = state.units[s];
      var due = [];
      var later = [];
      for (var q = 0; q < owner.scheduled.length; q++) {
        var item = owner.scheduled[q];
        if (item.atPhase === "roundStart" && item.atRound <= state.round) due.push(item);
        else later.push(item);
      }
      owner.scheduled = later;
      for (var d = 0; d < due.length; d++) {
        if (state.phase === "finished") return events;
        H.runOps(state, ctxOfEffect(due[d]), due[d].ops, events);
      }
    }
    for (var i = 0; i < state.units.length; i++) {
      var unit = state.units[i];
      if (!B.state.isAlive(unit)) continue;
      stripImmuneBuffs(state, unit, events);
      if (B.skills && B.skills.runHooks) {
        B.skills.runHooks(state, unit, "roundStart", {
          sourceUid: unit.uid,
          targetUid: B.state.otherUid(state, unit.uid),
          skillId: "passive.roundStart",
          label: "标准回合开始"
        }, events);
      }
      if (state.phase === "finished") return events;
    }
    return events;
  }

  /* 免疫的 Buff 正常加不进来，这里每标准回合开始再兜底清一次 */
  function stripImmuneBuffs(state, unit, events) {
    var kinds = B.skills && B.skills.immuneBuffs ? B.skills.immuneBuffs(unit) : [];
    if (!kinds.length || !unit.buffs.length) return;
    var kept = [];
    for (var i = 0; i < unit.buffs.length; i++) {
      var buff = unit.buffs[i];
      if (kinds.indexOf(buff.kind) >= 0) {
        H.pushEvent(state, events, {
          type: "buffImmune",
          uid: unit.uid,
          kind: buff.kind,
          percent: buff.percent,
          label: buff.label || "",
          blocked: false
        });
      } else {
        kept.push(buff);
      }
    }
    unit.buffs = kept;
  }

  function roundEnd(state, events) {
    standardRoundEnd(state, events);
    if (state.phase !== "finished" && B.damage && B.damage.checkUndying) {
      B.damage.checkUndying(state, events);
    }
    if (state.phase !== "finished" && B.state.checkRewindPenalty) {
      B.state.checkRewindPenalty(state, events);
    }
  }

  /* op 全表：直接从注册表推导（排序后稳定），不手写清单；
     文档的 op 表与 tools/rpg6-lint.js 都读这里。新增 op 只需 registerOp。 */
  Object.defineProperty(api, "opNames", {
    get: function () { return Object.keys(OP_REGISTRY).sort(); }
  });

  api.runOps = runOps;
  H.runOps = runOps;;
  api.runOp = runOp;
  api.actionGate = function () { return H.actionGate.apply(null, arguments); };
  api.valueOf = function (state, ctx, expr) { return H.evalValue(state, ctx, expr); };
  api.statValue = function () { return H.statValue.apply(null, arguments); };
  api.roundStart = roundStart;
  api.roundEnd = roundEnd;
  api.turnEnd = turnEnd;
  api.skippedTurn = skippedTurn;
  api.turnStart = turnStart;
  api.ctxOfEffect = ctxOfEffect;

  if (typeof module === "object" && module.exports) module.exports = B;
})(typeof globalThis !== "undefined" ? globalThis : this);

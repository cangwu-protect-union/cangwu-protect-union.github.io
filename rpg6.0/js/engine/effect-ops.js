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
  H.STATUS_DEBUFF = { break: true, stun: true, noSkill: true, noBasic: true, cannotAct: true };

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
    return {
      sourceUid: effect.sourceUid,
      targetUid: effect.targetUid,
      skillId: effect.skillId,
      label: effect.label,
      fromBuff: effect.fromBuff
    };
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
      if (effect.breakOnSourceStatus && effect.sourceUid) {
        var src = H.tryUnit(state, effect.sourceUid);
        var broken = false;
        if (src) {
          for (var j = 0; j < effect.breakOnSourceStatus.length; j++) {
            if (B.state.hasStatus(src, effect.breakOnSourceStatus[j])) {
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

  function standardRoundEnd(state, events) {
    for (var i = 0; i < state.units.length; i++) {
      var unit = state.units[i];
      dropBrokenEffects(state, unit, events);
      var active = unit.effects.slice();
      for (var e = 0; e < active.length; e++) {
        if (state.phase === "finished") break;
        if (!effectDue(active[e], state)) continue;
        H.runOps(state, ctxOfEffect(active[e]), active[e].ops, events);
      }
      var due = [];
      var later = [];
      for (var s = 0; s < unit.scheduled.length; s++) {
        if (unit.scheduled[s].atRound <= state.round) due.push(unit.scheduled[s]);
        else later.push(unit.scheduled[s]);
      }
      unit.scheduled = later;
      for (var d = 0; d < due.length; d++) {
        if (state.phase === "finished") break;
        H.runOps(state, ctxOfEffect(due[d]), due[d].ops, events);
      }
    }
    if (B.summons && B.summons.tick) B.summons.tick(state, events);
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
        if (!isDueForTurn(active[i], unit)) continue;
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

  function isDueForTurn(item, unit) {
    if (item.unit === "selfRound") return item.sourceUid === unit.uid;
    if (item.unit === "targetRound") return item.targetUid === unit.uid;
    return false;
  }

  function tickTurnList(list, state, unit, events, kind) {
    var kept = [];
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (!isDueForTurn(item, unit)) {
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
      H.pushEvent(state, events, { type: kind + "Expire", uid: unit.uid, kind: item.kind || item.stat || "", label: item.label || "" });
    }
    return kept;
  }

  function roundStart(state, events) {
    for (var i = 0; i < state.units.length; i++) {
      var unit = state.units[i];
      if (unit.hp <= 0) continue;
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
  }

  /* op 全表：直接从注册表推导（排序后稳定），不手写清单；
     文档的 op 表与 _local/tools/rpg6-lint.js 都读这里。新增 op 只需 registerOp。 */
  Object.defineProperty(api, "opNames", {
    get: function () { return Object.keys(OP_REGISTRY).sort(); }
  });

  api.runOps = runOps;
  H.runOps = runOps;;
  api.runOp = runOp;
  api.actionGate = function () { return H.actionGate.apply(null, arguments); };
  api.valueOf = valueOf;
  api.statValue = function () { return H.statValue.apply(null, arguments); };
  api.roundStart = roundStart;
  api.roundEnd = roundEnd;
  api.turnEnd = turnEnd;
  api.ctxOfEffect = ctxOfEffect;

  if (typeof module === "object" && module.exports) module.exports = B;
})(typeof globalThis !== "undefined" ? globalThis : this);

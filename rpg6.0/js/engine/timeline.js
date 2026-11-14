/* 回合制正传 6.0 · 战斗引擎 · 时间轴
   标准回合、速度条、行动队列、角色回合进出。持续效果的逐回合结算由 M2 挂在这里的钩子上。 */
(function (root) {
  "use strict";
  var B = root.RPG6B || (root.RPG6B = {});
  var api = B.timeline = B.timeline || {};

  function pushEvent(events, event) {
    if (events) events.push(event);
    return event;
  }

  function alive(state) {
    for (var i = 0; i < state.units.length; i++) {
      if (state.units[i].hp > 0) return true;
    }
    return false;
  }

  function startRound(state, events) {
    state.round += 1;
    pushEvent(events, { type: "roundStart", round: state.round });

    if (B.effectOps && B.effectOps.roundStart) {
      B.effectOps.roundStart(state, events);
    }

    for (var i = 0; i < state.units.length; i++) {
      var unit = state.units[i];
      unit.roundActions = 0;
      if (unit.hp <= 0) continue;
      var step = B.rules.gaugeStep(unit.gauge, B.state.spdOf(unit), state.firstRound);
      unit.gauge = step.gauge;
      unit.roundActions = step.actions;
      pushEvent(events, {
        type: "gauge",
        round: state.round,
        uid: unit.uid,
        gauge: unit.gauge,
        actions: step.actions
      });
    }

    state.firstRound = false;
    state.queue = buildQueue(state);
    pushEvent(events, { type: "queue", round: state.round, queue: state.queue.slice() });
    return state.queue;
  }

  function buildQueue(state) {
    var entries = [];
    for (var i = 0; i < state.units.length; i++) {
      var unit = state.units[i];
      if (unit.hp <= 0) continue;
      if (!unit.roundActions) continue;
      entries.push({
        uid: unit.uid,
        acts: unit.roundActions,
        spd: B.state.spdOf(unit),
        idx: state.order.indexOf(unit.uid)
      });
    }
    entries.sort(function (x, y) {
      if (x.spd !== y.spd) return x.spd - y.spd;
      return x.idx - y.idx;
    });
    var maxActs = 0;
    for (var e = 0; e < entries.length; e++) maxActs = Math.max(maxActs, entries[e].acts);
    var queue = [];
    for (var round = 0; round < maxActs; round++) {
      for (var k = 0; k < entries.length; k++) {
        if (round < entries[k].acts) queue.push(entries[k].uid);
      }
    }
    return queue;
  }

  function beginTurn(state, events) {
    var guard = 0;
    for (;;) {
      guard += 1;
      if (guard > 500) throw new Error("回合推进死循环");
      if (state.phase === "finished") return false;
      if (state.queue.length) {
        var uid = state.queue.shift();
        var unit = B.state.unitOf(state, uid);
        if (unit.hp <= 0) continue;
        if (!B.state.canAct(unit)) {
          pushEvent(events, { type: "turnSkip", round: state.round, uid: uid });
          continue;
        }
        unit.actionsLeft = B.traits.actionsPerTurn(unit);
        unit.flags.chargedThisTurn = false;
        unit.stats.turns += 1;
        if (unit.trait && unit.trait.mpPerTurn) {
          var before = unit.mp;
          unit.mp = Math.min(B.state.maxMpOf(unit), unit.mp + unit.trait.mpPerTurn);
          if (unit.mp !== before) {
            pushEvent(events, { type: "mp", round: state.round, uid: uid, delta: unit.mp - before, mp: unit.mp, reason: "trait" });
          }
        }
        state.turnUid = uid;
        pushEvent(events, { type: "turnStart", round: state.round, uid: uid, actions: unit.actionsLeft });
        return true;
      }
      if (state.round > 0 && B.effectOps && B.effectOps.roundEnd) {
        B.effectOps.roundEnd(state, events);
        if (state.phase === "finished") return false;
      }
      startRound(state, events);
    }
  }

  function endTurn(state, events) {
    if (!state.turnUid) return;
    var unit = B.state.unitOf(state, state.turnUid);
    if (B.effectOps && B.effectOps.turnEnd) {
      B.effectOps.turnEnd(state, unit, events);
    }
    if (unit.charge && !unit.flags.chargedThisTurn) {
      B.damage.clearCharge(state, unit, "turnEnd", events);
    }
    unit.actionsLeft = 0;
    pushEvent(events, { type: "turnEnd", round: state.round, uid: unit.uid });
    state.turnUid = null;
  }

  api.startRound = startRound;
  api.buildQueue = buildQueue;
  api.beginTurn = beginTurn;
  api.endTurn = endTurn;
  api.alive = alive;

  if (typeof module === "object" && module.exports) module.exports = B;
})(typeof globalThis !== "undefined" ? globalThis : this);

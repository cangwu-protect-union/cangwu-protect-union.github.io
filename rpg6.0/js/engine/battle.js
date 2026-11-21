/* 回合制正传 6.0 · 战斗引擎 · 门面
   外部只认这几个函数：create / apply / available / hash / replay。 */
(function (root) {
  "use strict";
  var B = root.RPG6B || (root.RPG6B = {});
  var api = B.battle = B.battle || {};

  function appendLog(state, events) {
    for (var i = 0; i < events.length; i++) {
      events[i].seq = state.log.length + 1;
      state.log.push(events[i]);
    }
  }

  function create(opts) {
    var state = B.state.createBattle(opts);
    var events = [];
    B.skills.runBattleStart(state, events);
    B.timeline.beginTurn(state, events);
    appendLog(state, events);
    return { state: state, events: events };
  }

  function apply(state, action) {
    var next = B.state.clone(state);
    var events = [];
    if (next.phase === "finished") throw new Error("对局已结束");
    if (!next.turnUid) B.timeline.beginTurn(next, events);
    var committed = B.actions.execute(next, action, events);
    var unit = next.turnUid ? B.state.unitOf(next, next.turnUid) : null;
    /* 解锁属性/额外动作（吃苹果、功德回血）不消耗行动 */
    if (unit && action.kind !== "unlock" && action.kind !== "item") unit.actionsLeft -= 1;
    if (next.phase !== "finished" && unit && unit.actionsLeft <= 0) {
      B.timeline.endTurn(next, events);
      B.timeline.beginTurn(next, events);
    }
    appendLog(next, events);
    return { state: next, events: events, committed: committed };
  }

  function available(state) {
    return B.actions.list(state);
  }

  function hash(state) {
    return B.state.hash(state);
  }

  function replay(init, actions) {
    var state = B.state.clone(init);
    var hashes = [B.state.hash(state)];
    for (var i = 0; i < actions.length; i++) {
      var result = apply(state, actions[i]);
      state = result.state;
      hashes.push(B.state.hash(state));
    }
    return { state: state, hashes: hashes };
  }

  api.create = create;
  api.apply = apply;
  api.available = available;
  api.hash = hash;
  api.replay = replay;

  if (typeof module === "object" && module.exports) module.exports = B;
})(typeof globalThis !== "undefined" ? globalThis : this);

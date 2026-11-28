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
    var rewound = false;
    if (next.pendingRewind) {
      var pending = next.pendingRewind;
      next.pendingRewind = null;
      rewound = B.state.applyRewind(next, pending.uid);
      if (rewound) {
        if (pending.mode === "death") {
          var restored = B.state.unitOf(next, pending.uid);
          if (restored && restored.rewind) restored.rewind.count += 1;
        }
        events = [{ type: "rewind", round: next.round, uid: pending.uid, mode: pending.mode, label: "反方向的钟" }];
      }
    }
    var unit = next.turnUid ? B.state.unitOf(next, next.turnUid) : null;
    /* 解锁属性/额外动作（吃苹果、功德回血）不消耗行动；noAction 技能同样不消耗 */
    var noAction = false;
    if (!rewound && unit && action.kind === "skill" && B.skills && B.skills.find) {
      var usedSkill = B.skills.find(action.skillId);
      noAction = !!(usedSkill && usedSkill.noAction);
    }
    if (!rewound && unit && action.kind !== "unlock" && action.kind !== "item" && !noAction) unit.actionsLeft -= 1;
    if (!rewound && next.phase !== "finished" && unit && unit.actionsLeft <= 0) {
      B.timeline.endTurn(next, events);
      B.timeline.beginTurn(next, events);
    }
    appendLog(next, events);
    return { state: next, events: events, committed: committed, rewound: rewound };
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

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

  function validResponseChoice(pend, choice) {
    if (!pend) return false;
    if (pend.kind === "answer") {
      var options = (pend.options || []).map(String);
      return options.indexOf(String(choice)) >= 0;
    }
    if (pend.kind === "guess") {
      var n = Number(choice);
      var sides = Number(pend.payload && pend.payload.sides) || 6;
      return isFinite(n) && Math.floor(n) === n && n >= 0 && n <= sides;
    }
    if (pend.kind === "dodge") {
      var keys = (pend.options || []).map(function (opt) { return String(opt.key); });
      return keys.indexOf(String(choice)) >= 0;
    }
    return false;
  }

  function normalizeChoice(pend, choice) {
    return pend.kind === "guess" ? Number(choice) : String(choice);
  }

  function apply(state, action) {
    var next = B.state.clone(state);
    var events = [];
    if (next.phase === "finished") throw new Error("对局已结束");
    if (!next.responses) next.responses = {};
    if (next.responseSeq == null) next.responseSeq = 0;
    /* ask 序号每个事务从 0 开始：挂起后重放也从同一输入 state 重新数，响应 key 才能对上 */
    next.askSeq = 0;
    /* hitSeq 不重置：它是整局递增的段号，投喂持续/召唤/反弹伤害时 key 才不会和旧响应撞车 */
    if (action && action.kind === "respond" && !next.pendingResponse) throw new Error("现在没有需要提交的选择");
    var originalAction = action;
    var respondCommitted = null;
    try {
      if (next.pendingResponse) {
        if (!action || action.kind !== "respond") throw new Error("等待对方选择");
        var pend = next.pendingResponse;
        if (action.id !== pend.id) throw new Error("这个选择已经过期");
        if (action.uid !== pend.responderUid) throw new Error("这个选择不该由你提交");
        if (!validResponseChoice(pend, action.choice)) throw new Error("选择不合法");
        var choice = normalizeChoice(pend, action.choice);
        next.responses[pend.key] = choice;
        next.pendingResponse = null;
        respondCommitted = { kind: "respond", id: pend.id, uid: action.uid, choice: choice };
        /* 响应本身不推进时间线；resumeAction 为空时只继续当前回合 */
        if (!pend.resumeAction) {
          originalAction = null;
          if (!next.turnUid) B.timeline.beginTurn(next, events);
          appendLog(next, events);
          return { state: next, events: events, committed: respondCommitted };
        }
        /* 重放式恢复：回到输入 state，用同一个原动作重新执行 */
        originalAction = pend.resumeAction;
        action = originalAction;
      }
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
      /* 解锁属性/额外动作（吃苹果、功德回血）不消耗行动；noAction 技能同样不消耗。
         开关技的关闭分支只在 committed 上带 noAction，所以两处都要看。 */
      var noAction = false;
      if (!rewound && unit && action.kind === "skill" && B.skills && B.skills.find) {
        var usedSkill = B.skills.find(action.skillId);
        noAction = !!(usedSkill && usedSkill.noAction) || !!(committed && committed.noAction);
      }
      if (!rewound && unit && action.kind !== "unlock" && action.kind !== "item" && !noAction) unit.actionsLeft -= 1;
      if (!rewound && next.phase !== "finished" && unit && unit.actionsLeft <= 0) {
        B.timeline.endTurn(next, events);
        B.timeline.beginTurn(next, events);
      }
      appendLog(next, events);
      return { state: next, events: events, committed: respondCommitted || committed, rewound: rewound };
    } catch (err) {
      if (!err || !err.pending) throw err;
      /* 挂起：返回输入 state 的干净克隆，只加 pendingResponse；已提交的响应要保留 */
      var fresh = B.state.clone(state);
      fresh.responses = next.responses;
      fresh.responseSeq = next.responseSeq;
      fresh.askSeq = 0;
      var p = err.pending;
      fresh.responseSeq = (fresh.responseSeq || 0) + 1;
      p.id = "resp" + fresh.responseSeq;
      p.resumeAction = originalAction;
      fresh.pendingResponse = p;
      return { state: fresh, events: [], committed: respondCommitted || originalAction, pending: true };
    }
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

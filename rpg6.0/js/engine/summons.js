/* 回合制正传 6.0 · 战斗引擎 · 召唤物
   召唤物是独立战斗单位：有自己的血量、状态、计时，不进速度条与行动队列。
   定义在 data/battle-skills.js 的 summons 块；这里只负责创建、移除与标准回合末的脚本。 */
(function (root) {
  "use strict";
  var B = root.RPG6B || (root.RPG6B = {});
  var api = B.summons = B.summons || {};

  var MAX_PER_SIDE = 6;

  function pushEvent(state, events, event) {
    event.round = state.round;
    if (events) events.push(event);
    return event;
  }

  function defOf(key) {
    return B.skills && B.skills.summonDef ? B.skills.summonDef(key) : null;
  }

  function statNum(value) {
    var n = Number(value);
    return isFinite(n) ? n : 0;
  }

  function alive(unit) {
    return !!unit && (unit.targetable ? unit.hp > 0 : true);
  }

  function create(state, key, owner, events, opts) {
    var def = defOf(key);
    if (!def) throw new Error("召唤物定义不存在：" + key);
    var side = owner.side || B.state.sideOf(state, owner.uid);
    var liveCount = (state.summons || []).filter(function (s) { return s.side === side; }).length;
    if (liveCount >= MAX_PER_SIDE) {
      pushEvent(state, events, { type: "summonBlocked", uid: owner.uid, name: def.name || key, key: key });
      return null;
    }
    var stats = def.stats || {};
    var base = {
      atk: statNum(stats.atk),
      def: statNum(stats.def),
      mres: statNum(stats.mres),
      maxHp: Math.max(0, statNum(stats.hp)),
      maxMp: Math.max(0, statNum(stats.mp)),
      spd: Math.max(0, statNum(stats.spd))
    };
    state.summonSeq = (state.summonSeq || 0) + 1;
    var uid = side + "-s" + state.summonSeq;
    var ttl = opts && opts.ttl != null ? Number(opts.ttl) : (def.ttl == null ? null : Number(def.ttl));
    var unit = {
      uid: uid,
      side: side,
      ownerUid: owner.uid,
      summonKey: key,
      isSummon: true,
      name: def.name || key,
      gender: "",
      job: "",
      subJob: "",
      base: base,
      hp: base.maxHp,
      mp: 0,
      gauge: 0,
      actionsLeft: 0,
      charge: null,
      cooldowns: {},
      breakValue: 0,
      stunValue: 0,
      statuses: [],
      buffs: [],
      mods: [],
      scheduled: [],
      effects: [],
      taunt: statNum(def.taunt),
      trait: null,
      flags: {},
      stats: { hitsDealt: 0, hitsTaken: 0, casts: 0, turns: 0 },
      hpLog: [],
      hpLost: 0,
      lastDamageType: "",
      marks: {},
      skills: [],
      ttl: ttl == null || ttl <= 0 ? null : { unit: "standard", remain: ttl },
      targetable: def.targetable !== false && base.maxHp > 0,
      breakImmune: !!def.breakImmune
    };
    state.summons.push(unit);
    pushEvent(state, events, {
      type: "summon",
      uid: unit.uid,
      side: side,
      ownerUid: owner.uid,
      key: key,
      name: unit.name,
      hp: unit.hp,
      maxHp: base.maxHp,
      targetable: unit.targetable,
      remain: unit.ttl ? unit.ttl.remain : null
    });
    return unit;
  }

  function remove(state, uid, reason, events) {
    var list = state.summons || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].uid !== uid) continue;
      var unit = list.splice(i, 1)[0];
      pushEvent(state, events, {
        type: "summonExpire",
        uid: uid,
        name: unit.name,
        key: unit.summonKey,
        reason: reason || "expire"
      });
      return unit;
    }
    return null;
  }

  function clearSide(state, side, reason, events) {
    var list = (state.summons || []).filter(function (s) { return s.side === side; });
    for (var i = 0; i < list.length; i++) remove(state, list[i].uid, reason || "ownerDeath", events);
  }

  function ofSide(state, side) {
    return (state.summons || []).filter(function (s) { return s.side === side && alive(s); });
  }

  function countKey(state, side, key) {
    var list = ofSide(state, side);
    return list.filter(function (s) { return s.summonKey === key; }).length;
  }

  function findKey(state, side, key) {
    var list = ofSide(state, side);
    for (var i = 0; i < list.length; i++) {
      if (list[i].summonKey === key) return list[i];
    }
    return null;
  }

  function runScript(state, unit, ops, events) {
    if (!ops || !ops.length) return;
    var enemy = B.state.heroOf(state, B.state.otherSide(state, unit.side));
    B.effectOps.runOps(state, {
      sourceUid: unit.uid,
      targetUid: enemy ? enemy.uid : "",
      skillId: "summon." + unit.summonKey,
      label: unit.name
    }, ops, events);
  }

  /* 标准回合末：先光环/自动攻击，再到期自爆/收尾，最后扣计时。 */
  function tick(state, events) {
    var list = (state.summons || []).slice();
    for (var i = 0; i < list.length; i++) {
      if (state.phase === "finished") return;
      var unit = null;
      for (var j = 0; j < state.summons.length; j++) {
        if (state.summons[j].uid === list[i].uid) unit = state.summons[j];
      }
      if (!unit || !alive(unit)) continue;
      var def = defOf(unit.summonKey);
      if (!def) continue;
      if (def.aura) runScript(state, unit, def.aura, events);
      if (state.phase === "finished") return;
      if (def.attack && B.state.canAct(unit)) runScript(state, unit, def.attack, events);
      if (state.phase === "finished") return;
      if (unit.ttl) {
        if (unit.ttl.remain <= 1) {
          if (def.onExpire) runScript(state, unit, def.onExpire, events);
          if (state.phase === "finished") return;
          remove(state, unit.uid, "expire", events);
          continue;
        }
        unit.ttl.remain -= 1;
      }
    }
  }

  api.MAX_PER_SIDE = MAX_PER_SIDE;
  api.create = create;
  api.remove = remove;
  api.clearSide = clearSide;
  api.ofSide = ofSide;
  api.countKey = countKey;
  api.findKey = findKey;
  api.tick = tick;

  if (typeof module === "object" && module.exports) module.exports = B;
})(typeof globalThis !== "undefined" ? globalThis : this);

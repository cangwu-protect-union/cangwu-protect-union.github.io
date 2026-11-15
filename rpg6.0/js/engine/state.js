/* 回合制正传 6.0 · 战斗引擎 · 状态
   单位构造、面板结算、深拷贝、状态指纹。所有函数不修改入参，除了明确写 create 的。 */
(function (root) {
  "use strict";
  var B = root.RPG6B || (root.RPG6B = {});
  var api = B.state = B.state || {};

  var PERMANENT = -1;

  function parseStat(value, label) {
    if (typeof value === "number" && isFinite(value)) return value;
    var raw = String(value == null ? "" : value).trim();
    if (!/^-?\d+(\.\d+)?$/.test(raw)) {
      throw new Error("面板「" + label + "」不是数字：" + raw);
    }
    return parseFloat(raw);
  }

  function makeUnit(character, uid) {
    if (!character) throw new Error("缺少角色：" + uid);
    var base = {
      atk: parseStat(character.atk, "攻击"),
      def: parseStat(character.def, "防御"),
      mres: parseStat(character.mres, "法抗"),
      maxHp: parseStat(character.hp, "血量上限"),
      maxMp: parseStat(character.mp, "蓝上限"),
      spd: parseStat(character.spd, "速度")
    };
    var unit = {
      uid: uid,
      charId: character.id || "",
      name: character.name || uid,
      gender: character.gender || "",
      job: character.occupation || "",
      subJob: character.side_job || "",
      charging: null,
      base: base,
      hp: base.maxHp,
      mp: 0,
      gauge: 100,
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
      taunt: 0,
      trait: null,
      flags: {},
      stats: { hitsDealt: 0, hitsTaken: 0, casts: 0, turns: 0 },
      hpLog: [],
      hpLost: 0,
      side: "",
      lastDamageType: "",
      marks: {},
      skills: []
    };
    B.traits.applyToUnit(unit);
    if (B.skills && B.skills.initUnit) B.skills.initUnit(unit);
    unit.mp = B.rules.clamp(unit.trait.openMp || 0, 0, base.maxMp);
    return unit;
  }

  function unitOf(state, uid) {
    for (var i = 0; i < state.units.length; i++) {
      if (state.units[i].uid === uid) return state.units[i];
    }
    var summons = state.summons || [];
    for (var j = 0; j < summons.length; j++) {
      if (summons[j].uid === uid) return summons[j];
    }
    throw new Error("找不到单位：" + uid);
  }

  function otherUid(state, uid) {
    return state.units[0].uid === uid ? state.units[1].uid : state.units[0].uid;
  }

  function sideOf(state, uid) {
    for (var i = 0; i < state.units.length; i++) {
      if (state.units[i].uid === uid) return state.units[i].side;
    }
    var summons = state.summons || [];
    for (var j = 0; j < summons.length; j++) {
      if (summons[j].uid === uid) return summons[j].side;
    }
    throw new Error("找不到单位：" + uid);
  }

  function otherSide(state, side) {
    return side === "a" ? "b" : "a";
  }

  function heroOf(state, side) {
    for (var i = 0; i < state.units.length; i++) {
      if (state.units[i].side === side) return state.units[i];
    }
    return state.units[side === "a" ? 0 : 1];
  }

  function summonsOf(state, side) {
    var out = [];
    var list = state.summons || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].side === side && list[i].hp > 0) out.push(list[i]);
    }
    return out;
  }

  function combatantsOf(state, side) {
    var out = [];
    var hero = heroOf(state, side);
    if (hero && hero.hp > 0) out.push(hero);
    return out.concat(summonsOf(state, side));
  }

  function markHpLoss(unit, beforeHp) {
    var lost = Math.max(0, Number(beforeHp) || 0) - Math.max(0, unit.hp);
    if (lost > 0) unit.hpLost = (unit.hpLost || 0) + lost;
    return lost;
  }

  function clampHpToMax(unit) {
    var before = unit.hp;
    unit.hp = Math.min(unit.hp, maxHpOf(unit));
    return markHpLoss(unit, before);
  }

  function modValue(unit, stat) {
    var sets = [];
    var adds = 0;
    var mul = 1;
    var list = unit.mods || [];
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.stat !== stat) continue;
      if (m.mode === "set") sets.push(m);
      else if (m.mode === "add") adds += Number(m.value) || 0;
      else if (m.mode === "mul") mul *= Number(m.value);
    }
    return { sets: sets, adds: adds, mul: mul };
  }

  function statOf(unit, stat) {
    var base = unit.base[stat];
    if (stat === "maxMp") base = unit.base.maxMp;
    var m = modValue(unit, stat);
    var value = base;
    if (m.sets.length) value = Number(m.sets[m.sets.length - 1].value);
    value = value + m.adds;
    value = value * m.mul;
    if (unit.trait && unit.trait.lowHpBoost && (stat === "atk" || stat === "def" || stat === "spd")) {
      if (unit.hp * 2 < maxHpOf(unit)) value = Math.floor(value * 1.5);
    }
    /* 面板数值统一向下取 5 的倍数；蓝上限例外，只向下取整到个位 */
    value = stat === "maxMp" ? Math.floor(value) : B.rules.panelRound(value);
    var floor = B.rules.CONFIG.statFloor[stat];
    if (floor != null && stat !== "mres") value = Math.max(floor, value);
    return value;
  }

  function maxHpOf(unit) {
    return Math.max(1, statOf(unit, "maxHp"));
  }

  function maxMpOf(unit) {
    return Math.max(0, statOf(unit, "maxMp"));
  }

  function defOf(unit) {
    if (hasStatus(unit, "stun")) return 0;
    return statOf(unit, "def");
  }

  function mresOf(unit) {
    if (hasStatus(unit, "stun")) return 0;
    return statOf(unit, "mres");
  }

  function spdOf(unit) {
    return Math.max(0, statOf(unit, "spd"));
  }

  function hasStatus(unit, kind) {
    var list = unit.statuses || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].kind === kind) return true;
    }
    return false;
  }

  function markOf(unit, key) {
    var mark = unit.marks && unit.marks[key];
    return mark ? mark.value : 0;
  }

  function markName(unit, key) {
    var mark = unit.marks && unit.marks[key];
    return mark ? mark.name : key;
  }

  function canAct(unit) {
    return !hasStatus(unit, "break") && !hasStatus(unit, "stun") && !hasStatus(unit, "cannotAct");
  }

  function addMod(unit, mod) {
    var entry = {
      stat: mod.stat,
      mode: mod.mode || "add",
      value: Number(mod.value) || 0,
      remain: mod.remain == null ? PERMANENT : mod.remain,
      unit: mod.unit || "standard",
      source: mod.source || "",
      label: mod.label || ""
    };
    unit.mods.push(entry);
    return entry;
  }

  function removeModsBySource(unit, source, stats) {
    var kept = [];
    var filter = Array.isArray(stats) && stats.length ? stats : null;
    for (var i = 0; i < unit.mods.length; i++) {
      var mod = unit.mods[i];
      if (mod.source === source && (!filter || filter.indexOf(mod.stat) >= 0)) continue;
      kept.push(mod);
    }
    unit.mods = kept;
  }

  function addBuff(unit, buff) {
    var entry = {
      kind: buff.kind,
      percent: Number(buff.percent) || 0,
      remain: buff.remain == null ? 0 : buff.remain,
      unit: buff.unit || "standard",
      source: buff.source || "",
      label: buff.label || "",
      stacking: buff.stacking !== false
    };
    if (!entry.stacking) {
      for (var i = 0; i < unit.buffs.length; i++) {
        if (unit.buffs[i].kind === entry.kind && unit.buffs[i].source === entry.source) {
          unit.buffs[i].remain = Math.max(unit.buffs[i].remain, entry.remain);
          unit.buffs[i].percent = Math.max(unit.buffs[i].percent, entry.percent);
          return unit.buffs[i];
        }
      }
    }
    unit.buffs.push(entry);
    return entry;
  }

  function addStatus(unit, status) {
    var entry = {
      kind: status.kind,
      remain: status.remain == null ? 0 : status.remain,
      unit: status.unit || "standard",
      source: status.source || "",
      skillId: status.skillId || "",
      label: status.label || ""
    };
    for (var i = 0; i < unit.statuses.length; i++) {
      if (unit.statuses[i].kind === entry.kind &&
          (unit.statuses[i].skillId || "") === entry.skillId) {
        unit.statuses[i].remain = Math.max(unit.statuses[i].remain, entry.remain);
        return unit.statuses[i];
      }
    }
    unit.statuses.push(entry);
    return entry;
  }

  /* 进入击溃：击溃值固定为 0，击溃状态期间也不会再增加 */
  function enterBreak(unit, remain, source, label) {
    if (unit.breakImmune) {
      return { kind: "break", remain: 0, unit: "standard", source: source || "", skillId: "", label: (label || "击溃") + "（免疫）" };
    }
    unit.breakValue = 0;
    return addStatus(unit, {
      kind: "break",
      remain: remain,
      source: source || "",
      label: label || "击溃"
    });
  }

  function addHpLog(unit, round, delta) {
    if (!delta) return;
    unit.hpLog.push({ round: round, delta: delta });
  }

  function decideOrder(state) {
    var a = state.units[0];
    var b = state.units[1];
    var order = [a.uid, b.uid];
    if (spdOf(a) === spdOf(b)) {
      state.rng = B.rng.step(state.rng);
      if ((state.rng & 1) === 1) order = [b.uid, a.uid];
    }
    state.order = order;
    return order;
  }

  function createBattle(opts) {
    var rawSeed = 0;
    if (opts && opts.seed != null) {
      rawSeed = Math.floor(Math.abs(Number(opts.seed)));
      if (!isFinite(rawSeed)) rawSeed = 0;
    }
    var state = {
      version: (opts && opts.version) ||
        (root.RPG_APP && root.RPG_APP.engineVersion) ||
        "6.0-engine.3",
      seed: rawSeed,
      rng: B.rng.init(rawSeed),
      round: 0,
      phase: "fight",
      result: "",
      order: [],
      firstRound: true,
      queue: [],
      turnUid: null,
      units: [makeUnit(opts.a, "a"), makeUnit(opts.b, "b")],
      summons: [],
      summonSeq: 0,
      log: []
    };
    state.units[0].side = "a";
    state.units[1].side = "b";
    decideOrder(state);
    return state;
  }

  function clone(state) {
    return JSON.parse(JSON.stringify(state));
  }

  function finish(state, winner) {
    if (state.phase === "finished") return;
    state.phase = "finished";
    state.result = winner || "draw";
    state.turnUid = null;
    state.queue = [];
  }

  function fnv1a(text) {
    var h = 0x811c9dc5;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return ("0000000" + h.toString(16)).slice(-8);
  }

  function hash(state) {
    var parts = [state.round, state.phase, state.rng, state.turnUid, state.queue.join(",")];
    for (var i = 0; i < state.units.length; i++) {
      var u = state.units[i];
      var buffs = [];
      for (var b = 0; b < u.buffs.length; b++) buffs.push(u.buffs[b].kind + u.buffs[b].percent + u.buffs[b].remain);
      var mods = [];
      for (var m = 0; m < u.mods.length; m++) mods.push(u.mods[m].stat + u.mods[m].mode + u.mods[m].value + u.mods[m].remain);
      var st = [];
      for (var s = 0; s < u.statuses.length; s++) st.push(u.statuses[s].kind + u.statuses[s].remain);
      var eff = [];
      for (var e = 0; e < u.effects.length; e++) eff.push(u.effects[e].id + u.effects[e].remain);
      var marks = [];
      var markKeys = Object.keys(u.marks || {});
      for (var mk = 0; mk < markKeys.length; mk++) marks.push(markKeys[mk] + u.marks[markKeys[mk]].value);
      parts.push([
        u.uid, u.hp, u.mp, u.gauge, u.actionsLeft, u.breakValue, u.stunValue,
        u.charge ? u.charge.skillId + ":" + u.charge.amount : "-",
        buffs.join(","), mods.join(","), st.join(","), eff.join(","),
        u.scheduled.length, u.lastDamageType, marks.join(","), u.hpLost || 0
      ].join("|"));
    }
    var summonParts = [];
    var summons = state.summons || [];
    for (var si = 0; si < summons.length; si++) {
      var su = summons[si];
      var sb = [];
      for (var sb1 = 0; sb1 < su.buffs.length; sb1++) sb.push(su.buffs[sb1].kind + su.buffs[sb1].percent + su.buffs[sb1].remain);
      var sm = [];
      for (var sm1 = 0; sm1 < su.mods.length; sm1++) sm.push(su.mods[sm1].stat + su.mods[sm1].mode + su.mods[sm1].value + su.mods[sm1].remain);
      var ss = [];
      for (var ss1 = 0; ss1 < su.statuses.length; ss1++) ss.push(su.statuses[ss1].kind + su.statuses[ss1].remain);
      var se = [];
      for (var se1 = 0; se1 < su.effects.length; se1++) se.push(su.effects[se1].id + su.effects[se1].remain);
      var smark = [];
      var smKeys = Object.keys(su.marks || {});
      for (var smk = 0; smk < smKeys.length; smk++) smark.push(smKeys[smk] + su.marks[smKeys[smk]].value);
      summonParts.push([
        su.uid, su.side, su.summonKey, su.hp, su.breakValue, su.stunValue,
        su.ttl ? su.ttl.remain : "-",
        sb.join(","), sm.join(","), ss.join(","), se.join(","), smark.join(","), su.hpLost || 0
      ].join("|"));
    }
    parts.push("S:" + summonParts.join(";"));
    return fnv1a(parts.join(";"));
  }

  api.PERMANENT = PERMANENT;
  api.parseStat = parseStat;
  api.makeUnit = makeUnit;
  api.unitOf = unitOf;
  api.otherUid = otherUid;
  api.sideOf = sideOf;
  api.otherSide = otherSide;
  api.heroOf = heroOf;
  api.summonsOf = summonsOf;
  api.combatantsOf = combatantsOf;
  api.markHpLoss = markHpLoss;
  api.clampHpToMax = clampHpToMax;
  api.statOf = statOf;
  api.maxHpOf = maxHpOf;
  api.maxMpOf = maxMpOf;
  api.defOf = defOf;
  api.mresOf = mresOf;
  api.spdOf = spdOf;
  api.hasStatus = hasStatus;
  api.markOf = markOf;
  api.markName = markName;
  api.canAct = canAct;
  api.addMod = addMod;
  api.removeModsBySource = removeModsBySource;
  api.addBuff = addBuff;
  api.addStatus = addStatus;
  api.enterBreak = enterBreak;
  api.addHpLog = addHpLog;
  api.decideOrder = decideOrder;
  api.createBattle = createBattle;
  api.clone = clone;
  api.finish = finish;
  api.hash = hash;

  if (typeof module === "object" && module.exports) module.exports = B;
})(typeof globalThis !== "undefined" ? globalThis : this);

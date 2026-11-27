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
    /* 面板覆盖：技能库里 panels[角色] 覆盖档案面板（孙嘉怿的攻击格是注记，不是数字） */
    var panel = B.skills && B.skills.panelOf ? B.skills.panelOf(character.name) : null;
    function statOf(key) {
      return panel && panel[key] != null ? panel[key] : character[key === "maxHp" ? "hp" : (key === "maxMp" ? "mp" : key)];
    }
    var base = {
      atk: parseStat(statOf("atk"), "攻击"),
      def: parseStat(statOf("def"), "防御"),
      mres: parseStat(statOf("mres"), "法抗"),
      maxHp: parseStat(statOf("maxHp"), "血量上限"),
      maxMp: parseStat(statOf("maxMp"), "蓝上限"),
      spd: parseStat(statOf("spd"), "速度")
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
      shield: null,
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
    if (m.sets.length) {
      var set = m.sets[m.sets.length - 1];
      /* set 模式的归零/覆盖可以带 progress（逐标准回合恢复原值的进度） */
      value = Number(set.value) + (Number(set.progress) || 0);
    }
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
    if (dazeActive(unit)) return 0;
    return statOf(unit, "def");
  }

  function mresOf(unit) {
    if (dazeActive(unit)) return 0;
    return statOf(unit, "mres");
  }

  /* 眩晕与「眩晕余波」（daze）都让防御、法抗视为 0；daze 不阻止行动，
     用来把「1 个敌方回合」的防抗归零窗口延长到下一次行动开始之前。 */
  function dazeActive(unit) {
    return hasStatus(unit, "stun") || hasStatus(unit, "daze");
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

  /* 防护层：挂在持续效果上的 guard / immune / breakImmune / chargeGuard 声明。
     顾文达「下潜」、倪曼云「越共探头」、顾文达「硕哥过肩摔」共用。 */
  function guardEffectOf(unit) {
    var list = unit && unit.effects ? unit.effects : [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].guard && (list[i].guard.remaining == null || list[i].guard.remaining > 0)) return list[i];
    }
    return null;
  }

  function effectHasFlag(unit, flag) {
    var list = unit && unit.effects ? unit.effects : [];
    for (var i = 0; i < list.length; i++) {
      if (list[i][flag]) return true;
    }
    return false;
  }

  function hasEffectKey(unit, key) {
    var list = unit && unit.effects ? unit.effects : [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].key === key) return true;
    }
    return false;
  }

  function immuneToBuff(unit, kind) {
    var list = unit && unit.effects ? unit.effects : [];
    for (var i = 0; i < list.length; i++) {
      var kinds = list[i].immune && list[i].immune.buffs;
      if (kinds && kinds.indexOf(kind) >= 0) return list[i].label || "防护";
    }
    return "";
  }

  function immuneToStatus(unit, kind) {
    var list = unit && unit.effects ? unit.effects : [];
    for (var i = 0; i < list.length; i++) {
      var kinds = list[i].immune && list[i].immune.statuses;
      if (kinds && kinds.indexOf(kind) >= 0) return list[i].label || "防护";
    }
    return "";
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
      label: mod.label || "",
      progress: Number(mod.progress) || 0,
      origin: mod.origin == null ? null : Number(mod.origin),
      restore: Number(mod.restore) || 0,
      /* 「按目标回合」计时用；老数据没有这个字段，按标准回合计时 */
      targetUid: mod.targetUid || unit.uid,
      /* 「按己方回合」计时用（selfRound） */
      sourceUid: mod.sourceUid || "",
      /* 可复原态（E2）：removeEffect 按 key 一并回滚 */
      untilRecast: mod.untilRecast || "",
      /* 负面修正数据标记（E11）：dispel scope:"marked" 按它清除 */
      debuff: !!mod.debuff
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
      stacking: buff.stacking !== false,
      /* 「按目标回合」计时用；王泺然认大哥按目标回合计时，缺这个字段会永不结束 */
      targetUid: buff.targetUid || unit.uid,
      /* 「按己方回合」计时用（selfRound） */
      sourceUid: buff.sourceUid || ""
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
      label: status.label || "",
      targetUid: status.targetUid || unit.uid,
      /* 「按己方回合」计时用（selfRound） */
      sourceUid: status.sourceUid || "",
      /* noSkill 下仍可蓄力（泼水节 Q2）：只禁释放，不禁蓄力 */
      chargeOk: !!status.chargeOk
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
    if (unit.breakImmune || effectHasFlag(unit, "breakImmune")) {
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
        B.ENGINE_VERSION,
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
    /* 对手标记（如赵云哲的「卅力」）在两名英雄都建好之后挂，挂到对方身上 */
    if (B.skills && B.skills.initOpponentMarks) B.skills.initOpponentMarks(state);
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
      for (var m = 0; m < u.mods.length; m++) mods.push(u.mods[m].stat + u.mods[m].mode + u.mods[m].value + u.mods[m].remain + ":" + (u.mods[m].progress || 0) + ":" + (u.mods[m].origin == null ? "" : u.mods[m].origin));
      var st = [];
      for (var s = 0; s < u.statuses.length; s++) st.push(u.statuses[s].kind + u.statuses[s].remain);
      var eff = [];
      for (var e = 0; e < u.effects.length; e++) {
        eff.push(u.effects[e].id + u.effects[e].remain +
          (u.effects[e].guard ? ":g" + u.effects[e].guard.remaining : "") +
          (u.effects[e].when ? ":w" + u.effects[e].when : ""));
      }
      var marks = [];
      var markKeys = Object.keys(u.marks || {});
      for (var mk = 0; mk < markKeys.length; mk++) marks.push(markKeys[mk] + u.marks[markKeys[mk]].value);
      parts.push([
        u.uid, u.hp, u.mp, u.gauge, u.actionsLeft, u.breakValue, u.stunValue,
        u.charge ? u.charge.skillId + ":" + u.charge.amount : "-",
        buffs.join(","), mods.join(","), st.join(","), eff.join(","),
        u.scheduled.length, u.lastDamageType, marks.join(","), u.hpLost || 0,
        u.shield ? u.shield.hp + ":" + u.shield.remain : "-"
      ].join("|"));
    }
    var summonParts = [];
    var summons = state.summons || [];
    for (var si = 0; si < summons.length; si++) {
      var su = summons[si];
      var sb = [];
      for (var sb1 = 0; sb1 < su.buffs.length; sb1++) sb.push(su.buffs[sb1].kind + su.buffs[sb1].percent + su.buffs[sb1].remain);
      var sm = [];
      for (var sm1 = 0; sm1 < su.mods.length; sm1++) sm.push(su.mods[sm1].stat + su.mods[sm1].mode + su.mods[sm1].value + su.mods[sm1].remain + ":" + (su.mods[sm1].progress || 0) + ":" + (su.mods[sm1].origin == null ? "" : su.mods[sm1].origin));
      var ss = [];
      for (var ss1 = 0; ss1 < su.statuses.length; ss1++) ss.push(su.statuses[ss1].kind + su.statuses[ss1].remain);
      var se = [];
      for (var se1 = 0; se1 < su.effects.length; se1++) se.push(su.effects[se1].id + su.effects[se1].remain);
      var smark = [];
      var smKeys = Object.keys(su.marks || {});
      for (var smk = 0; smk < smKeys.length; smk++) smark.push(smKeys[smk] + su.marks[smKeys[smk]].value);
      summonParts.push([
        su.uid, su.side, su.summonKey, su.hp, su.gauge || 0, su.breakValue, su.stunValue,
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
  api.guardEffectOf = guardEffectOf;
  api.effectHasFlag = effectHasFlag;
  api.hasEffectKey = hasEffectKey;
  api.immuneToBuff = immuneToBuff;
  api.immuneToStatus = immuneToStatus;
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

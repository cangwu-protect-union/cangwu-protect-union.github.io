/* 回合制正传 6.0 · 战斗引擎 · 动作
   普攻、击溃、蓄蓝；技能执行与档案校验在 skills.js。 */
(function (root) {
  "use strict";
  var B = root.RPG6B || (root.RPG6B = {});
  var api = B.actions = B.actions || {};

  function currentUnit(state) {
    if (state.phase === "finished") throw new Error("对局已结束");
    if (!state.turnUid) throw new Error("没有正在行动的角色");
    var unit = B.state.unitOf(state, state.turnUid);
    if (unit.actionsLeft <= 0) throw new Error("本回合行动已用完");
    return unit;
  }

  function requireTarget(state, unit, uid) {
    if (!uid) throw new Error("没有选目标");
    var target;
    try {
      target = B.state.unitOf(state, uid);
    } catch (err) {
      throw new Error("目标非法：" + uid);
    }
    var healUid = B.skills && B.skills.basicHealTarget ? B.skills.basicHealTarget(state, unit) : null;
    if (healUid && uid === healUid) return target;
    var mySide = B.state.sideOf(state, unit.uid);
    var targetSide = B.state.sideOf(state, uid);
    var isSelf = uid === unit.uid;
    var canAlly = !!(unit.trait && unit.trait.canHitAlly);
    if (isSelf && !canAlly) throw new Error("不能以自己为目标");
    if (targetSide !== mySide) {
      if (B.skills && B.skills.checkTaunt) B.skills.checkTaunt(state, unit, uid);
    } else if (!isSelf && !canAlly) {
      throw new Error("不能以队友为目标");
    }
    return target;
  }

  var BASIC_CHARGE_ID = "basic.attack";

  /* 倪曼云「刚长出来」：对方每花 1 蓝解锁 1 个属性。
     锁的信息挂在对方身上（marks 里 on:"opponent"），解锁动作不消耗行动。 */
  var UNLOCK_STATS = ["atk", "def", "mres"];
  var UNLOCK_MARK = { atk: "lockAtk", def: "lockDef", mres: "lockMres" };
  var UNLOCK_ORIGIN = { atk: "atkOrigin", def: "defOrigin", mres: "mresOrigin" };
  var UNLOCK_LABEL = { atk: "攻击", def: "防御", mres: "法抗" };

  function lockedStats(unit) {
    var out = [];
    if (!unit || !unit.marks) return out;
    for (var i = 0; i < UNLOCK_STATS.length; i++) {
      var mark = unit.marks[UNLOCK_MARK[UNLOCK_STATS[i]]];
      if (mark && Number(mark.value) === 0) out.push(UNLOCK_STATS[i]);
    }
    return out;
  }

  function unlockAction(state, unit) {
    var stats = lockedStats(unit);
    if (!stats.length) return null;
    var enough = unit.mp >= 1;
    return {
      kind: "unlock",
      label: "解锁属性（1 蓝）",
      enabled: enough,
      reason: enough ? "" : "蓝不足",
      stats: stats.map(function (key) { return { key: key, label: UNLOCK_LABEL[key] }; }),
      targets: []
    };
  }

  /* 解锁：支付 1 蓝、标记该属性已解锁、3 个标准回合后把原值写回。
     原值在开局由倪曼云被动记进对方的 counter。 */
  function executeUnlock(state, unit, action, events) {
    var stat = String(action.stat || "");
    if (UNLOCK_STATS.indexOf(stat) < 0) throw new Error("解锁目标非法：" + stat);
    var mark = unit.marks ? unit.marks[UNLOCK_MARK[stat]] : null;
    if (!mark || Number(mark.value) !== 0) throw new Error("这个属性已经解锁了");
    if (unit.mp < 1) throw new Error("蓝不足，不能解锁");
    unit.mp -= 1;
    events.push({ type: "mp", round: state.round, uid: unit.uid, delta: -1, mp: unit.mp, reason: "unlock" });
    mark.value = 1;
    events.push({
      type: "mark",
      round: state.round,
      uid: unit.uid,
      key: UNLOCK_MARK[stat],
      name: mark.name,
      value: 1,
      max: mark.max,
      hideMax: !!mark.hideMax,
      skillId: "passive.unlock"
    });
    state.effectSeq = (state.effectSeq || 0) + 1;
    unit.scheduled.push({
      id: "sc" + state.effectSeq,
      atRound: state.round + 3,
      ops: [{ op: "stat", who: "self", stat: stat, mode: "set", value: { counter: UNLOCK_ORIGIN[stat] } }],
      sourceUid: unit.uid,
      targetUid: unit.uid,
      skillId: "passive.unlock",
      label: "解锁" + UNLOCK_LABEL[stat]
    });
    events.push({
      type: "unlock",
      round: state.round,
      uid: unit.uid,
      stat: stat,
      label: UNLOCK_LABEL[stat],
      remain: 3
    });
    return { kind: "unlock", stat: stat };
  }

  function basicAttack(state, unit, target, events, opts) {
    opts = opts || {};
    var healUid = !opts.forced && B.skills && B.skills.basicHealTarget
      ? B.skills.basicHealTarget(state, unit)
      : null;
    if (healUid) {
      var healTarget = B.state.unitOf(state, healUid);
      B.damage.heal(state, {
        uid: healTarget.uid,
        amount: B.state.statOf(unit, "atk"),
        rounding: "round5",
        skillId: "basic.attack",
        label: "给墓回血"
      }, events);
      return { kind: "basic", type: "attack", target: healTarget.uid, charged: false, healed: true };
    }
    var need = unit.trait && unit.trait.basicCharge ? unit.trait.basicCharge : 0;
    if (!opts.forced && need > 0) {
      var have = unit.charge && unit.charge.skillId === BASIC_CHARGE_ID ? unit.charge.amount : 0;
      if (have < need) {
        if (!unit.charge || unit.charge.skillId !== BASIC_CHARGE_ID) {
          unit.charge = { skillId: BASIC_CHARGE_ID, amount: 0 };
        }
        unit.charge.amount += 1;
        unit.flags.chargedThisTurn = true;
        events.push({
          type: "charg",
          round: state.round,
          uid: unit.uid,
          skillId: BASIC_CHARGE_ID,
          amount: unit.charge.amount,
          need: need,
          reason: "basicCharge"
        });
        return { kind: "basic", type: "attack", target: target.uid, charged: true };
      }
      unit.charge = null;
    }
    var type = B.traits.basicType(unit);
    var amount;
    /* 动态普攻面板（孙嘉怿）：攻击值按表达式算，优先级高于面板与 Buff 修正 */
    var atkExpr = B.skills && B.skills.basicAtkOf ? B.skills.basicAtkOf(unit) : null;
    if (atkExpr && B.effectOps && B.effectOps.valueOf) {
      amount = B.effectOps.valueOf(state, {
        sourceUid: unit.uid,
        targetUid: target.uid,
        skillId: "basic.attack",
        label: "普攻"
      }, atkExpr);
    } else {
      amount = B.state.statOf(unit, "atk");
    }
    var selfHit = target.uid === unit.uid;
    var mod = {};
    if (selfHit) {
      type = "true";
    } else if (!opts.forced && B.skills && B.skills.basicMod) {
      mod = B.skills.basicMod(state, unit, target, events) || {};
      if (mod.healInstead) {
        B.damage.heal(state, {
          uid: unit.uid,
          amount: amount * (mod.factor ? mod.factor : 1),
          rounding: "round5",
          skillId: "basic.attack",
          label: "普攻回血"
        }, events);
        return { kind: "basic", type: "attack", target: target.uid, charged: false, healed: true };
      }
      if (mod.type) type = mod.type;
      if (mod.factor) amount = amount * mod.factor;
    }
    var hits = Math.max(1, Math.floor(Number(mod.hits) || 1));
    var noBreak = !!mod.noBreak || !!opts.noBreak;
    var dodged = 0;
    if (mod.misfire) {
      events.push({
        type: "misfire",
        round: state.round,
        uid: unit.uid,
        targetUid: target.uid,
        label: mod.misfireLabel || "哑火"
      });
      hits = 0;
    } else {
      for (var i = 0; i < hits; i++) {
        if (state.phase === "finished") break;
        var hitSpec = {
          sourceUid: unit.uid,
          targetUid: target.uid,
          type: type,
          amount: amount,
          noBreak: noBreak,
          noReaction: !!opts.noReaction,
          healBack: selfHit,
          skillId: opts.skillId || "basic.attack",
          label: opts.label || "普攻",
          actionId: opts.actionId || ""
        };
        B.damage.hit(state, hitSpec, events);
        if (hitSpec.dodged) dodged += 1;
      }
    }
    if (state.phase !== "finished" && dodged < hits && !opts.skipHooks && B.skills && B.skills.runHooks) {
      B.skills.runHooks(state, unit, "basicHit", {
        sourceUid: unit.uid,
        targetUid: target.uid,
        skillId: "passive.basicHit",
        label: "普攻被动"
      }, events);
    }
    return { kind: "basic", type: "attack", target: target.uid, charged: false, hits: hits, dodged: dodged };
  }

  /* 被技能强制执行的一次普攻：不消耗行动、不检查普攻门槛、不跑 basicMod */
  function strike(state, unit, target, events, opts) {
    return basicAttack(state, unit, target, events, {
      forced: true,
      noReaction: true,
      noBreak: !!(opts && opts.noBreak),
      label: (opts && opts.label) || "普攻",
      actionId: (opts && opts.actionId) || ""
    });
  }

  function basicBreak(state, unit, target, events) {
    if (target.breakImmune || (B.state.effectHasFlag && B.state.effectHasFlag(target, "breakImmune"))) {
      throw new Error("这个单位无法被击溃");
    }
    /* 防护层对击溃也生效（硕哥过肩摔、越共探头）：免疫该次并消耗一次 */
    var guardEffect = B.state.guardEffectOf ? B.state.guardEffectOf(target) : null;
    if (guardEffect && guardEffect.guard && guardEffect.guard.onBreak && B.damage && B.damage.consumeGuard) {
      B.damage.consumeGuard(state, target, { sourceUid: unit.uid, skillId: "basic.break" }, events);
      return { kind: "basic", type: "break", target: target.uid, guarded: true };
    }
    var threshold = B.rules.CONFIG.breakThreshold;
    if (target.breakValue < threshold) {
      throw new Error("击溃值不足 " + threshold + "（现在 " + target.breakValue + "）");
    }
    var rounds = B.rules.breakRounds(target.breakValue);
    /* 被动先按进入击溃前的击溃值结算（如以德服人），再清零并进入击溃 */
    if (state.phase !== "finished" && B.skills && B.skills.runHooks) {
      B.skills.runHooks(state, unit, "breakAction", {
        sourceUid: unit.uid,
        targetUid: target.uid,
        skillId: "passive.breakAction",
        label: "击溃被动"
      }, events);
    }
    if (state.phase === "finished") {
      return { kind: "basic", type: "break", target: target.uid };
    }
    var applied = B.state.enterBreak(target, rounds, "break." + unit.uid, "击溃");
    events.push({
      type: "statusAdd",
      round: state.round,
      uid: target.uid,
      kind: "break",
      remain: applied.remain,
      source: "break",
      label: "击溃"
    });
    return { kind: "basic", type: "break", target: target.uid };
  }

  function basicChargeMp(state, unit, events) {
    var max = B.state.maxMpOf(unit);
    if (unit.mp >= max) throw new Error("蓝已满");
    unit.mp += 1;
    events.push({ type: "mp", round: state.round, uid: unit.uid, delta: 1, mp: unit.mp, reason: "chargeMp" });
    return { kind: "basic", type: "chargeMp" };
  }

  /* 额外动作（E5）：吃碎苹果、功德回血。不消耗行动，不吃「行动前掷骰跳过」。
     入口展开与可用性在 conditions.itemsOf/itemAvailable。 */
  function executeItem(state, unit, action, events) {
    var items = B.conditions.itemsOf(unit);
    var item = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === action.key) {
        item = items[i];
        break;
      }
    }
    if (!item) throw new Error("没有这个额外动作：" + action.key);
    var check = B.conditions.itemAvailable(state, unit, item);
    if (!check.ok) throw new Error(check.reason);
    if (item.oncePerRound) unit.flags["itemUsed." + item.id] = state.round;
    events.push({
      type: "action",
      round: state.round,
      uid: unit.uid,
      kind: "item",
      itemId: item.id,
      name: item.label,
      target: unit.uid
    });
    if (B.effectOps && B.effectOps.runOps) {
      B.effectOps.runOps(state, {
        sourceUid: unit.uid,
        targetUid: unit.uid,
        skillId: item.skillId,
        label: item.label
      }, B.skills.prepareOps(item.ops, unit), events);
    }
    return { kind: "item", key: item.id };
  }

  function execute(state, action, events) {
    if (!action || typeof action !== "object") throw new Error("动作格式错误");
    var unit = currentUnit(state);
    /* 解锁属性是额外动作：不消耗行动，也不吃「行动前掷骰跳过」 */
    if (action.kind === "unlock") return executeUnlock(state, unit, action, events);
    /* 吃苹果/功德回血同为额外动作 */
    if (action.kind === "item") return executeItem(state, unit, action, events);
    /* 行动前的持续效果判定（高猿长啸）：跳过时行动照样消耗，committed 仍是原动作，
       因为掷骰由种子决定，回放会得到同一次判定。 */
    if (B.effectOps && B.effectOps.actionGate && !B.effectOps.actionGate(state, unit, events)) {
      return action;
    }
    /* 一次动作一个 id：防护层「免疫一次攻击」按它去重，多段伤害只算一次 */
    state.actionSeq = (state.actionSeq || 0) + 1;
    var actionId = "act" + state.actionSeq;
    var result;
    if (action.kind === "basic") {
      /* 跳过本回合：只在没有其他可选动作时由 list 提供，不受「只能普攻」等封锁影响 */
      if (action.type === "pass") return { kind: "basic", type: "pass", target: "" };
      var onlyBasic = B.state.hasStatus(unit, "onlyBasic");
      if (onlyBasic && action.type !== "attack") {
        throw new Error("现在只能普攻");
      }
      if (action.type === "attack") {
        if (B.state.hasStatus(unit, "noBasic")) throw new Error("无法普攻");
        if (B.state.effectHasFlag && B.state.effectHasFlag(unit, "selfNoBasic")) throw new Error("无法普攻");
        var targetUnit = requireTarget(state, unit, action.target);
        var gate = B.skills && B.skills.basicGate
          ? B.skills.basicGate(state, unit, targetUnit.uid, events)
          : { allow: true, reason: "" };
        if (!gate.allow) throw new Error(gate.reason || "无法普攻");
        result = basicAttack(state, unit, targetUnit, events, { actionId: actionId });
      } else if (action.type === "break") {
        result = basicBreak(state, unit, requireTarget(state, unit, action.target), events);
      } else if (action.type === "chargeMp") {
        result = basicChargeMp(state, unit, events);
      } else {
        throw new Error("未知的基础动作：" + action.type);
      }
    } else if (action.kind === "skill" || action.kind === "charge") {
      if (!B.skills || !B.skills.execute) throw new Error("技能系统尚未接入");
      result = B.skills.execute(state, unit, action, events, actionId);
    } else {
      throw new Error("未知的动作类型：" + action.kind);
    }
    if (state.phase !== "finished" && B.skills && B.skills.runHooks) {
      B.skills.runHooks(state, unit, "afterAction", {
        sourceUid: unit.uid,
        targetUid: (result && result.target) || action.target || "",
        skillId: "passive.afterAction",
        label: "行动后",
        actionKind: action.kind,
        actionType: action.type || "",
        usedSkill: action.skillId || ""
      }, events);
    }
    return result;
  }

  function list(state) {
    var out = [];
    if (state.phase === "finished" || !state.turnUid) return out;
    var unit = B.state.unitOf(state, state.turnUid);
    var mySide = B.state.sideOf(state, unit.uid);
    var enemySide = B.state.otherSide(state, mySide);
    var enemyList = B.state.combatantsOf(state, enemySide);
    var allowedUids = B.traits && B.traits.ignoreTaunt && B.traits.ignoreTaunt(unit)
      ? enemyList.map(function (u) { return u.uid; })
      : (B.skills && B.skills.maxTauntUids ? B.skills.maxTauntUids(state, enemySide) : enemyList.map(function (u) { return u.uid; }));
    var targets = enemyList.filter(function (u) { return allowedUids.indexOf(u.uid) >= 0; }).map(function (u) { return u.uid; });
    var hasAction = unit.actionsLeft > 0;
    var basicNeed = unit.trait && unit.trait.basicCharge ? unit.trait.basicCharge : 0;
    var basicHave = basicNeed > 0 && unit.charge && unit.charge.skillId === BASIC_CHARGE_ID
      ? unit.charge.amount
      : 0;
    var onlyBasic = B.state.hasStatus(unit, "onlyBasic");
    var noBasic = B.state.hasStatus(unit, "noBasic") ||
      !!(B.state.effectHasFlag && B.state.effectHasFlag(unit, "selfNoBasic"));
    var gate = B.skills && B.skills.basicGate
      ? B.skills.basicGate(state, unit, targets[0] || "", [])
      : { allow: true, reason: "" };
    var breakable = targets.filter(function (uid) {
      var t = B.state.unitOf(state, uid);
      if (t.breakImmune) return false;
      /* 防护层的免击溃也要在可行动作里排除，否则界面与 AI 会选到必失败的动作 */
      if (B.state.effectHasFlag && B.state.effectHasFlag(t, "breakImmune")) return false;
      return t.breakValue >= B.rules.CONFIG.breakThreshold;
    });
    out.push({
      kind: "basic",
      type: "attack",
      label: "普攻",
      enabled: hasAction && !noBasic && gate.allow,
      reason: !hasAction
        ? "本回合行动已用完"
        : (noBasic ? "无法普攻" : (gate.allow ? "" : (gate.reason || "无法普攻"))),
      targets: targets,
      chargeNeed: basicNeed,
      chargeHave: basicHave
    });
    out.push({
      kind: "basic",
      type: "break",
      label: "击溃",
      enabled: hasAction && !onlyBasic && breakable.length > 0,
      reason: !hasAction
        ? "本回合行动已用完"
        : (onlyBasic
          ? "现在只能普攻"
          : (breakable.length ? "" : "目标击溃值不足 " + B.rules.CONFIG.breakThreshold)),
      targets: breakable
    });
    out.push({
      kind: "basic",
      type: "chargeMp",
      label: "蓄蓝",
      enabled: hasAction && !onlyBasic && unit.mp < B.state.maxMpOf(unit),
      reason: !hasAction
        ? "本回合行动已用完"
        : (onlyBasic
          ? "现在只能普攻"
          : (unit.mp < B.state.maxMpOf(unit) ? "" : "蓝已满")),
      targets: []
    });
    var unlock = unlockAction(state, unit);
    if (unlock) out.push(unlock);
    /* 额外动作（E5）：不消耗行动；眩晕/击溃不可用，onlyBasic/noSkill 不拦。
       库存不足或 forbid 效果在身时不列入口；每回合限 1 次的用过之后列出来置灰。 */
    var items = B.conditions.itemsOf(unit);
    for (var it = 0; it < items.length; it++) {
      var item = items[it];
      var avail = B.conditions.itemAvailable(state, unit, item);
      if (avail.noStock || avail.forbidden) continue;
      out.push({
        kind: "item",
        key: item.id,
        label: item.label,
        enabled: avail.ok,
        reason: avail.reason,
        targets: []
      });
    }
    /* 兜底：被锁到无任何动作可做时（下潜 + 旋转同时锁普攻与蓄力、蓝已满），
       允许跳过本回合，避免对局卡死。只在没有可选动作时出现。 */
    var anyEnabled = out.some(function (item) { return item.enabled; });
    if (!anyEnabled && hasAction) {
      out.push({
        kind: "basic",
        type: "pass",
        label: "跳过本回合",
        enabled: true,
        reason: "",
        targets: []
      });
    }
    return out;
  }

  api.execute = execute;
  api.list = list;
  api.currentUnit = currentUnit;
  api.strike = strike;
  api.lockedStats = lockedStats;

  if (typeof module === "object" && module.exports) module.exports = B;
})(typeof globalThis !== "undefined" ? globalThis : this);

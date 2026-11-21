/* 回合制正传 6.0 · 战斗引擎 · 效果解释器 · 辅助函数
   定义 H.* 辅助函数，跟在 effect-ops.js 之后加载，供各 op 分片调用。 */
(function (root) {
  "use strict";
  var B = root.RPG6B || (root.RPG6B = {});
  var H = (B.effectOps || (B.effectOps = {}))._helpers || {};

  H.pushEvent = function (state, events, event) {
    event.round = state.round;
    if (events) events.push(event);
    return event;
  }

  H.tryUnit = function (state, uid) {
    if (!uid) return null;
    try {
      return B.state.unitOf(state, uid);
    } catch (err) {
      return null;
    }
  }

  H.ownerUnit = function (state, ctx) {
    return H.tryUnit(state, ctx.ownerUid || ctx.sourceUid);
  }

  H.sideUnits = function (state, ctx, which) {
    var w = which || "target";
    /* E1 群体上限：who 写成 {of:"allEnemies",limit:N}，截断到前 N 个 */
    if (w && typeof w === "object") {
      var baseList = H.sideUnits(state, ctx, w.of || "allEnemies");
      var cap = Number(w.limit);
      if (isFinite(cap) && cap > 0 && baseList.length > cap) return baseList.slice(0, cap);
      return baseList;
    }
    var owner = H.ownerUnit(state, ctx);
    var mySide = owner ? (owner.side || (owner.uid === "a" ? "a" : "b")) : "a";
    var enemySide = mySide === "a" ? "b" : "a";
    if (w === "self") return owner ? [owner] : [];
    if (w === "allEnemies") return B.state.combatantsOf(state, enemySide);
    if (w === "allAllies") {
      return state.units.filter(function (u) { return u.side === mySide && u.hp > 0; });
    }
    if (w === "enemyHero") {
      var hero = B.state.heroOf(state, enemySide);
      return hero && hero.hp > 0 ? [hero] : [];
    }
    if (ctx.scope === "allEnemies") return B.state.combatantsOf(state, enemySide);
    if (ctx.scope === "allAllies") {
      return state.units.filter(function (u) { return u.side === mySide && u.hp > 0; });
    }
    var targetUid = ctx.ownerUid && ctx.ownerUid !== ctx.sourceUid ? ctx.sourceUid : ctx.targetUid;
    var target = H.tryUnit(state, targetUid);
    return target ? [target] : [];
  }

  H.sideUnit = function (state, ctx, which) {
    var list = H.sideUnits(state, ctx, which);
    return list.length ? list[0] : null;
  }

  H.ctxFor = function (ctx, target) {
    var copy = {};
    for (var key in ctx) {
      if (Object.prototype.hasOwnProperty.call(ctx, key)) copy[key] = ctx[key];
    }
    copy.targetUid = target.uid;
    return copy;
  }

  H.statValue = function (state, unit, name) {
    if (name === "hp") return unit.hp;
    if (name === "mp") return unit.mp;
    if (name === "maxHp") return B.state.maxHpOf(unit);
    if (name === "maxMp") return B.state.maxMpOf(unit);
    if (name === "lostHp") return B.state.maxHpOf(unit) - unit.hp;
    if (name === "breakValue") return unit.breakValue;
    if (name === "stunValue") return unit.stunValue;
    if (name === "gauge") return unit.gauge;
    return B.state.statOf(unit, name);
  }

  H.targetStatValue = function (state, ctx, expr) {
    var raw = String(expr.stat == null ? "" : expr.stat);
    var parts = raw.split(".");
    var who = parts.length > 1 ? parts[0] : (expr.who || "self");
    var name = parts.length > 1 ? parts[1] : raw;
    var unit = H.sideUnit(state, ctx, who);
    if (!unit) return 0;
    return H.statValue(state, unit, name);
  }

  H.evalValue = function (state, ctx, expr) {
    if (expr == null) return 0;
    if (typeof expr === "number") return expr;
    if (typeof expr === "string") {
      var n = Number(expr);
      if (!isFinite(n)) throw new Error("无法解析的数值：" + expr);
      return n;
    }
    if (expr.stat) return H.targetStatValue(state, ctx, expr);
    if (expr.mult) return H.evalValue(state, ctx, expr.mult) * (expr.factor == null ? 1 : expr.factor);
    if (expr.per) return H.evalValue(state, ctx, expr.per) * (expr.factor == null ? 1 : expr.factor);
    if (expr.hpPercent) {
      var path = String(expr.hpPercent).split(".");
      var who = H.sideUnit(state, ctx, path[0]);
      if (!who) return 0;
      var base = path[1] === "current" ? who.hp : B.state.maxHpOf(who) - who.hp;
      return base * (Number(expr.percent) || 0) / 100;
    }
    if (expr.plus) {
      var sum = 0;
      for (var i = 0; i < expr.plus.length; i++) sum += H.evalValue(state, ctx, expr.plus[i]);
      return sum;
    }
    if (expr.counter) {
      var holder = H.sideUnit(state, ctx, "self");
      if (!holder) return 0;
      return holder.flags[H.counterKey(ctx, expr.counter, expr.perTarget !== false)] || 0;
    }
    if (expr.summonCount != null) {
      var countOwner = H.sideUnit(state, ctx, expr.who || "self");
      if (!countOwner || !B.summons || !B.summons.countKey) return 0;
      return B.summons.countKey(state, B.state.sideOf(state, countOwner.uid), String(expr.summonCount));
    }
    if (expr.mark) {
      var markParts = String(expr.mark).split(".");
      var markWho = markParts.length > 1 ? markParts[0] : "self";
      var markKey = markParts.length > 1 ? markParts[1] : markParts[0];
      var markedUnit = H.sideUnit(state, ctx, markWho);
      if (!markedUnit) return 0;
      return B.state.markOf(markedUnit, markKey);
    }
    if (expr.minus) {
      return H.evalValue(state, ctx, expr.minus[0]) - H.evalValue(state, ctx, expr.minus[1]);
    }
    if (expr.ctx) {
      return Number(ctx && ctx[expr.ctx]) || 0;
    }
    throw new Error("无法解析的数值表达式：" + JSON.stringify(expr));
  }

  H.durationOf = function (spec) {
    if (spec == null) return null;
    if (typeof spec === "number") return { unit: "standard", count: spec };
    return { unit: spec.unit || "standard", count: Number(spec.count) || 0 };
  }

  H.sourceTag = function (ctx) {
    return (ctx.skillId || "effect") + "#" + (ctx.sourceUid || "");
  }

  H.counterKey = function (ctx, key, perTarget) {
    return "ctr." + key + "." + (perTarget ? (ctx.targetUid || "*") : "*");
  }

  H.resolveDamageType = function (state, ctx, op) {
    if (op.typeFrom === "self.lastDamageType" || op.type === "last") {
      var self = H.sideUnit(state, ctx, "self");
      var last = self && self.lastDamageType ? self.lastDamageType : "phys";
      return last;
    }
    if (op.type === "basic") {
      var caster = H.sideUnit(state, ctx, "self");
      return caster ? B.traits.basicType(caster) : "phys";
    }
    return op.type || "phys";
  }

  H.addStat = function (state, ctx, op, events) {
    var targets = H.sideUnits(state, ctx, op.who || "target");
    for (var ti = 0; ti < targets.length; ti++) {
      var target = targets[ti];
      var tctx = H.ctxFor(ctx, target);
      var before = B.state.statOf(target, op.stat);
      var spec = H.durationOf(op.duration);
      var mod = B.state.addMod(target, {
        stat: op.stat,
        mode: op.mode || "add",
        value: op.value == null ? 0 : H.evalValue(state, tctx, op.value),
        remain: spec ? spec.count : B.state.PERMANENT,
        unit: spec ? spec.unit : "standard",
        source: H.sourceTag(tctx),
        label: tctx.label || "",
        /* 归零后逐标准回合恢复原值：记住改动前的面板，标准回合末按 restore 补回 */
        restore: op.restore == null ? 0 : Number(op.restore),
        origin: op.restore == null ? null : before,
        targetUid: target.uid,
        sourceUid: tctx.sourceUid,
        /* E2 removeEffect 按 key 回滚 */
        untilRecast: op.untilRecast || "",
        /* E11 dispel scope:"marked" 清除 */
        debuff: !!op.debuff
      });
      H.pushEvent(state, events, {
        type: "stat",
        uid: target.uid,
        stat: mod.stat,
        mode: mod.mode,
        value: mod.value,
        remain: mod.remain,
        skillId: tctx.skillId || ""
      });
      if (mod.stat === "maxHp") B.state.clampHpToMax(target);
      if (mod.stat === "maxMp") target.mp = Math.min(target.mp, B.state.maxMpOf(target));
      var after = B.state.statOf(target, op.stat);
      if (after < before && target.uid !== (tctx.ownerUid || tctx.sourceUid) && B.skills && B.skills.runHooks) {
        B.skills.runHooks(state, target, "statDrained", {
          sourceUid: tctx.ownerUid || tctx.sourceUid,
          targetUid: target.uid,
          skillId: "passive.statDrained",
          label: "属性削弱",
          stat: op.stat,
          value: before - after
        }, events);
      }
    }
  }

  H.addBuff = function (state, ctx, op, events) {
    var targets = H.sideUnits(state, ctx, op.who || "target");
    for (var ti = 0; ti < targets.length; ti++) {
      var target = targets[ti];
      var tctx = H.ctxFor(ctx, target);
      var immune = B.skills && B.skills.immuneBuffs ? B.skills.immuneBuffs(target) : [];
      if (op.kind && immune.indexOf(op.kind) >= 0) {
        H.pushEvent(state, events, {
          type: "buffImmune",
          uid: target.uid,
          kind: op.kind,
          percent: H.evalValue(state, tctx, op.percent),
          label: tctx.label || "",
          blocked: true
        });
        continue;
      }
      var guardImmune = op.kind && B.state.immuneToBuff ? B.state.immuneToBuff(target, op.kind) : "";
      if (guardImmune) {
        H.pushEvent(state, events, {
          type: "buffImmune",
          uid: target.uid,
          kind: op.kind,
          percent: H.evalValue(state, tctx, op.percent),
          label: guardImmune,
          blocked: true
        });
        continue;
      }
      if (op.kind && H.DEBUFF_KINDS[op.kind] && target.reflect) {
        target = H.sideUnit(state, tctx, "self");
        if (!target) continue;
        H.pushEvent(state, events, { type: "reflect", uid: target.uid, kind: "buff", detail: op.kind });
      }
      var spec = H.durationOf(op.duration);
      var entry = B.state.addBuff(target, {
        kind: op.kind,
        percent: op.percent == null ? 0 : H.evalValue(state, tctx, op.percent),
        remain: spec ? spec.count : 0,
        unit: spec ? spec.unit : "standard",
        source: H.sourceTag(tctx),
        label: tctx.label || "",
        stacking: op.stacking !== false,
        targetUid: target.uid,
        sourceUid: tctx.sourceUid
      });
      H.pushEvent(state, events, {
        type: "buffAdd",
        uid: target.uid,
        kind: entry.kind,
        percent: entry.percent,
        remain: entry.remain,
        skillId: tctx.skillId || ""
      });
    }
  }

  H.addStatus = function (state, ctx, op, events) {
    var targets = H.sideUnits(state, ctx, op.who || "target");
    for (var ti = 0; ti < targets.length; ti++) {
      var target = targets[ti];
      var tctx = H.ctxFor(ctx, target);
      if (H.STATUS_DEBUFF[op.kind] && target.reflect) {
        target = H.sideUnit(state, tctx, "self");
        if (!target) continue;
        H.pushEvent(state, events, { type: "reflect", uid: target.uid, kind: "status", detail: op.kind });
      }
      var guardImmune = B.state.immuneToStatus ? B.state.immuneToStatus(target, op.kind) : "";
      if (guardImmune) {
        H.pushEvent(state, events, {
          type: "statusImmune",
          uid: target.uid,
          kind: op.kind,
          label: guardImmune,
          blocked: true,
          skillId: tctx.skillId || ""
        });
        continue;
      }
      var spec = H.durationOf(op.duration || op.rounds);
      var label = op.label || tctx.label || "";
      var entry = op.kind === "break"
        ? B.state.enterBreak(target, spec ? spec.count : 0, H.sourceTag(tctx), label)
        : B.state.addStatus(target, {
          kind: op.kind,
          remain: spec ? spec.count : 0,
          unit: spec ? spec.unit : "standard",
          source: H.sourceTag(tctx),
          skillId: op.skillId || "",
          label: label,
          targetUid: target.uid,
          sourceUid: tctx.sourceUid,
          chargeOk: !!op.chargeOk
        });
      H.pushEvent(state, events, {
        type: "statusAdd",
        uid: target.uid,
        kind: entry.kind,
        remain: entry.remain,
        label: entry.label,
        skillId: entry.skillId || ""
      });
    }
  }

  H.addTick = function (state, ctx, op, events) {
    var targets = H.sideUnits(state, ctx, op.who || op.on || "target");
    for (var ti = 0; ti < targets.length; ti++) {
      var target = targets[ti];
      var tctx = H.ctxFor(ctx, target);
      var spec = H.durationOf(op.duration);
      state.effectSeq = (state.effectSeq || 0) + 1;
      var effect = {
        id: "ef" + state.effectSeq,
        remain: op.permanent || op.guard ? B.state.PERMANENT : (spec ? spec.count : 1),
        unit: spec ? spec.unit : "standard",
        unstoppable: !!op.unstoppable,
        label: op.label || tctx.label || "",
        desc: op.desc || "",
        tag: op.tag || "",
        key: op.key || "",
        gate: op.gate || null,
        period: Number(op.period) || 0,
        breakOnSourceStatus: op.breakOnSourceStatus || null,
        breakOnHolderStatus: op.breakOnHolderStatus || null,
        /* 防护层：取消 N 次伤害 + 用完后执行的 ops；免疫异常/击溃/蓄力打断 */
        guard: op.guard ? { remaining: Math.max(1, Number(op.guard.remaining) || 1), ops: op.guard.ops || [], blockedActionId: "" } : null,
        immune: op.immune || null,
        breakImmune: !!op.breakImmune,
        chargeGuard: !!op.chargeGuard,
        ops: op.ops || [],
        sourceUid: tctx.sourceUid,
        targetUid: target.uid,
        skillId: tctx.skillId || "",
        fromBuff: !!op.fromBuff,
        /* E11 dispel scope:"marked" 清除 */
        debuff: !!op.debuff,
        bornRound: Math.max(1, state.round)
      };
      target.effects.push(effect);
      H.pushEvent(state, events, {
        type: "effectAdd",
        uid: target.uid,
        effectId: effect.id,
        label: effect.label,
        remain: effect.remain,
        unstoppable: effect.unstoppable,
        skillId: tctx.skillId || ""
      });
    }
  }

  H.runDice = function (state, ctx, op, events) {
    var sides = op.sides || B.rules.CONFIG.diceSides;
    var repeat = Math.max(1, Math.floor(Number(op.times) || 1));
    var last = 0;
    for (var r = 0; r < repeat; r++) {
      if (state.phase === "finished") return last;
      var roll = B.rng.dice(state, sides);
      last = roll;
      H.pushEvent(state, events, { type: "dice", uid: ctx.sourceUid, sides: sides, value: roll, label: op.label || "", skillId: ctx.skillId || "" });
      var cases = op.cases || [];
      var hit = false;
      for (var i = 0; i < cases.length; i++) {
        var item = cases[i];
        var hitCase = false;
        if (item.in && item.in.length === 2) hitCase = roll >= item.in[0] && roll <= item.in[1];
        else if (item.in) hitCase = item.in.indexOf(roll) >= 0;
        else if (item.roll != null) hitCase = item.roll === roll;
        if (hitCase) {
          H.runOps(state, ctx, item.ops || [], events);
          hit = true;
          break;
        }
      }
      if (!hit && op.else) H.runOps(state, ctx, op.else, events);
    }
    return last;
  }

  H.actionGate = function (state, unit, events) {
    var list = unit && unit.effects ? unit.effects : [];
    for (var i = 0; i < list.length; i++) {
      var effect = list[i];
      var gate = effect.gate;
      if (!gate) continue;
      var sides = gate.sides || B.rules.CONFIG.diceSides;
      var roll = B.rng.dice(state, sides);
      H.pushEvent(state, events, {
        type: "dice",
        uid: unit.uid,
        sides: sides,
        value: roll,
        label: effect.label || "",
        skillId: effect.skillId || ""
      });
      var cancel = gate.cancel || [];
      if (cancel.indexOf(roll) >= 0) {
        H.pushEvent(state, events, {
          type: "actionCanceled",
          uid: unit.uid,
          value: roll,
          label: effect.label || "",
          skillId: effect.skillId || ""
        });
        return false;
      }
    }
    return true;
  }

  H.runIf = function (state, ctx, op, events) {
    var cond = op.cond || {};
    var ok = false;
    if (cond.gender) {
      var holder = H.sideUnit(state, ctx, cond.gender === "target" ? "target" : "self");
      var gender = holder ? holder.gender : "";
      if (cond.ne != null) ok = gender !== cond.ne;
      else ok = gender === (cond.eq != null ? cond.eq : cond.value);
    } else if (cond.status) {
      var owner = H.sideUnit(state, ctx, cond.who || "self");
      ok = !!owner && B.state.hasStatus(owner, cond.status);
      if (cond.ne) ok = !ok;
    } else if (cond.effect) {
      /* 按持续效果的 key 判断（下潜期间：人高马大阈值与回血翻倍） */
      var effectOwner = H.sideUnit(state, ctx, cond.who || "self");
      ok = !!effectOwner && B.state.hasEffectKey(effectOwner, cond.effect);
      if (cond.ne) ok = !ok;
    } else if (cond.summon) {
      var summonOwner = H.sideUnit(state, ctx, cond.who || "self");
      var found = null;
      if (summonOwner && B.summons && B.summons.findKey) {
        found = B.summons.findKey(state, B.state.sideOf(state, summonOwner.uid), cond.summon);
      }
      ok = !!found;
      if (cond.ne) ok = !ok;
    } else if (cond.summonCount) {
      var scOwner = H.sideUnit(state, ctx, cond.who || "self");
      var scCount = scOwner && B.summons ? B.summons.ofSide(state, B.state.sideOf(state, scOwner.uid)).length : 0;
      var sc = cond.summonCount;
      if (sc.op === "lt") ok = scCount < sc.right;
      else if (sc.op === "le") ok = scCount <= sc.right;
      else if (sc.op === "gt") ok = scCount > sc.right;
      else if (sc.op === "ge") ok = scCount >= sc.right;
      else if (sc.op === "eq") ok = scCount === sc.right;
      else ok = false;
    } else {
      var left = H.evalValue(state, ctx, cond.left);
      var right = H.evalValue(state, ctx, cond.right);
      if (cond.op === "lt") ok = left < right;
      else if (cond.op === "le") ok = left <= right;
      else if (cond.op === "gt") ok = left > right;
      else if (cond.op === "ge") ok = left >= right;
      else if (cond.op === "eq") ok = left === right;
      else if (cond.op === "ne") ok = left !== right;
      else throw new Error("未知的比较方式：" + cond.op);
    }
    if (ok) H.runOps(state, ctx, op.then || [], events);
    else H.runOps(state, ctx, op.else || [], events);
  }

  H.runInterrupt = function (state, ctx, op, events) {
    var target = H.sideUnit(state, ctx, op.who || "target");
    if (!target) return;
    var kept = [];
    var removed = [];
    for (var i = 0; i < target.effects.length; i++) {
      var effect = target.effects[i];
      var match = op.tag ? effect.tag === op.tag : effect.unstoppable;
      if (match) removed.push(effect.label || effect.id);
      else kept.push(effect);
    }
    target.effects = kept;
    H.pushEvent(state, events, { type: "interrupt", uid: target.uid, removed: removed, skillId: ctx.skillId || "" });
  }

  H.runSchedule = function (state, ctx, op, events) {
    var target = H.sideUnit(state, ctx, op.on || "self");
    if (!target) return;
    var effect = {
      id: "sc" + ((state.effectSeq = (state.effectSeq || 0) + 1)),
      atRound: state.round + (Number(op.after) || 0),
      ops: op.ops || [],
      sourceUid: ctx.sourceUid,
      targetUid: ctx.targetUid,
      skillId: ctx.skillId || "",
      label: op.label || ctx.label || ""
    };
    target.scheduled.push(effect);
    H.pushEvent(state, events, {
      type: "schedule",
      uid: target.uid,
      scheduleId: effect.id,
      atRound: effect.atRound,
      label: effect.label,
      skillId: ctx.skillId || ""
    });
  }

})(typeof globalThis !== "undefined" ? globalThis : this);

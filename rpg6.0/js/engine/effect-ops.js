/* 回合制正传 6.0 · 战斗引擎 · 效果解释器
   技能数据里的 ops 全部在这里执行。不认识的 op 直接抛错，不静默跳过。 */
(function (root) {
  "use strict";
  var B = root.RPG6B || (root.RPG6B = {});
  var api = B.effectOps = B.effectOps || {};

  var DEBUFF_KINDS = { fragile: true, panic: true };
  var STATUS_DEBUFF = { break: true, stun: true, noSkill: true, noBasic: true, cannotAct: true };

  function pushEvent(state, events, event) {
    event.round = state.round;
    if (events) events.push(event);
    return event;
  }

  function tryUnit(state, uid) {
    if (!uid) return null;
    try {
      return B.state.unitOf(state, uid);
    } catch (err) {
      return null;
    }
  }

  function ownerUnit(state, ctx) {
    return tryUnit(state, ctx.ownerUid || ctx.sourceUid);
  }

  function sideUnits(state, ctx, which) {
    var w = which || "target";
    var owner = ownerUnit(state, ctx);
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
    var target = tryUnit(state, targetUid);
    return target ? [target] : [];
  }

  function sideUnit(state, ctx, which) {
    var list = sideUnits(state, ctx, which);
    return list.length ? list[0] : null;
  }

  function ctxFor(ctx, target) {
    var copy = {};
    for (var key in ctx) {
      if (Object.prototype.hasOwnProperty.call(ctx, key)) copy[key] = ctx[key];
    }
    copy.targetUid = target.uid;
    return copy;
  }

  function statValue(state, unit, name) {
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

  function targetStatValue(state, ctx, expr) {
    var raw = String(expr.stat == null ? "" : expr.stat);
    var parts = raw.split(".");
    var who = parts.length > 1 ? parts[0] : (expr.who || "self");
    var name = parts.length > 1 ? parts[1] : raw;
    var unit = sideUnit(state, ctx, who);
    if (!unit) return 0;
    return statValue(state, unit, name);
  }

  function evalValue(state, ctx, expr) {
    if (expr == null) return 0;
    if (typeof expr === "number") return expr;
    if (typeof expr === "string") {
      var n = Number(expr);
      if (!isFinite(n)) throw new Error("无法解析的数值：" + expr);
      return n;
    }
    if (expr.stat) return targetStatValue(state, ctx, expr);
    if (expr.mult) return evalValue(state, ctx, expr.mult) * (expr.factor == null ? 1 : expr.factor);
    if (expr.per) return evalValue(state, ctx, expr.per) * (expr.factor == null ? 1 : expr.factor);
    if (expr.hpPercent) {
      var path = String(expr.hpPercent).split(".");
      var who = sideUnit(state, ctx, path[0]);
      if (!who) return 0;
      var base = path[1] === "current" ? who.hp : B.state.maxHpOf(who) - who.hp;
      return base * (Number(expr.percent) || 0) / 100;
    }
    if (expr.plus) {
      var sum = 0;
      for (var i = 0; i < expr.plus.length; i++) sum += evalValue(state, ctx, expr.plus[i]);
      return sum;
    }
    if (expr.counter) {
      var holder = sideUnit(state, ctx, "self");
      if (!holder) return 0;
      return holder.flags[counterKey(ctx, expr.counter, expr.perTarget !== false)] || 0;
    }
    if (expr.mark) {
      var markParts = String(expr.mark).split(".");
      var markWho = markParts.length > 1 ? markParts[0] : "self";
      var markKey = markParts.length > 1 ? markParts[1] : markParts[0];
      var markedUnit = sideUnit(state, ctx, markWho);
      if (!markedUnit) return 0;
      return B.state.markOf(markedUnit, markKey);
    }
    if (expr.minus) {
      return evalValue(state, ctx, expr.minus[0]) - evalValue(state, ctx, expr.minus[1]);
    }
    throw new Error("无法解析的数值表达式：" + JSON.stringify(expr));
  }

  function durationOf(spec) {
    if (spec == null) return null;
    if (typeof spec === "number") return { unit: "standard", count: spec };
    return { unit: spec.unit || "standard", count: Number(spec.count) || 0 };
  }

  function sourceTag(ctx) {
    return (ctx.skillId || "effect") + "#" + (ctx.sourceUid || "");
  }

  function counterKey(ctx, key, perTarget) {
    return "ctr." + key + "." + (perTarget ? (ctx.targetUid || "*") : "*");
  }

  function resolveDamageType(state, ctx, op) {
    if (op.typeFrom === "self.lastDamageType" || op.type === "last") {
      var self = sideUnit(state, ctx, "self");
      var last = self && self.lastDamageType ? self.lastDamageType : "phys";
      return last;
    }
    if (op.type === "basic") {
      var caster = sideUnit(state, ctx, "self");
      return caster ? B.traits.basicType(caster) : "phys";
    }
    return op.type || "phys";
  }

  function addStat(state, ctx, op, events) {
    var targets = sideUnits(state, ctx, op.who || "target");
    for (var ti = 0; ti < targets.length; ti++) {
      var target = targets[ti];
      var tctx = ctxFor(ctx, target);
      var before = B.state.statOf(target, op.stat);
      var spec = durationOf(op.duration);
      var mod = B.state.addMod(target, {
        stat: op.stat,
        mode: op.mode || "add",
        value: op.value == null ? 0 : evalValue(state, tctx, op.value),
        remain: spec ? spec.count : B.state.PERMANENT,
        unit: spec ? spec.unit : "standard",
        source: sourceTag(tctx),
        label: tctx.label || ""
      });
      pushEvent(state, events, {
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

  function addBuff(state, ctx, op, events) {
    var targets = sideUnits(state, ctx, op.who || "target");
    for (var ti = 0; ti < targets.length; ti++) {
      var target = targets[ti];
      var tctx = ctxFor(ctx, target);
      var immune = B.skills && B.skills.immuneBuffs ? B.skills.immuneBuffs(target) : [];
      if (op.kind && immune.indexOf(op.kind) >= 0) {
        pushEvent(state, events, {
          type: "buffImmune",
          uid: target.uid,
          kind: op.kind,
          percent: evalValue(state, tctx, op.percent),
          label: tctx.label || "",
          blocked: true
        });
        continue;
      }
      if (op.kind && DEBUFF_KINDS[op.kind] && target.reflect) {
        target = sideUnit(state, tctx, "self");
        if (!target) continue;
        pushEvent(state, events, { type: "reflect", uid: target.uid, kind: "buff", detail: op.kind });
      }
      var spec = durationOf(op.duration);
      var entry = B.state.addBuff(target, {
        kind: op.kind,
        percent: op.percent == null ? 0 : evalValue(state, tctx, op.percent),
        remain: spec ? spec.count : 0,
        unit: spec ? spec.unit : "standard",
        source: sourceTag(tctx),
        label: tctx.label || "",
        stacking: op.stacking !== false
      });
      pushEvent(state, events, {
        type: "buffAdd",
        uid: target.uid,
        kind: entry.kind,
        percent: entry.percent,
        remain: entry.remain,
        skillId: tctx.skillId || ""
      });
    }
  }

  function addStatus(state, ctx, op, events) {
    var targets = sideUnits(state, ctx, op.who || "target");
    for (var ti = 0; ti < targets.length; ti++) {
      var target = targets[ti];
      var tctx = ctxFor(ctx, target);
      if (STATUS_DEBUFF[op.kind] && target.reflect) {
        target = sideUnit(state, tctx, "self");
        if (!target) continue;
        pushEvent(state, events, { type: "reflect", uid: target.uid, kind: "status", detail: op.kind });
      }
      var spec = durationOf(op.duration || op.rounds);
      var label = op.label || tctx.label || "";
      var entry = op.kind === "break"
        ? B.state.enterBreak(target, spec ? spec.count : 0, sourceTag(tctx), label)
        : B.state.addStatus(target, {
          kind: op.kind,
          remain: spec ? spec.count : 0,
          unit: spec ? spec.unit : "standard",
          source: sourceTag(tctx),
          skillId: op.skillId || "",
          label: label
        });
      pushEvent(state, events, {
        type: "statusAdd",
        uid: target.uid,
        kind: entry.kind,
        remain: entry.remain,
        label: entry.label,
        skillId: entry.skillId || ""
      });
    }
  }

  function addTick(state, ctx, op, events) {
    var targets = sideUnits(state, ctx, op.who || op.on || "target");
    for (var ti = 0; ti < targets.length; ti++) {
      var target = targets[ti];
      var tctx = ctxFor(ctx, target);
      var spec = durationOf(op.duration);
      state.effectSeq = (state.effectSeq || 0) + 1;
      var effect = {
        id: "ef" + state.effectSeq,
        remain: op.permanent ? B.state.PERMANENT : (spec ? spec.count : 1),
        unit: spec ? spec.unit : "standard",
        unstoppable: !!op.unstoppable,
        label: op.label || tctx.label || "",
        desc: op.desc || "",
        gate: op.gate || null,
        period: Number(op.period) || 0,
        breakOnSourceStatus: op.breakOnSourceStatus || null,
        ops: op.ops || [],
        sourceUid: tctx.sourceUid,
        targetUid: target.uid,
        skillId: tctx.skillId || "",
        fromBuff: !!op.fromBuff,
        bornRound: Math.max(1, state.round)
      };
      target.effects.push(effect);
      pushEvent(state, events, {
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

  function runDice(state, ctx, op, events) {
    var sides = op.sides || B.rules.CONFIG.diceSides;
    var repeat = Math.max(1, Math.floor(Number(op.times) || 1));
    var last = 0;
    for (var r = 0; r < repeat; r++) {
      if (state.phase === "finished") return last;
      var roll = B.rng.dice(state, sides);
      last = roll;
      pushEvent(state, events, { type: "dice", uid: ctx.sourceUid, sides: sides, value: roll, label: op.label || "", skillId: ctx.skillId || "" });
      var cases = op.cases || [];
      var hit = false;
      for (var i = 0; i < cases.length; i++) {
        var item = cases[i];
        var hitCase = false;
        if (item.in && item.in.length === 2) hitCase = roll >= item.in[0] && roll <= item.in[1];
        else if (item.in) hitCase = item.in.indexOf(roll) >= 0;
        else if (item.roll != null) hitCase = item.roll === roll;
        if (hitCase) {
          runOps(state, ctx, item.ops || [], events);
          hit = true;
          break;
        }
      }
      if (!hit && op.else) runOps(state, ctx, op.else, events);
    }
    return last;
  }

  /* 行动前掷骰：身上挂着带 gate 的持续效果时，掷出 cancel 里的点数就跳过这次行动。
     被跳过的行动仍然消耗（不补），由 actions.execute 直接返回。 */
  function actionGate(state, unit, events) {
    var list = unit && unit.effects ? unit.effects : [];
    for (var i = 0; i < list.length; i++) {
      var effect = list[i];
      var gate = effect.gate;
      if (!gate) continue;
      var sides = gate.sides || B.rules.CONFIG.diceSides;
      var roll = B.rng.dice(state, sides);
      pushEvent(state, events, {
        type: "dice",
        uid: unit.uid,
        sides: sides,
        value: roll,
        label: effect.label || "",
        skillId: effect.skillId || ""
      });
      var cancel = gate.cancel || [];
      if (cancel.indexOf(roll) >= 0) {
        pushEvent(state, events, {
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

  function runIf(state, ctx, op, events) {
    var cond = op.cond || {};
    var ok = false;
    if (cond.gender) {
      var holder = sideUnit(state, ctx, cond.gender === "target" ? "target" : "self");
      var gender = holder ? holder.gender : "";
      if (cond.ne != null) ok = gender !== cond.ne;
      else ok = gender === (cond.eq != null ? cond.eq : cond.value);
    } else if (cond.status) {
      var owner = sideUnit(state, ctx, cond.who || "self");
      ok = !!owner && B.state.hasStatus(owner, cond.status);
      if (cond.ne) ok = !ok;
    } else if (cond.summon) {
      var summonOwner = sideUnit(state, ctx, cond.who || "self");
      var found = null;
      if (summonOwner && B.summons && B.summons.findKey) {
        found = B.summons.findKey(state, B.state.sideOf(state, summonOwner.uid), cond.summon);
      }
      ok = !!found;
      if (cond.ne) ok = !ok;
    } else if (cond.summonCount) {
      var scOwner = sideUnit(state, ctx, cond.who || "self");
      var scCount = scOwner && B.summons ? B.summons.ofSide(state, B.state.sideOf(state, scOwner.uid)).length : 0;
      var sc = cond.summonCount;
      if (sc.op === "lt") ok = scCount < sc.right;
      else if (sc.op === "le") ok = scCount <= sc.right;
      else if (sc.op === "gt") ok = scCount > sc.right;
      else if (sc.op === "ge") ok = scCount >= sc.right;
      else if (sc.op === "eq") ok = scCount === sc.right;
      else ok = false;
    } else {
      var left = evalValue(state, ctx, cond.left);
      var right = evalValue(state, ctx, cond.right);
      if (cond.op === "lt") ok = left < right;
      else if (cond.op === "le") ok = left <= right;
      else if (cond.op === "gt") ok = left > right;
      else if (cond.op === "ge") ok = left >= right;
      else if (cond.op === "eq") ok = left === right;
      else if (cond.op === "ne") ok = left !== right;
      else throw new Error("未知的比较方式：" + cond.op);
    }
    if (ok) runOps(state, ctx, op.then || [], events);
    else runOps(state, ctx, op.else || [], events);
  }

  function runDispel(state, ctx, op, events) {
    var targets = sideUnits(state, ctx, op.who || "target");
    for (var ti = 0; ti < targets.length; ti++) {
      var target = targets[ti];
      var tctx = ctxFor(ctx, target);
      var removed = [];
      if (op.scope === "debuff" || op.scope === "all") {
        target.buffs = target.buffs.filter(function (b) {
          if (DEBUFF_KINDS[b.kind]) {
            removed.push(b.kind);
            return false;
          }
          return true;
        });
        target.statuses = target.statuses.filter(function (s) {
          if (STATUS_DEBUFF[s.kind]) {
            removed.push(s.kind);
            return false;
          }
          return true;
        });
        target.mods = target.mods.filter(function (m) {
          if (m.mode === "add" && m.value < 0) {
            removed.push("mod:" + m.stat);
            return false;
          }
          return true;
        });
      }
      if (op.scope === "breakValue") {
        target.breakValue = 0;
        removed.push("breakValue");
      }
      if (op.scope === "marks") {
        var markKeys = Object.keys(target.marks || {});
        for (var mk = 0; mk < markKeys.length; mk++) {
          target.marks[markKeys[mk]].value = 0;
          removed.push(markKeys[mk]);
        }
      }
      pushEvent(state, events, { type: "dispel", uid: target.uid, scope: op.scope || "debuff", removed: removed, skillId: tctx.skillId || "" });
    }
  }

  function runInterrupt(state, ctx, op, events) {
    var target = sideUnit(state, ctx, op.who || "target");
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
    pushEvent(state, events, { type: "interrupt", uid: target.uid, removed: removed, skillId: ctx.skillId || "" });
  }

  function runSchedule(state, ctx, op, events) {
    var target = sideUnit(state, ctx, op.on || "self");
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
    pushEvent(state, events, {
      type: "schedule",
      uid: target.uid,
      scheduleId: effect.id,
      atRound: effect.atRound,
      label: effect.label,
      skillId: ctx.skillId || ""
    });
  }

  function runOp(state, ctx, op, events) {
    if (!op || !op.op) throw new Error("op 缺少 op 字段");
    var target;
    switch (op.op) {
      case "damage": {
        var dmgTargets = sideUnits(state, ctx, op.who || "target");
        var type = resolveDamageType(state, ctx, op);
        var factor = op.factor == null ? 1 : Number(op.factor);
        for (var di = 0; di < dmgTargets.length; di++) {
          var dt = dmgTargets[di];
          var dctx = ctxFor(ctx, dt);
          var times = 1;
          if (op.times && typeof op.times === "object" && op.times.input) {
            var inputBase = dctx.input && dctx.input[op.times.input] != null
              ? Number(dctx.input[op.times.input])
              : 0;
            times = Math.max(0, Math.floor(inputBase * (op.times.factor == null ? 1 : Number(op.times.factor))));
          } else {
            times = Number(op.times) || 1;
          }
          for (var i = 0; i < times; i++) {
            if (state.phase === "finished") return;
            B.damage.hit(state, {
              sourceUid: dctx.sourceUid,
              targetUid: dt.uid,
              type: type,
              amount: evalValue(state, dctx, op.value) * factor,
              noBreak: !!op.noBreak,
              noStun: !!op.noStun,
              fromBuff: !!(op.fromBuff || dctx.fromBuff),
              healBack: !!op.healBack,
              skillId: dctx.skillId || "",
              label: dctx.label || ""
            }, events);
          }
        }
        return;
      }
      case "directLoss": {
        var lossTargets = sideUnits(state, ctx, op.who || "target");
        for (var li = 0; li < lossTargets.length; li++) {
          var lt = lossTargets[li];
          var lctx = ctxFor(ctx, lt);
          B.damage.directLoss(state, {
            sourceUid: lctx.sourceUid,
            targetUid: lt.uid,
            amount: evalValue(state, lctx, op.value),
            skillId: lctx.skillId || "",
            label: lctx.label || ""
          }, events);
        }
        return;
      }
      case "heal": {
        var healTargets = sideUnits(state, ctx, op.who || "self");
        for (var hi = 0; hi < healTargets.length; hi++) {
          var ht = healTargets[hi];
          var hctx = ctxFor(ctx, ht);
          var base = evalValue(state, hctx, op.value);
          var rounding = op.rounding || "round5";
          if (rounding === "round5") base = B.rules.round5(base);
          else if (rounding === "int") base = B.rules.ceilTo(base, 1);
          else if (rounding === "ten") base = B.rules.ceilTo(base, 10);
          var total = base + (op.bonus == null ? 0 : evalValue(state, hctx, op.bonus));
          B.damage.heal(state, {
            uid: ht.uid,
            amount: total,
            rounding: "none",
            skillId: hctx.skillId || "",
            label: op.label || hctx.label || ""
          }, events);
        }
        return;
      }
      case "healFull": {
        var fullTargets = sideUnits(state, ctx, op.who || "self");
        for (var fi = 0; fi < fullTargets.length; fi++) {
          var ft = fullTargets[fi];
          B.damage.healFull(state, { uid: ft.uid, skillId: ctx.skillId || "", label: ctx.label || "" }, events);
        }
        return;
      }
      case "mp": {
        var mpTargets = sideUnits(state, ctx, op.who || "self");
        for (var mi = 0; mi < mpTargets.length; mi++) {
          var mt = mpTargets[mi];
          var mctx = ctxFor(ctx, mt);
          var delta = evalValue(state, mctx, op.delta);
          var before = mt.mp;
          mt.mp = B.rules.clamp(mt.mp + delta, 0, B.state.maxMpOf(mt));
          pushEvent(state, events, { type: "mp", uid: mt.uid, delta: mt.mp - before, mp: mt.mp, skillId: mctx.skillId || "" });
        }
        return;
      }
      case "maxHp":
      case "maxMp": {
        var capTargets = sideUnits(state, ctx, op.who || "target");
        var stat = op.op === "maxHp" ? "maxHp" : "maxMp";
        for (var ci = 0; ci < capTargets.length; ci++) {
          var ct = capTargets[ci];
          var cctx = ctxFor(ctx, ct);
          var value = op.percent != null
            ? statValue(state, ct, stat) * (Number(op.percent) || 0) / 100
            : evalValue(state, cctx, op.delta);
          var added = B.state.addMod(ct, {
            stat: stat,
            mode: "add",
            value: value,
            remain: B.state.PERMANENT,
            source: sourceTag(cctx),
            label: cctx.label || ""
          });
          if (stat === "maxHp") B.state.clampHpToMax(ct);
          if (stat === "maxMp") ct.mp = Math.min(ct.mp, B.state.maxMpOf(ct));
          pushEvent(state, events, { type: "stat", uid: ct.uid, stat: stat, mode: "add", value: added.value, remain: -1, skillId: cctx.skillId || "" });
          if (added.value < 0 && ct.uid !== (cctx.ownerUid || cctx.sourceUid) && B.skills && B.skills.runHooks) {
            B.skills.runHooks(state, ct, "statDrained", {
              sourceUid: cctx.ownerUid || cctx.sourceUid,
              targetUid: ct.uid,
              skillId: "passive.statDrained",
              label: "属性削弱",
              stat: stat,
              value: -added.value
            }, events);
          }
        }
        return;
      }
      case "stat": {
        addStat(state, ctx, op, events);
        return;
      }
      case "buff": {
        addBuff(state, ctx, op, events);
        return;
      }
      case "status": {
        addStatus(state, ctx, op, events);
        return;
      }
      case "breakValue":
      case "stunValue": {
        target = sideUnit(state, ctx, op.who || "target");
        if (!target) return;
        var key = op.op === "breakValue" ? "breakValue" : "stunValue";
        var cap = B.rules.CONFIG[key === "breakValue" ? "breakValueMax" : "stunValueMax"];
        target[key] = B.rules.clamp(target[key] + evalValue(state, ctx, op.delta), 0, cap);
        pushEvent(state, events, { type: key, uid: target.uid, value: target[key] });
        return;
      }
      case "forceBreak": {
        target = sideUnit(state, ctx, op.who || "target");
        if (!target) return;
        var rounds = B.rules.breakRounds(target.breakValue);
        if (rounds <= 0) return;
        var breakStatus = B.state.enterBreak(target, rounds, sourceTag(ctx), "击溃");
        pushEvent(state, events, {
          type: "statusAdd",
          uid: target.uid,
          kind: "break",
          remain: breakStatus.remain,
          label: "击溃",
          skillId: ctx.skillId || ""
        });
        return;
      }
      case "dice": {
        runDice(state, ctx, op, events);
        return;
      }
      case "roll": {
        var sides = Number(op.sides) || B.rules.CONFIG.diceSides;
        var roll = B.rng.dice(state, sides);
        var roller = sideUnit(state, ctx, op.who || "self");
        if (!roller) return;
        roller.flags[counterKey(ctx, op.key || "roll", op.perTarget !== false)] = roll;
        pushEvent(state, events, {
          type: "dice",
          uid: roller.uid,
          sides: sides,
          value: roll,
          label: op.label || ctx.label || "",
          key: op.key || "roll",
          skillId: ctx.skillId || ""
        });
        return;
      }
      case "strike": {
        var striker = sideUnit(state, ctx, op.who || "self");
        if (!striker || state.phase === "finished") return;
        var victimUid = op.target === "source"
          ? ctx.sourceUid
          : (ctx.ownerUid && ctx.ownerUid !== ctx.sourceUid ? ctx.sourceUid : ctx.targetUid);
        var victim = tryUnit(state, victimUid);
        if (!victim) return;
        if (B.actions && B.actions.strike) {
          B.actions.strike(state, striker, victim, events, {
            noBreak: !!op.noBreak,
            label: op.label || ctx.label || "普攻"
          });
        }
        return;
      }
      case "deny": {
        if (ctx) {
          ctx.denied = true;
          ctx.reason = op.reason || "无法进行这个动作";
        }
        return;
      }
      case "if": {
        runIf(state, ctx, op, events);
        return;
      }
      case "dispel": {
        runDispel(state, ctx, op, events);
        return;
      }
      case "tick": {
        addTick(state, ctx, op, events);
        return;
      }
      case "reflect": {
        target = sideUnit(state, ctx, op.who || "self");
        if (!target) return;
        target.reflect = {
          factor: Number(op.factor) || 2,
          stunRounds: Number(op.stunRounds) || 0,
          sourceSkillId: ctx.skillId || ""
        };
        if (target.charge) target.charge.indestructible = true;
        pushEvent(state, events, { type: "reflectOn", uid: target.uid, factor: target.reflect.factor, skillId: ctx.skillId || "" });
        return;
      }
      case "interrupt": {
        runInterrupt(state, ctx, op, events);
        return;
      }
      case "schedule": {
        runSchedule(state, ctx, op, events);
        return;
      }
      case "mark": {
        target = sideUnit(state, ctx, op.who || "self");
        if (!target || !target.marks || !target.marks[op.key]) return;
        var markDef = target.marks[op.key];
        if (op.mode === "set" && op.value != null) markDef.value = evalValue(state, ctx, op.value);
        else markDef.value = markDef.value + (op.delta == null ? 1 : Number(op.delta));
        markDef.value = B.rules.clamp(markDef.value, 0, markDef.max);
        pushEvent(state, events, {
          type: "mark",
          uid: target.uid,
          key: op.key,
          name: markDef.name,
          value: markDef.value,
          max: markDef.max,
          hideMax: !!markDef.hideMax,
          skillId: ctx.skillId || ""
        });
        return;
      }
      case "markClear": {
        target = sideUnit(state, ctx, op.who || "target");
        if (!target || !target.marks) return;
        var keys = op.key ? [op.key] : Object.keys(target.marks);
        for (var mk = 0; mk < keys.length; mk++) {
          if (!target.marks[keys[mk]]) continue;
          target.marks[keys[mk]].value = 0;
          pushEvent(state, events, {
            type: "mark",
            uid: target.uid,
            key: keys[mk],
            name: target.marks[keys[mk]].name,
            value: 0,
            max: target.marks[keys[mk]].max,
            hideMax: !!target.marks[keys[mk]].hideMax,
            skillId: ctx.skillId || ""
          });
        }
        return;
      }
      case "taunt": {
        target = sideUnit(state, ctx, op.who || "self");
        if (!target) return;
        target.taunt += Number(op.delta) || 0;
        pushEvent(state, events, { type: "taunt", uid: target.uid, value: target.taunt, skillId: ctx.skillId || "" });
        return;
      }
      case "counter": {
        var holder = sideUnit(state, ctx, op.who || "self");
        if (!holder) return;
        var ckey = counterKey(ctx, op.key, op.perTarget !== false);
        holder.flags[ckey] = (holder.flags[ckey] || 0) + (op.delta == null ? 1 : Number(op.delta));
        pushEvent(state, events, { type: "counter", uid: holder.uid, key: op.key, value: holder.flags[ckey], skillId: ctx.skillId || "" });
        return;
      }
      case "use": {
        var ref = B.skills && B.skills.find ? B.skills.find(op.skillId) : null;
        if (!ref) throw new Error("引用的技能不存在：" + op.skillId);
        var repeat = Number(op.times) || 1;
        for (var r = 0; r < repeat; r++) {
          if (state.phase === "finished") return;
          runOps(state, ctx, ref.ops, events);
        }
        return;
      }
      case "setBasicMod": {
        if (!ctx.mod) return;
        if (op.type) ctx.mod.type = op.type;
        if (op.factor != null) ctx.mod.factor = Number(op.factor);
        if (op.healInstead) ctx.mod.healInstead = true;
        if (op.hits != null) ctx.mod.hits = Number(op.hits);
        if (op.noBreak) ctx.mod.noBreak = true;
        if (op.misfire) ctx.mod.misfire = true;
        return;
      }
      case "clearMods": {
        var modTargets = sideUnits(state, ctx, op.who || "self");
        for (var cmi = 0; cmi < modTargets.length; cmi++) {
          var cmTarget = modTargets[cmi];
          B.state.removeModsBySource(cmTarget, op.source || sourceTag(ctx), op.stats);
          pushEvent(state, events, {
            type: "dispel",
            uid: cmTarget.uid,
            scope: "mods",
            removed: [op.source || sourceTag(ctx)],
            skillId: ctx.skillId || ""
          });
        }
        return;
      }
      case "summon": {
        var summoner = sideUnit(state, ctx, op.who || "self");
        if (!summoner || !B.summons || !B.summons.create) return;
        B.summons.create(state, op.key, summoner, events, { ttl: op.ttl });
        return;
      }
      case "setBasicMode": {
        if (!ctx.mode) ctx.mode = {};
        if (op.healSummon) ctx.mode.healSummonKey = op.healSummon;
        if (op.mode) ctx.mode.mode = op.mode;
        return;
      }
      case "dodge": {
        if (ctx) ctx.dodge = true;
        return;
      }
      case "note": {
        pushEvent(state, events, { type: "note", uid: ctx.sourceUid, text: op.text || "", skillId: ctx.skillId || "" });
        return;
      }
      default:
        throw new Error("未知的 op：" + op.op);
    }
  }

  function runOps(state, ctx, ops, events) {
    if (!ops) return;
    for (var i = 0; i < ops.length; i++) {
      if (state.phase === "finished") return;
      runOp(state, ctx, ops[i], events);
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
      pushEvent(state, events, { type: kind + "Expire", uid: uid, kind: item.kind || item.stat || "", label: item.label || "" });
    }
    return kept;
  }

  function dropBrokenEffects(state, unit, events) {
    var kept = [];
    for (var i = 0; i < unit.effects.length; i++) {
      var effect = unit.effects[i];
      if (effect.breakOnSourceStatus && effect.sourceUid) {
        var src = tryUnit(state, effect.sourceUid);
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
          pushEvent(state, events, {
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
        runOps(state, ctxOfEffect(active[e]), active[e].ops, events);
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
        runOps(state, ctxOfEffect(due[d]), due[d].ops, events);
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
        runOps(state, ctxOfEffect(sEffects[se]), sEffects[se].ops, events);
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
        runOps(state, ctxOfEffect(sDue[sd]), sDue[sd].ops, events);
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
        runOps(state, ctxOfEffect(active[i]), active[i].ops, events);
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
      pushEvent(state, events, { type: kind + "Expire", uid: unit.uid, kind: item.kind || item.stat || "", label: item.label || "" });
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
        pushEvent(state, events, {
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

  api.runOps = runOps;
  api.runOp = runOp;
  api.actionGate = actionGate;
  api.valueOf = valueOf;
  api.statValue = statValue;
  api.roundStart = roundStart;
  api.roundEnd = roundEnd;
  api.turnEnd = turnEnd;
  api.ctxOfEffect = ctxOfEffect;

  if (typeof module === "object" && module.exports) module.exports = B;
})(typeof globalThis !== "undefined" ? globalThis : this);

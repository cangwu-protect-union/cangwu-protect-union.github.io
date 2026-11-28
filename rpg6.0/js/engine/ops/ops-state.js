/* 回合制正传 6.0 · 战斗引擎 · 效果解释器 · 资源与状态类 op
   只做 registerOp，跟在 effect-ops.js 与 effect-ops-helpers.js 之后加载。 */
(function (root) {
  "use strict";
  var B = root.RPG6B || (root.RPG6B = {});
  var api = B.effectOps || (B.effectOps = {});
  var H = api._helpers || {};

  api.registerOp("mp", function (state, ctx, op, events) {

        var mpTargets = H.sideUnits(state, ctx, op.who || "self");
        for (var mi = 0; mi < mpTargets.length; mi++) {
          var mt = mpTargets[mi];
          var mctx = H.ctxFor(ctx, mt);
          var delta = H.evalValue(state, mctx, op.delta);
          var before = mt.mp;
          mt.mp = B.rules.clamp(mt.mp + delta, 0, B.state.maxMpOf(mt));
          H.pushEvent(state, events, { type: "mp", uid: mt.uid, delta: mt.mp - before, mp: mt.mp, skillId: mctx.skillId || "" });
        }
        return;
      
  });

  api.registerOp("maxHp", function (state, ctx, op, events) {
    var target;

        var capTargets = H.sideUnits(state, ctx, op.who || "target");
        var stat = op.op === "maxHp" ? "maxHp" : "maxMp";
        for (var ci = 0; ci < capTargets.length; ci++) {
          var ct = capTargets[ci];
          var cctx = H.ctxFor(ctx, ct);
          var value = op.percent != null
            ? H.statValue(state, ct, stat) * (Number(op.percent) || 0) / 100
            : H.evalValue(state, cctx, op.delta);
          if (B.state.strongImmune && B.state.strongImmune(ct) && cctx.sourceUid !== ct.uid && value < 0) {
            H.pushEvent(state, events, { type: "strongImmune", uid: ct.uid, sourceUid: cctx.sourceUid, stat: stat, label: cctx.label || "" });
            continue;
          }
          var added = B.state.addMod(ct, {
            stat: stat,
            mode: "add",
            value: value,
            remain: B.state.PERMANENT,
            source: H.sourceTag(cctx),
            label: cctx.label || "",
            untilRecast: op.untilRecast || "",
            debuff: !!op.debuff
          });
          if (stat === "maxHp") B.state.clampHpToMax(ct);
          if (stat === "maxMp") ct.mp = Math.min(ct.mp, B.state.maxMpOf(ct));
          H.pushEvent(state, events, { type: "stat", uid: ct.uid, stat: stat, mode: "add", value: added.value, remain: -1, skillId: cctx.skillId || "" });
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
      
  });

  api.registerOp("maxMp", function (state, ctx, op, events) {
    var target;

        var capTargets = H.sideUnits(state, ctx, op.who || "target");
        var stat = op.op === "maxHp" ? "maxHp" : "maxMp";
        for (var ci = 0; ci < capTargets.length; ci++) {
          var ct = capTargets[ci];
          var cctx = H.ctxFor(ctx, ct);
          var value = op.percent != null
            ? H.statValue(state, ct, stat) * (Number(op.percent) || 0) / 100
            : H.evalValue(state, cctx, op.delta);
          if (B.state.strongImmune && B.state.strongImmune(ct) && cctx.sourceUid !== ct.uid && value < 0) {
            H.pushEvent(state, events, { type: "strongImmune", uid: ct.uid, sourceUid: cctx.sourceUid, stat: stat, label: cctx.label || "" });
            continue;
          }
          var added = B.state.addMod(ct, {
            stat: stat,
            mode: "add",
            value: value,
            remain: B.state.PERMANENT,
            source: H.sourceTag(cctx),
            label: cctx.label || "",
            untilRecast: op.untilRecast || "",
            debuff: !!op.debuff
          });
          if (stat === "maxHp") B.state.clampHpToMax(ct);
          if (stat === "maxMp") ct.mp = Math.min(ct.mp, B.state.maxMpOf(ct));
          H.pushEvent(state, events, { type: "stat", uid: ct.uid, stat: stat, mode: "add", value: added.value, remain: -1, skillId: cctx.skillId || "" });
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
      
  });

  api.registerOp("stat", function (state, ctx, op, events) {

        H.addStat(state, ctx, op, events);
        return;
      
  });

  api.registerOp("buff", function (state, ctx, op, events) {

        H.addBuff(state, ctx, op, events);
        return;
      
  });

  api.registerOp("status", function (state, ctx, op, events) {

        H.addStatus(state, ctx, op, events);
        return;
      
  });

  api.registerOp("clearMods", function (state, ctx, op, events) {

        var modTargets = H.sideUnits(state, ctx, op.who || "self");
        for (var cmi = 0; cmi < modTargets.length; cmi++) {
          var cmTarget = modTargets[cmi];
          B.state.removeModsBySource(cmTarget, op.source || H.sourceTag(ctx), op.stats);
          H.pushEvent(state, events, {
            type: "dispel",
            uid: cmTarget.uid,
            scope: "mods",
            removed: [op.source || H.sourceTag(ctx)],
            skillId: ctx.skillId || ""
          });
        }
        return;
      
  });

  api.registerOp("taunt", function (state, ctx, op, events) {
    var target;

        target = H.sideUnit(state, ctx, op.who || "self");
        if (!target) return;
        target.taunt += Number(op.delta) || 0;
        H.pushEvent(state, events, { type: "taunt", uid: target.uid, value: target.taunt, skillId: ctx.skillId || "" });
        return;
      
  });

  api.registerOp("mark", function (state, ctx, op, events) {
    var target;

        target = H.sideUnit(state, ctx, op.who || "self");
        if (!target || !target.marks || !target.marks[op.key]) return;
        var markDef = target.marks[op.key];
        if (op.mode === "set" && op.value != null) markDef.value = H.evalValue(state, ctx, op.value);
        else markDef.value = markDef.value + (op.delta == null ? 1 : H.evalValue(state, ctx, op.delta));
        markDef.value = B.rules.clamp(markDef.value, 0, markDef.max);
        H.pushEvent(state, events, {
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
      
  });

  api.registerOp("markClear", function (state, ctx, op, events) {
    var target;

        target = H.sideUnit(state, ctx, op.who || "target");
        if (!target || !target.marks) return;
        var keys = op.key ? [op.key] : Object.keys(target.marks);
        for (var mk = 0; mk < keys.length; mk++) {
          if (!target.marks[keys[mk]]) continue;
          target.marks[keys[mk]].value = 0;
          H.pushEvent(state, events, {
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
      
  });

  api.registerOp("counter", function (state, ctx, op, events) {

        var holder = H.sideUnit(state, ctx, op.who || "self");
        if (!holder) return;
        var ckey = H.counterKey(ctx, op.key, op.perTarget !== false);
        var delta = op.delta == null ? 1 : H.evalValue(state, ctx, op.delta);
        holder.flags[ckey] = (holder.flags[ckey] || 0) + delta;
        H.pushEvent(state, events, { type: "counter", uid: holder.uid, key: op.key, value: holder.flags[ckey], skillId: ctx.skillId || "" });
        return;
      
  });

  /* 驱散（scope：debuff/all/status/marked/breakValue/marks）。
     status 清异常状态（E7），marked 清带 debuff 标记的修正与效果（E11）。 */
  function runDispel(state, ctx, op, events) {
    var targets = H.sideUnits(state, ctx, op.who || "target");
    for (var ti = 0; ti < targets.length; ti++) {
      var target = targets[ti];
      var tctx = H.ctxFor(ctx, target);
      var removed = [];
      if (op.scope === "debuff" || op.scope === "all") {
        target.buffs = target.buffs.filter(function (b) {
          if (H.DEBUFF_KINDS[b.kind]) {
            removed.push(b.kind);
            return false;
          }
          return true;
        });
        target.statuses = target.statuses.filter(function (s) {
          if (H.STATUS_DEBUFF[s.kind]) {
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
      if (op.scope === "status") {
        target.statuses = target.statuses.filter(function (s) {
          if (H.STATUS_CLEAR[s.kind]) {
            removed.push(s.kind);
            return false;
          }
          return true;
        });
      }
      if (op.scope === "marked") {
        target.mods = target.mods.filter(function (m) {
          if (m.debuff) {
            removed.push("mod:" + m.stat);
            return false;
          }
          return true;
        });
        target.effects = target.effects.filter(function (e) {
          if (e.debuff) {
            removed.push(e.label || e.key || "effect");
            H.pushEvent(state, events, {
              type: "effectExpire",
              uid: target.uid,
              kind: "effect",
              label: e.label || ""
            });
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
      H.pushEvent(state, events, { type: "dispel", uid: target.uid, scope: op.scope || "debuff", removed: removed, skillId: tctx.skillId || "" });
    }
  }

  api.registerOp("dispel", function (state, ctx, op, events) {

        runDispel(state, ctx, op, events);
        return;
      
  });

  /* 护盾：独立血量池，伤害全额吸收（damage.hit 里处理），标准回合末计时，
     到期时移除并执行 onExpire（杨冬明「坚若磐石」加防）。 */
  api.registerOp("shield", function (state, ctx, op, events) {

        var targets = H.sideUnits(state, ctx, op.who || "self");
        for (var si = 0; si < targets.length; si++) {
          var target = targets[si];
          var tctx = H.ctxFor(ctx, target);
          var hp = H.evalValue(state, tctx, op.hp == null ? 0 : op.hp);
          if (hp <= 0) continue;
          target.shield = {
            hp: hp,
            max: hp,
            remain: Math.max(1, Number(op.duration) || 1),
            ops: op.onExpire || [],
            source: H.sourceTag(tctx),
            label: op.label || tctx.label || "护盾",
            skillId: tctx.skillId || "",
            bornRound: Math.max(1, state.round)
          };
          H.pushEvent(state, events, {
            type: "shieldAdd",
            uid: target.uid,
            hp: hp,
            remain: target.shield.remain,
            label: target.shield.label,
            skillId: tctx.skillId || ""
          });
        }
        return;
      
  });

  /* 可复原态（E2）：按 key 移除持续效果，并把 untilRecast 标记为该 key 的属性修正一并回滚。
     再次释放「剃发为僧」走这里：防/血上限/速回到基础值、普攻类型复原，功德保留。 */
  api.registerOp("removeEffect", function (state, ctx, op, events) {

        var rmTargets = H.sideUnits(state, ctx, op.who || "self");
        for (var ri = 0; ri < rmTargets.length; ri++) {
          var rt = rmTargets[ri];
          var kept = [];
          var removedCount = 0;
          for (var e = 0; e < rt.effects.length; e++) {
            if (rt.effects[e].key === op.key) {
              H.pushEvent(state, events, {
                type: "effectExpire",
                uid: rt.uid,
                kind: "effect",
                label: rt.effects[e].label || op.key,
                skillId: rt.effects[e].skillId || ""
              });
              removedCount += 1;
            } else {
              kept.push(rt.effects[e]);
            }
          }
          rt.effects = kept;
          var keptMods = [];
          for (var m = 0; m < rt.mods.length; m++) {
            if (rt.mods[m].untilRecast === op.key) {
              H.pushEvent(state, events, {
                type: "modExpire",
                uid: rt.uid,
                kind: rt.mods[m].stat,
                label: rt.mods[m].label || op.key
              });
            } else {
              keptMods.push(rt.mods[m]);
            }
          }
          rt.mods = keptMods;
          B.state.clampHpToMax(rt);
          H.pushEvent(state, events, {
            type: "dispel",
            uid: rt.uid,
            scope: "effect:" + op.key,
            removed: removedCount ? [op.key] : [],
            skillId: ctx.skillId || ""
          });
        }
        return;
      
  });

  /* 衰减（E4）：把目标身上指定 kind 的 Buff 百分比减 delta，减到 0 移除（我是天才的勇猛逐回合 −20%） */
  api.registerOp("decay", function (state, ctx, op, events) {

        var decayTargets = H.sideUnits(state, ctx, op.who || "target");
        for (var di = 0; di < decayTargets.length; di++) {
          var dt = decayTargets[di];
          var dctx = H.ctxFor(ctx, dt);
          var delta = H.evalValue(state, dctx, op.delta);
          var kept = [];
          for (var b = 0; b < dt.buffs.length; b++) {
            var buff = dt.buffs[b];
            if (buff.kind !== op.kind) {
              kept.push(buff);
              continue;
            }
            buff.percent = buff.percent - delta;
            if (buff.percent <= 0) {
              H.pushEvent(state, events, {
                type: "buffExpire",
                uid: dt.uid,
                kind: buff.kind,
                label: buff.label || ""
              });
            } else {
              kept.push(buff);
              H.pushEvent(state, events, {
                type: "buffDecay",
                uid: dt.uid,
                kind: buff.kind,
                percent: buff.percent,
                label: buff.label || ""
              });
            }
          }
          dt.buffs = kept;
        }
        return;
      
  });

  /* 伤害转血上限（E3）：配合 beforeDamage 钩子使用，把这次受击标记为「不扣血、等量加血上限」 */
  api.registerOp("convert", function (state, ctx, op, events) {

        if (ctx) ctx.convert = op.to || "";
        return;
      
  });
})(typeof globalThis !== "undefined" ? globalThis : this);

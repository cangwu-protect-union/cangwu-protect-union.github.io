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
          var added = B.state.addMod(ct, {
            stat: stat,
            mode: "add",
            value: value,
            remain: B.state.PERMANENT,
            source: H.sourceTag(cctx),
            label: cctx.label || ""
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
          var added = B.state.addMod(ct, {
            stat: stat,
            mode: "add",
            value: value,
            remain: B.state.PERMANENT,
            source: H.sourceTag(cctx),
            label: cctx.label || ""
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
        else markDef.value = markDef.value + (op.delta == null ? 1 : Number(op.delta));
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
        holder.flags[ckey] = (holder.flags[ckey] || 0) + (op.delta == null ? 1 : Number(op.delta));
        H.pushEvent(state, events, { type: "counter", uid: holder.uid, key: op.key, value: holder.flags[ckey], skillId: ctx.skillId || "" });
        return;
      
  });

  api.registerOp("dispel", function (state, ctx, op, events) {

        H.runDispel(state, ctx, op, events);
        return;
      
  });
})(typeof globalThis !== "undefined" ? globalThis : this);

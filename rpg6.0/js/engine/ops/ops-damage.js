/* 回合制正传 6.0 · 战斗引擎 · 效果解释器 · 伤害/治疗/击溃类 op
   只做 registerOp，跟在 effect-ops.js 与 effect-ops-helpers.js 之后加载。 */
(function (root) {
  "use strict";
  var B = root.RPG6B || (root.RPG6B = {});
  var api = B.effectOps || (B.effectOps = {});
  var H = api._helpers || {};

  api.registerOp("damage", function (state, ctx, op, events) {
    var target;

        var dmgTargets = H.sideUnits(state, ctx, op.who || "target");
        var type = H.resolveDamageType(state, ctx, op);
        var factor = op.factor == null ? 1 : Number(op.factor);
        for (var di = 0; di < dmgTargets.length; di++) {
          var dt = dmgTargets[di];
          var dctx = H.ctxFor(ctx, dt);
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
              amount: H.evalValue(state, dctx, op.value) * factor,
              noBreak: !!op.noBreak,
              addStun: !!op.addStun,
              fromBuff: !!(op.fromBuff || dctx.fromBuff),
              healBack: !!op.healBack,
              skillId: dctx.skillId || "",
              label: dctx.label || ""
            }, events);
          }
        }
        return;
      
  });

  api.registerOp("directLoss", function (state, ctx, op, events) {
    var target;

        var lossTargets = H.sideUnits(state, ctx, op.who || "target");
        for (var li = 0; li < lossTargets.length; li++) {
          var lt = lossTargets[li];
          var lctx = H.ctxFor(ctx, lt);
          B.damage.directLoss(state, {
            sourceUid: lctx.sourceUid,
            targetUid: lt.uid,
            amount: H.evalValue(state, lctx, op.value),
            skillId: lctx.skillId || "",
            label: lctx.label || ""
          }, events);
        }
        return;
      
  });

  api.registerOp("heal", function (state, ctx, op, events) {

        var healTargets = H.sideUnits(state, ctx, op.who || "self");
        for (var hi = 0; hi < healTargets.length; hi++) {
          var ht = healTargets[hi];
          var hctx = H.ctxFor(ctx, ht);
          var base = H.evalValue(state, hctx, op.value);
          var rounding = op.rounding || "round5";
          if (rounding === "round5") base = B.rules.round5(base);
          else if (rounding === "int") base = B.rules.ceilTo(base, 1);
          else if (rounding === "ten") base = B.rules.ceilTo(base, 10);
          var total = base + (op.bonus == null ? 0 : H.evalValue(state, hctx, op.bonus));
          B.damage.heal(state, {
            uid: ht.uid,
            amount: total,
            rounding: "none",
            skillId: hctx.skillId || "",
            label: op.label || hctx.label || ""
          }, events);
        }
        return;
      
  });

  api.registerOp("healFull", function (state, ctx, op, events) {

        var fullTargets = H.sideUnits(state, ctx, op.who || "self");
        for (var fi = 0; fi < fullTargets.length; fi++) {
          var ft = fullTargets[fi];
          B.damage.healFull(state, { uid: ft.uid, skillId: ctx.skillId || "", label: ctx.label || "" }, events);
        }
        return;
      
  });

  api.registerOp("strike", function (state, ctx, op, events) {
    var target;

        var striker = H.sideUnit(state, ctx, op.who || "self");
        if (!striker || state.phase === "finished") return;
        var victimUid = op.target === "source"
          ? ctx.sourceUid
          : (ctx.ownerUid && ctx.ownerUid !== ctx.sourceUid ? ctx.sourceUid : ctx.targetUid);
        var victim = H.tryUnit(state, victimUid);
        if (!victim) return;
        if (B.actions && B.actions.strike) {
          B.actions.strike(state, striker, victim, events, {
            noBreak: !!op.noBreak,
            label: op.label || ctx.label || "普攻"
          });
        }
        return;
      
  });

  api.registerOp("forceBreak", function (state, ctx, op, events) {
    var target;

        target = H.sideUnit(state, ctx, op.who || "target");
        if (!target) return;
        var rounds = B.rules.breakRounds(target.breakValue);
        if (rounds <= 0) return;
        var breakStatus = B.state.enterBreak(target, rounds, H.sourceTag(ctx), "击溃");
        H.pushEvent(state, events, {
          type: "statusAdd",
          uid: target.uid,
          kind: "break",
          remain: breakStatus.remain,
          label: "击溃",
          skillId: ctx.skillId || ""
        });
        return;
      
  });

  api.registerOp("breakValue", function (state, ctx, op, events) {
    var target;

        target = H.sideUnit(state, ctx, op.who || "target");
        if (!target) return;
        var key = op.op === "breakValue" ? "breakValue" : "stunValue";
        var cap = B.rules.CONFIG[key === "breakValue" ? "breakValueMax" : "stunValueMax"];
        target[key] = B.rules.clamp(target[key] + H.evalValue(state, ctx, op.delta), 0, cap);
        H.pushEvent(state, events, { type: key, uid: target.uid, value: target[key] });
        return;
      
  });

  api.registerOp("stunValue", function (state, ctx, op, events) {
    var target;

        target = H.sideUnit(state, ctx, op.who || "target");
        if (!target) return;
        var key = op.op === "breakValue" ? "breakValue" : "stunValue";
        var cap = B.rules.CONFIG[key === "breakValue" ? "breakValueMax" : "stunValueMax"];
        target[key] = B.rules.clamp(target[key] + H.evalValue(state, ctx, op.delta), 0, cap);
        H.pushEvent(state, events, { type: key, uid: target.uid, value: target[key] });
        return;
      
  });
})(typeof globalThis !== "undefined" ? globalThis : this);

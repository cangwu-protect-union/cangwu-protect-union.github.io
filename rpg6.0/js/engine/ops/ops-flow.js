/* 回合制正传 6.0 · 战斗引擎 · 效果解释器 · 流程与调度类 op
   只做 registerOp，跟在 effect-ops.js 与 effect-ops-helpers.js 之后加载。 */
(function (root) {
  "use strict";
  var B = root.RPG6B || (root.RPG6B = {});
  var api = B.effectOps || (B.effectOps = {});
  var H = api._helpers || {};

  api.registerOp("dice", function (state, ctx, op, events) {

        H.runDice(state, ctx, op, events);
        return;
      
  });

  api.registerOp("roll", function (state, ctx, op, events) {

        var sides = Number(op.sides) || B.rules.CONFIG.diceSides;
        var roll = B.rng.dice(state, sides);
        var roller = H.sideUnit(state, ctx, op.who || "self");
        if (!roller) return;
        roller.flags[H.counterKey(ctx, op.key || "roll", op.perTarget !== false)] = roll;
        H.pushEvent(state, events, {
          type: "dice",
          uid: roller.uid,
          sides: sides,
          value: roll,
          label: op.label || ctx.label || "",
          key: op.key || "roll",
          skillId: ctx.skillId || ""
        });
        return;
      
  });

  api.registerOp("deny", function (state, ctx, op, events) {

        if (ctx) {
          ctx.denied = true;
          ctx.reason = op.reason || "无法进行这个动作";
        }
        return;
      
  });

  api.registerOp("if", function (state, ctx, op, events) {

        H.runIf(state, ctx, op, events);
        return;
      
  });

  api.registerOp("tick", function (state, ctx, op, events) {

        H.addTick(state, ctx, op, events);
        return;
      
  });

  api.registerOp("reflect", function (state, ctx, op, events) {
    var target;

        target = H.sideUnit(state, ctx, op.who || "self");
        if (!target) return;
        target.reflect = {
          factor: Number(op.factor) || 2,
          stunRounds: Number(op.stunRounds) || 0,
          sourceSkillId: ctx.skillId || ""
        };
        if (target.charge) target.charge.indestructible = true;
        H.pushEvent(state, events, { type: "reflectOn", uid: target.uid, factor: target.reflect.factor, skillId: ctx.skillId || "" });
        return;
      
  });

  api.registerOp("interrupt", function (state, ctx, op, events) {

        H.runInterrupt(state, ctx, op, events);
        return;
      
  });

  api.registerOp("schedule", function (state, ctx, op, events) {

        H.runSchedule(state, ctx, op, events);
        return;
      
  });

  api.registerOp("use", function (state, ctx, op, events) {

        var ref = B.skills && B.skills.find ? B.skills.find(op.skillId) : null;
        if (!ref) throw new Error("引用的技能不存在：" + op.skillId);
        var repeat = Number(op.times) || 1;
        for (var r = 0; r < repeat; r++) {
          if (state.phase === "finished") return;
          H.runOps(state, ctx, ref.ops, events);
        }
        return;
      
  });

  api.registerOp("setBasicMod", function (state, ctx, op, events) {

        if (!ctx.mod) return;
        if (op.type) ctx.mod.type = op.type;
        if (op.factor != null) ctx.mod.factor = Number(op.factor);
        if (op.healInstead) ctx.mod.healInstead = true;
        if (op.hits != null) ctx.mod.hits = Number(op.hits);
        if (op.noBreak) ctx.mod.noBreak = true;
        if (op.misfire) ctx.mod.misfire = true;
        return;
      
  });

  api.registerOp("setBasicMode", function (state, ctx, op, events) {

        if (!ctx.mode) ctx.mode = {};
        if (op.healSummon) ctx.mode.healSummonKey = op.healSummon;
        if (op.mode) ctx.mode.mode = op.mode;
        return;
      
  });

  api.registerOp("summon", function (state, ctx, op, events) {

        var summoner = H.sideUnit(state, ctx, op.who || "self");
        if (!summoner || !B.summons || !B.summons.create) return;
        B.summons.create(state, op.key, summoner, events, { ttl: op.ttl });
        return;
      
  });

  api.registerOp("dodge", function (state, ctx, op, events) {

        if (ctx) ctx.dodge = true;
        return;
      
  });

  api.registerOp("note", function (state, ctx, op, events) {

        H.pushEvent(state, events, { type: "note", uid: ctx.sourceUid, text: op.text || "", skillId: ctx.skillId || "" });
        return;
      
  });
})(typeof globalThis !== "undefined" ? globalThis : this);

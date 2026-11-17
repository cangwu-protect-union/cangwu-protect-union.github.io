/* 回合制正传 6.0 · 战斗引擎 · 效果解释器分片 2
   只做 registerOp，跟在 effect-ops.js 与 helpers 分片之后加载。 */
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
              noStun: !!op.noStun,
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
  api.registerOp("dispel", function (state, ctx, op, events) {

        H.runDispel(state, ctx, op, events);
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
  api.registerOp("taunt", function (state, ctx, op, events) {
    var target;

        target = H.sideUnit(state, ctx, op.who || "self");
        if (!target) return;
        target.taunt += Number(op.delta) || 0;
        H.pushEvent(state, events, { type: "taunt", uid: target.uid, value: target.taunt, skillId: ctx.skillId || "" });
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
  api.registerOp("summon", function (state, ctx, op, events) {

        var summoner = H.sideUnit(state, ctx, op.who || "self");
        if (!summoner || !B.summons || !B.summons.create) return;
        B.summons.create(state, op.key, summoner, events, { ttl: op.ttl });
        return;
      
  });
  api.registerOp("setBasicMode", function (state, ctx, op, events) {

        if (!ctx.mode) ctx.mode = {};
        if (op.healSummon) ctx.mode.healSummonKey = op.healSummon;
        if (op.mode) ctx.mode.mode = op.mode;
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

/* 回合制正传 6.0 · 战斗引擎 · 技能目标与嘲讽
   单体目标校验、嘲讽最高的可选集合、普攻模式与召唤物回血目标。
   只读 state，选错目标直接抛错；与 skills.js 共用 B.skills 命名空间。 */
(function (root) {
  "use strict";
  var B = root.RPG6B || (root.RPG6B = {});
  var api = B.skills = B.skills || {};

  function maxTauntUids(state, side) {
    var list = B.state.combatantsOf(state, side);
    var max = -Infinity;
    for (var i = 0; i < list.length; i++) max = Math.max(max, Number(list[i].taunt) || 0);
    var out = [];
    for (var j = 0; j < list.length; j++) {
      if ((Number(list[j].taunt) || 0) === max) out.push(list[j].uid);
    }
    return out;
  }

  function checkTaunt(state, unit, targetUid) {
    if (B.traits && B.traits.ignoreTaunt && B.traits.ignoreTaunt(unit)) return;
    var target = B.state.unitOf(state, targetUid);
    var side = B.state.sideOf(state, target.uid);
    var allowed = maxTauntUids(state, side);
    if (allowed.indexOf(target.uid) < 0) {
      throw new Error("必须选择嘲讽最高的目标");
    }
  }

  function resolveTarget(state, unit, skill, requested) {
    var mySide = B.state.sideOf(state, unit.uid);
    var enemySide = B.state.otherSide(state, mySide);
    var enemyHero = B.state.heroOf(state, enemySide);
    var kind = skill.target || "enemy";
    if (kind === "self") {
      if (requested && requested !== unit.uid) throw new Error("这个技能只能对自己使用");
      return unit.uid;
    }
    if (kind === "ally") {
      if (requested && requested !== unit.uid) throw new Error("1v1 没有其他队友");
      return unit.uid;
    }
    if (kind === "allAllies") return unit.uid;
    if (kind === "allEnemies") return enemyHero ? enemyHero.uid : "";
    if (kind === "any") {
      if (!requested) throw new Error("没有选目标");
      B.state.unitOf(state, requested);
      if (requested === unit.uid) return requested;
      if (B.state.sideOf(state, requested) === enemySide) checkTaunt(state, unit, requested);
      return requested;
    }
    if (!requested) throw new Error("没有选目标");
    B.state.unitOf(state, requested);
    if (requested === unit.uid) throw new Error("这个技能不能对自己使用");
    if (B.state.sideOf(state, requested) !== enemySide) throw new Error("目标不是敌方单位");
    checkTaunt(state, unit, requested);
    return requested;
  }

  function basicMode(state, unit, target, events) {
    var ctx = {
      sourceUid: unit.uid,
      targetUid: target ? target.uid : "",
      skillId: "passive.basicMode",
      label: "普攻模式",
      mode: {}
    };
    api.runHooks(state, unit, "basicMode", ctx, events || []);
    return ctx.mode;
  }

  function basicHealTarget(state, unit) {
    var mode = basicMode(state, unit, null, []);
    if (!mode || !mode.healSummonKey) return null;
    var side = B.state.sideOf(state, unit.uid);
    var summon = B.summons && B.summons.findKey ? B.summons.findKey(state, side, mode.healSummonKey) : null;
    return summon ? summon.uid : null;
  }

  api.resolveTarget = resolveTarget;
  api.maxTauntUids = maxTauntUids;
  api.checkTaunt = checkTaunt;
  api.basicMode = basicMode;
  api.basicHealTarget = basicHealTarget;
})(typeof globalThis !== "undefined" ? globalThis : this);

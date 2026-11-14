/* 回合制正传 6.0 · 战斗引擎 · 技能条件
   条件分两段：蓄力以外的条件（蓝、冷却、血量）先判；蓄力够不够决定「释放」还是「蓄力」。 */
(function (root) {
  "use strict";
  var B = root.RPG6B || (root.RPG6B = {});
  var api = B.conditions = B.conditions || {};

  function chargeOf(unit, skillId) {
    if (!unit.charge || unit.charge.skillId !== skillId) return 0;
    return unit.charge.amount || 0;
  }

  function cooldownReady(state, unit, skill) {
    if (!skill.cooldown) return true;
    var last = unit.cooldowns[skill.id];
    if (last == null) return true;
    return state.round - last >= skill.cooldown;
  }

  function evaluate(state, unit, skill) {
    var out = { ok: true, reason: "", needsCharge: false, canCharge: true, canRelease: true };
    if (!skill) {
      out.ok = false;
      out.reason = "技能不存在";
      return out;
    }
    if (skill.unsupported) {
      out.ok = false;
      out.reason = "本版未实现：" + skill.unsupported;
      return out;
    }
    var mpCost = skill.cost && skill.cost.mp ? skill.cost.mp : 0;
    if (B.state.hasStatus(unit, "noSkill")) {
      out.ok = false;
      out.reason = "被封锁，无法释放技能";
      out.canCharge = false;
      out.canRelease = false;
      return out;
    }
    if (mpCost > 0 && unit.mp < mpCost) {
      out.ok = false;
      out.reason = "缺 " + (mpCost - unit.mp) + " 蓝";
      out.canCharge = false;
      out.canRelease = false;
      return out;
    }
    if (!cooldownReady(state, unit, skill)) {
      var last = unit.cooldowns[skill.id];
      var left = skill.cooldown - (state.round - last);
      out.ok = false;
      out.reason = "冷却中，还需 " + left + " 回合";
      out.canCharge = false;
      out.canRelease = false;
      return out;
    }
    var need = skill.charge || 0;
    var have = chargeOf(unit, skill.id);
    if (have < need) {
      out.needsCharge = true;
      out.canRelease = false;
      out.reason = "需要蓄力 " + have + "/" + need;
    }
    return out;
  }

  function listFor(state, unit, skills) {
    var out = [];
    for (var i = 0; i < skills.length; i++) {
      var skill = skills[i];
      var check = evaluate(state, unit, skill);
      out.push({
        id: skill.id,
        name: skill.name,
        conditionText: skill.conditionText,
        target: skill.target,
        enabled: check.ok,
        needsCharge: check.needsCharge,
        reason: check.reason
      });
    }
    return out;
  }

  api.chargeOf = chargeOf;
  api.cooldownReady = cooldownReady;
  api.evaluate = evaluate;
  api.listFor = listFor;

  if (typeof module === "object" && module.exports) module.exports = B;
})(typeof globalThis !== "undefined" ? globalThis : this);

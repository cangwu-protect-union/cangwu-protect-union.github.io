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
    if (skill.passive) {
      out.ok = false;
      out.reason = "被动技能，不需要释放";
      out.canCharge = false;
      out.canRelease = false;
      return out;
    }
    if (skill.once && unit.flags["used." + skill.id]) {
      out.ok = false;
      out.reason = "这个技能只能用一次";
      out.canCharge = false;
      out.canRelease = false;
      return out;
    }
    var eff = B.skills && B.skills.effectiveCost
      ? B.skills.effectiveCost(unit, skill)
      : { mp: (skill.cost && skill.cost.mp) || 0, charge: skill.charge || 0, steps: 0 };
    out.effective = eff;
    var mpCost = eff.mp;
    if (B.state.hasStatus(unit, "onlyBasic")) {
      out.ok = false;
      out.reason = "现在只能普攻";
      out.canCharge = false;
      out.canRelease = false;
      return out;
    }
    var blocker = null;
    for (var s = 0; s < unit.statuses.length; s++) {
      var st = unit.statuses[s];
      if (st.kind === "noSkill" && (!st.skillId || st.skillId === skill.id)) {
        blocker = st;
        break;
      }
    }
    if (blocker) {
      out.ok = false;
      out.reason = blocker.skillId
        ? "被「" + (blocker.label || "技能") + "」封锁"
        : "被封锁，无法释放技能";
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
    if (skill.input) {
      var needMp = mpCost + (Number(skill.input.min) || 0);
      if (unit.mp < needMp) {
        out.ok = false;
        out.reason = "需要至少 " + needMp + " 蓝";
        out.canCharge = false;
        out.canRelease = false;
        return out;
      }
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
    var need = eff.charge;
    if (skill.requires) {
      for (var r = 0; r < skill.requires.length; r++) {
        var req = skill.requires[r];
        var current = B.state.markOf(unit, req.mark);
        var pass = true;
        if (req.gte != null) pass = current >= req.gte;
        else if (req.lte != null) pass = current <= req.lte;
        else if (req.eq != null) pass = current === req.eq;
        if (!pass) {
          out.ok = false;
          out.reason = req.reason || ("「" + B.state.markName(unit, req.mark) + "」层数不满足");
          out.canCharge = false;
          out.canRelease = false;
          return out;
        }
      }
    }
    var have = chargeOf(unit, skill.id);
    if (have < need) {
      out.needsCharge = true;
      out.canRelease = false;
      out.reason = "需要蓄力 " + have + "/" + need;
      if (B.state.hasStatus(unit, "noCharge")) {
        out.ok = false;
        out.canCharge = false;
        out.reason = "现在无法蓄力";
      }
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

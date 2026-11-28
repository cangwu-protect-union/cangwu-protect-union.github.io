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
    /* 自身有该 key 的持续效果时置灰（E8：土豆地雷在「剃发为僧」期间不可用） */
    if (skill.forbidEffect && B.state.hasEffectKey(unit, skill.forbidEffect)) {
      var feLabel = skill.forbidEffect;
      for (var fe = 0; fe < unit.effects.length; fe++) {
        if (unit.effects[fe].key === skill.forbidEffect) {
          feLabel = unit.effects[fe].label || skill.forbidEffect;
          break;
        }
      }
      out.ok = false;
      out.reason = "「" + feLabel + "」生效期间无法使用";
      out.canCharge = false;
      out.canRelease = false;
      return out;
    }
    var eff = B.skills && B.skills.effectiveCost
      ? B.skills.effectiveCost(unit, skill)
      : { mp: (skill.cost && skill.cost.mp) || 0, charge: skill.charge || 0, def: (skill.cost && skill.cost.def) || 0, steps: 0 };
    out.effective = eff;
    var mpCost = eff.mp;
    if (B.state.hasStatus(unit, "onlyBasic")) {
      out.ok = false;
      out.reason = "现在只能普攻";
      out.canCharge = false;
      out.canRelease = false;
      return out;
    }
    /* 对手的防护层声明「锁死对方技能」（顾文达下潜） */
    var foeSide = B.state.otherSide(state, B.state.sideOf(state, unit.uid));
    var foe = B.state.heroOf(state, foeSide);
    if (foe && B.state.effectHasFlag && B.state.effectHasFlag(foe, "enemyNoSkill")) {
      out.ok = false;
      out.reason = "对方封锁了技能";
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
      /* chargeOk（泼水节 Q2）：只禁释放不禁蓄力，蓄力判定继续往下走 */
      if (blocker.chargeOk) {
        out.canRelease = false;
        out.releaseBlocked = true;
      } else {
        out.ok = false;
        out.reason = blocker.skillId
          ? "被「" + (blocker.label || "技能") + "」封锁"
          : "被封锁，无法释放技能";
        out.canCharge = false;
        out.canRelease = false;
        return out;
      }
    }
    if (mpCost > 0 && unit.mp < mpCost) {
      out.ok = false;
      out.reason = "缺 " + (mpCost - unit.mp) + " 蓝";
      out.canCharge = false;
      out.canRelease = false;
      return out;
    }
    var defCost = eff.def || 0;
    if (defCost > 0 && B.state.statOf(unit, "def") < defCost) {
      out.ok = false;
      out.reason = "防御不足 " + defCost + "（现在 " + B.state.statOf(unit, "def") + "）";
      out.canCharge = false;
      out.canRelease = false;
      return out;
    }
    /* 蓝上限代价（E10：机枪射手「5蓝上限」）：判蓝上限够不够，不足置灰 */
    var maxMpCost = skill.cost && skill.cost.maxMp ? Number(skill.cost.maxMp) : 0;
    if (maxMpCost > 0 && B.state.maxMpOf(unit) < maxMpCost) {
      out.ok = false;
      out.reason = "蓝上限不足 " + maxMpCost + "（现在 " + B.state.maxMpOf(unit) + "）";
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
    var have = chargeOf(unit, skill.id);
    if (skill.requires) {
      for (var r = 0; r < skill.requires.length; r++) {
        var req = skill.requires[r];
        /* once：已有蓄力（含蓄满待释放）时这条只约束「从 0 蓄第一层」，续蓄与释放跳过 */
        if (req.once && have > 0) continue;
        var current = B.state.markOf(unit, req.mark);
        var pass = true;
        if (req.gte != null) pass = current >= req.gte;
        else if (req.lte != null) pass = current <= req.lte;
        else if (req.eq != null) pass = current === req.eq;
        else if (req.flag) {
          var recorded = unit.flags ? unit.flags[req.flag] : null;
          var gap = req.gap == null ? 1 : Number(req.gap);
          pass = recorded != null && (Number((unit.stats && unit.stats.turns) || 0) - Number(recorded)) === gap;
        }
        else if (req.summonCount) {
          var sc = req.summonCount;
          var count = B.summons && B.summons.ofSide
            ? B.summons.ofSide(state, B.state.sideOf(state, unit.uid)).length
            : 0;
          if (sc.op === "gte") pass = count >= sc.right;
          else if (sc.op === "gt") pass = count > sc.right;
          else if (sc.op === "lte") pass = count <= sc.right;
          else if (sc.op === "lt") pass = count < sc.right;
          else if (sc.op === "eq") pass = count === sc.right;
          else pass = false;
        }
        if (!pass) {
          out.ok = false;
          out.reason = req.reason || ("「" + B.state.markName(unit, req.mark) + "」层数不满足");
          out.canCharge = false;
          out.canRelease = false;
          return out;
        }
      }
    }
    if (have < need) {
      out.needsCharge = true;
      out.canRelease = false;
      out.reason = "需要蓄力 " + have + "/" + need;
      if (B.state.hasStatus(unit, "noCharge")) {
        out.ok = false;
        out.canCharge = false;
        out.reason = "现在无法蓄力";
      }
    } else if (out.releaseBlocked) {
      out.ok = false;
      out.reason = "被封锁，无法释放技能";
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

  /* 额外动作（E5）：技能声明的 items（吃碎苹果、功德回血）展开成入口列表 */
  function itemsOf(unit) {
    var out = [];
    var list = B.skills ? B.skills.forUnit(unit) : [];
    for (var i = 0; i < list.length; i++) {
      var items = list[i].items;
      if (!items || !items.length) continue;
      for (var j = 0; j < items.length; j++) {
        var item = items[j];
        if (!item || !item.id) continue;
        out.push({
          id: item.id,
          label: item.label || item.id,
          skillId: list[i].id,
          requires: item.requires || [],
          oncePerRound: !!item.oncePerRound,
          noEffect: item.noEffect || "",
          ops: item.ops || []
        });
      }
    }
    return out;
  }

  /* 可用性：眩晕/击溃不可用（canAct），onlyBasic/noSkill 不拦（Q14）。
     noStock / forbidden 供 actions.list 决定是否隐藏入口。 */
  function itemAvailable(state, unit, item) {
    if (!B.state.canAct(unit)) return { ok: false, reason: "眩晕或击溃时无法使用" };
    for (var r = 0; r < item.requires.length; r++) {
      var req = item.requires[r];
      var current = B.state.markOf(unit, req.mark);
      var pass = true;
      if (req.gte != null) pass = current >= req.gte;
      else if (req.lte != null) pass = current <= req.lte;
      else if (req.eq != null) pass = current === req.eq;
      if (!pass) {
        return { ok: false, noStock: true, reason: req.reason || ("「" + B.state.markName(unit, req.mark) + "」层数不满足") };
      }
    }
    if (item.noEffect && B.state.hasEffectKey(unit, item.noEffect)) {
      return { ok: false, forbidden: true, reason: "「剃发为僧」生效期间无法回血" };
    }
    if (item.oncePerRound && unit.flags["itemUsed." + item.id] === state.round) {
      return { ok: false, reason: "本回合已经用过了" };
    }
    return { ok: true, reason: "" };
  }

  api.chargeOf = chargeOf;
  api.cooldownReady = cooldownReady;
  api.evaluate = evaluate;
  api.listFor = listFor;
  api.itemsOf = itemsOf;
  api.itemAvailable = itemAvailable;

  if (typeof module === "object" && module.exports) module.exports = B;
})(typeof globalThis !== "undefined" ? globalThis : this);

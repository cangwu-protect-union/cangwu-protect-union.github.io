/* 回合制正传 6.0 · 战斗引擎 · 职业与副业
   这里只给静态属性与钩子清单；M3 把 onCalcStat / onAfterDamage 这类钩子接进结算。
   数据来源：_local/docs/职业介绍.txt。 */
(function (root) {
  "use strict";
  var B = root.RPG6B || (root.RPG6B = {});
  var api = B.traits = B.traits || {};

  var JOBS = {
    "盾卫": { taunt: 2, basicType: "phys", chargeUnbreakable: false },
    "重装": { taunt: 2, basicType: "magic", chargeUnbreakable: true },
    "强攻手": { taunt: 1, basicType: "phys" },
    "冲锋手": { taunt: 1, basicType: "phys" },
    "粉碎者": { taunt: 0, basicType: "magic" },
    "爆发者": { taunt: 0, basicType: "phys", actionsPerTurn: 2 },
    "斗士": { taunt: 0, basicType: "phys", lowHpBoost: true },
    "医师": { taunt: 1, basicType: "magic", canHitAlly: true }
  };

  var SIDE_JOBS = {
    "执旗手": { taunt: -1, openMp: 2 },
    "破阵师": { taunt: -1, openMp: 2 },
    "召唤师": { taunt: -1, openMp: 2 },
    "爆破手": { taunt: 1, basicCharge: 1, basicGroup: true },
    "射手": { taunt: -2, ignoreTaunt: true },
    "嘲讽手": { taunt: 2, openMp: -2, mpPerTurn: 1 }
  };

  function baseOf(table, name) {
    return table[name] || null;
  }

  function resolve(job, sideJob) {
    var out = {
      taunt: 0,
      basicType: "phys",
      actionsPerTurn: 1,
      chargeUnbreakable: false,
      canHitAlly: false,
      basicCharge: 0,
      basicGroup: false,
      ignoreTaunt: false,
      lowHpBoost: false,
      openMp: 0,
      mpPerTurn: 0,
      known: true
    };
    var taunt = 0;
    var jobDef = baseOf(JOBS, job);
    if (jobDef) {
      for (var k in jobDef) {
        if (Object.prototype.hasOwnProperty.call(jobDef, k) && k !== "taunt") out[k] = jobDef[k];
      }
      taunt += jobDef.taunt || 0;
    } else {
      out.known = false;
    }
    var sideDef = baseOf(SIDE_JOBS, sideJob);
    if (sideDef) {
      for (var j in sideDef) {
        if (Object.prototype.hasOwnProperty.call(sideDef, j) && j !== "taunt") out[j] = sideDef[j];
      }
      taunt += sideDef.taunt || 0;
    } else if (sideJob) {
      out.known = false;
    }
    out.taunt = taunt;
    return out;
  }

  function applyToUnit(unit) {
    var t = resolve(unit.job, unit.subJob);
    unit.trait = t;
    unit.taunt = t.taunt;
    unit.actionsPerTurn = t.actionsPerTurn;
    return t;
  }

  function basicType(unit) {
    return unit && unit.trait ? unit.trait.basicType : "phys";
  }

  function actionsPerTurn(unit) {
    return unit && unit.trait && unit.trait.actionsPerTurn ? unit.trait.actionsPerTurn : 1;
  }

  function chargeUnbreakable(unit) {
    return !!(unit && unit.trait && unit.trait.chargeUnbreakable);
  }

  api.JOBS = JOBS;
  api.SIDE_JOBS = SIDE_JOBS;
  api.resolve = resolve;
  api.applyToUnit = applyToUnit;
  api.basicType = basicType;
  api.actionsPerTurn = actionsPerTurn;
  api.chargeUnbreakable = chargeUnbreakable;

  if (typeof module === "object" && module.exports) module.exports = B;
})(typeof globalThis !== "undefined" ? globalThis : this);

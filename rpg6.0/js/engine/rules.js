/* 回合制正传 6.0 · 战斗引擎 · 数值与常量
   这里只放纯计算，不碰状态。改平衡性先改 CONFIG。 */
(function (root) {
  "use strict";
  var B = root.RPG6B || (root.RPG6B = {});
  var api = B.rules = B.rules || {};

  var CONFIG = {
    gaugeMax: 100,
    breakValueMax: 5,
    stunValueMax: 5,
    breakThreshold: 3,
    roundStep: 5,
    statStep: 5,
    diceSides: 6,
    statFloor: { atk: 0, def: 0, spd: 0, maxHp: 1, maxMp: 0 }
  };

  function clamp(n, lo, hi) {
    if (n < lo) return lo;
    if (n > hi) return hi;
    return n;
  }

  function round5(n) {
    if (!isFinite(n) || n <= 0) return 0;
    return Math.ceil(n / CONFIG.roundStep) * CONFIG.roundStep;
  }

  function ceilTo(n, step) {
    var s = Number(step) || 1;
    if (!isFinite(n) || n <= 0) return 0;
    return Math.ceil(n / s) * s;
  }

  function floorTo(n, step) {
    var s = Number(step) || 1;
    if (!isFinite(n)) return 0;
    return Math.floor(n / s) * s;
  }

  /* 面板数值统一向下取到 5 的倍数（攻击/防御/法抗/血上限/蓝上限/速度，含所有乘算） */
  function panelRound(n) {
    var v = Number(n);
    if (!isFinite(v)) return 0;
    return floorTo(v, CONFIG.statStep);
  }

  function phys(atk, def) {
    return Math.max(0, (Number(atk) || 0) - (Number(def) || 0));
  }

  function magic(atk, mres) {
    return Math.max(0, (Number(atk) || 0) / 100 * (100 - (Number(mres) || 0)));
  }

  function trueDamage(atk) {
    return Math.max(0, Number(atk) || 0);
  }

  function rawByType(type, amount, target) {
    if (type === "magic") return magic(amount, target ? target.mres : 0);
    if (type === "true") return trueDamage(amount);
    return phys(amount, target ? target.def : 0);
  }

  function buffTotal(unit, kind, mode) {
    var list = unit && unit.buffs ? unit.buffs : [];
    var vals = [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].kind === kind) vals.push(Number(list[i].percent) || 0);
    }
    if (!vals.length) return 0;
    if (mode === "max") return Math.max.apply(null, vals);
    var sum = 0;
    for (var j = 0; j < vals.length; j++) sum += vals[j];
    return sum;
  }

  function multiplier(source, target, type) {
    var out = 1 + buffTotal(source, "brave", "sum") / 100 - buffTotal(source, "panic", "max") / 100;
    var take = 1 + buffTotal(target, "fragile", "sum") / 100 - buffTotal(target, "strong", "max") / 100;
    /* magicVuln 只作用于法伤，由 damage.hit 在一次命中后消耗 */
    if (type === "magic") take *= 1 + buffTotal(target, "magicVuln", "max") / 100;
    return Math.max(0, out) * Math.max(0, take);
  }

  function finalDamage(raw, mul) {
    return round5(raw * (Number(mul == null ? 1 : mul)));
  }

  function breakRounds(breakValue) {
    return Math.max(0, (Number(breakValue) - 1) * 2);
  }

  function gaugeStep(gauge, spd, firstRound) {
    var g = Number(gauge) || 0;
    if (!firstRound) g += Number(spd) || 0;
    var acts = 0;
    while (g >= CONFIG.gaugeMax) {
      g -= CONFIG.gaugeMax;
      acts += 1;
    }
    return { gauge: g, actions: acts };
  }

  api.CONFIG = CONFIG;
  api.clamp = clamp;
  api.round5 = round5;
  api.ceilTo = ceilTo;
  api.floorTo = floorTo;
  api.panelRound = panelRound;
  api.phys = phys;
  api.magic = magic;
  api.trueDamage = trueDamage;
  api.rawByType = rawByType;
  api.buffTotal = buffTotal;
  api.multiplier = multiplier;
  api.finalDamage = finalDamage;
  api.breakRounds = breakRounds;
  api.gaugeStep = gaugeStep;

  if (typeof module === "object" && module.exports) module.exports = B;
})(typeof globalThis !== "undefined" ? globalThis : this);

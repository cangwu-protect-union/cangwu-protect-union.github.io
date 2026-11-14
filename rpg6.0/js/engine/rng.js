/* 回合制正传 6.0 · 战斗引擎 · 种子随机
   全部随机都从这里取；state.rng 是可序列化的整数，进战报就能复现。 */
(function (root) {
  "use strict";
  var B = root.RPG6B || (root.RPG6B = {});
  var api = B.rng = B.rng || {};

  var FALLBACK = 0x9e3779b9;

  function init(seed) {
    var s = Number(seed);
    if (!isFinite(s)) s = FALLBACK;
    s = Math.floor(Math.abs(s)) >>> 0;
    s ^= (s >>> 16);
    s = Math.imul(s, 0x7feb352d) >>> 0;
    s ^= (s >>> 15);
    s = Math.imul(s, 0x846ca68b) >>> 0;
    s ^= (s >>> 16);
    s = s >>> 0;
    return s === 0 ? FALLBACK : s;
  }

  function step(value) {
    var x = value >>> 0;
    x ^= (x << 13);
    x >>>= 0;
    x ^= (x >>> 17);
    x ^= (x << 5);
    x >>>= 0;
    return x >>> 0;
  }

  function next(battle) {
    battle.rng = step(battle.rng);
    return battle.rng / 4294967296;
  }

  function int(battle, min, max) {
    var lo = Math.ceil(min);
    var hi = Math.floor(max);
    if (hi <= lo) return lo;
    return lo + Math.floor(next(battle) * (hi - lo + 1));
  }

  function dice(battle, sides) {
    return int(battle, 1, sides || 6);
  }

  api.init = init;
  api.step = step;
  api.next = next;
  api.int = int;
  api.dice = dice;

  if (typeof module === "object" && module.exports) module.exports = B;
})(typeof globalThis !== "undefined" ? globalThis : this);

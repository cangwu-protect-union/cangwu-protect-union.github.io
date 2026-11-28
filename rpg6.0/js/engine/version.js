/* 回合制正传 6.0 · 战斗引擎 · 版本号
   引擎版本的唯一来源。data/config.js 的 engineVersion 必须与它逐字相同，
   state.js 的兜底取值也读它；两处都不再各写一份字面量。
   改规则时同时改这里和 data/config.js，tools/rpg6-lint.js 会比对。 */
(function (root) {
  "use strict";
  var B = root.RPG6B || (root.RPG6B = {});

  B.ENGINE_VERSION = "6.0-engine.15";

  if (typeof module === "object" && module.exports) module.exports = B;
})(typeof globalThis !== "undefined" ? globalThis : this);

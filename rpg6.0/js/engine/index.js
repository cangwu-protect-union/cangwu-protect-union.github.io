/* 回合制正传 6.0 · 引擎聚合入口
   唯一权威加载顺序：浏览器（js/battle/entry.js）、单测（run.mjs）、压测（batch.mjs）、
   策略实验室（strategy-lab/lib/engine.mjs）都从这里 import，不再各自维护加载清单。
   引擎内部仍用共享命名空间 root.RPG6B（阶段 4 起逐步改成显式导出）。 */
import "./version.js";
import "./rng.js";
import "./rules.js";
import "./traits.js";
import "./state.js";
import "./damage.js";
import "./effect-ops.js";
import "./effect-ops-helpers.js";
import "./ops/ops-damage.js";
import "./ops/ops-flow.js";
import "./ops/ops-state.js";
import "./timeline.js";
import "./conditions.js";
import "./skills.js";
import "./summons.js";
import "./actions.js";
import "./battle.js";

export const RPG6B = globalThis.RPG6B;

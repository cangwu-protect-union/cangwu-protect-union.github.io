/* 回合制正传 6.0 · 对局页单入口（test.html 只引这一个模块）
   装配顺序：引擎 → 技能库挂到 window（battle-page 仍在读，阶段 3 转显式） → 渲染层。 */
import "../engine/index.js";
import skillsLib from "../../data/skills/index.js";

window.RPG6_SKILLS = skillsLib;

await import("./battle-view.js");
await import("./battle-view-effects.js");
await import("./battle-pick.js");
await import("./battle-record.js");
await import("./battle-page-record.js");
await import("./battle-page-ui.js");
await import("./battle-page.js");

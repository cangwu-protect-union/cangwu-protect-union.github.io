/* 回合制正传 6.0 · 战斗界面 · 事件行与效果文案分片
   只往 RPG6BattleView 挂函数，在 battle-view.js 之前加载。 */
(function (root) {
  "use strict";
  var P = root.RPG6BattleView || (root.RPG6BattleView = {});
  var B = root.RPG6B;


  P.typeName = function (type) {
    return type === "magic" ? "法伤" : type === "true" ? "真伤" : "普伤";
  }

  P.esc = function (text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  P.eventLine = function (state, e) {
    var who = e.uid ? P.unitName(state, e.uid) : "";
    var round = e.round == null ? "" : "第 " + e.round + " 回合 · ";
    var line = null;
    switch (e.type) {
      case "roundStart":
        line = { text: "— 第 " + e.round + " 标准回合 —", cls: "is-round" };
        break;
      case "action":
        line = { text: round + who + " 施放「" + (e.name || e.skillId) + "」", cls: "is-action" };
        break;
      case "turnSkip":
        line = { text: round + who + " 无法行动，跳过", cls: "is-cancel" };
        break;
      case "actionCanceled":
        line = { text: round + who + " 的行动被跳过（" + (e.label || "持续效果") + " 掷出 " + e.value + "）", cls: "is-cancel" };
        break;
      case "dice":
        line = { text: round + (e.label ? e.label + " 掷出 " : "掷出 ") + e.value + "（d" + e.sides + "）", cls: "is-dice" };
        break;
      case "dodge":
        line = { text: round + who + " 闪避了 " + (P.unitName(state, e.sourceUid) || "攻击"), cls: "is-cancel" };
        break;
      case "misfire":
        line = { text: round + who + " 的「" + (e.label || "普攻") + "」哑火", cls: "is-mute" };
        break;
      case "summon":
        line = {
          text: round + (P.unitName(state, e.ownerUid) || "?") + " 召唤「" + (e.name || "召唤物") + "」" +
            (e.targetable ? "（血 " + e.hp + "）" : ""),
          cls: "is-status"
        };
        break;
      case "summonExpire":
        if (e.reason === "death") {
          line = null;
        } else {
          line = { text: round + "「" + (e.name || "召唤物") + "」消失", cls: "is-mute" };
        }
        break;
      case "summonDeath":
        line = { text: round + "「" + (e.name || "召唤物") + "」被击毁", cls: "is-cancel" };
        break;
      case "summonBlocked":
        line = { text: round + "召唤上限，未能召唤", cls: "is-mute" };
        break;
      case "damage":
        line = { text: round + (e.label || "伤害") + " · " + who + " 受 " + e.amount + " " + P.typeName(e.damageType) +
          (e.noBreak ? "（不计击溃值）" : ""), cls: "is-damage" };
        break;
      case "directLoss":
        line = { text: round + (e.label || "强扣") + " · " + who + " 受 " + e.amount + " 强扣", cls: "is-damage" };
        break;
      case "reflect":
        line = { text: round + "反弹 " + e.amount + " 回 " + P.unitName(state, e.against || who), cls: "is-damage" };
        break;
      case "heal":
        if (e.amount > 0) line = { text: round + (e.label || "回复") + " · " + who + " +" + e.amount, cls: "is-heal" };
        break;
      case "mp":
        line = { text: round + who + " 蓝 " + (e.delta > 0 ? "+" : "") + e.delta + "（" + e.mp + "）", cls: "is-mute" };
        break;
      case "mark":
        line = { text: round + who + " " + (e.name || e.key) + " " + e.value +
          (e.hideMax ? "" : "/" + e.max), cls: "is-mute" };
        break;
      case "stat":
        line = { text: round + who + " " + (P.STAT_LABEL[e.stat] || e.stat) +
          (e.mode === "set" ? " 变为 " + e.value : " " + (e.value > 0 ? "+" : "") + e.value), cls: "is-mute" };
        break;
      case "statusAdd":
        line = { text: round + who + " 获得「" + (e.label || e.kind) + "」" + e.remain + " 回合", cls: "is-status" };
        break;
      case "breakValue":
        line = { text: round + who + " 击溃值 " + e.value, cls: "is-mute" };
        break;
      case "stunValue":
        line = { text: round + who + " 眩晕值 " + e.value, cls: "is-mute" };
        break;
      case "effectAdd":
        line = { text: round + who + " 挂上「" + (e.label || "持续效果") + "」" + e.remain + " 标准回合", cls: "is-status" };
        break;
      case "effectExpire":
        line = { text: round + who + " 的「" + (e.label || "持续效果") + "」结束", cls: "is-mute" };
        break;
      case "buffAdd":
        line = { text: round + who + " 附加「" + ({ strong: "坚强", fragile: "脆弱", brave: "勇猛", panic: "恐慌" })[e.kind] + " " + e.percent + "%」", cls: "is-status" };
        break;
      case "buffExpire":
        line = { text: round + who + " 的「" + ({ strong: "坚强", fragile: "脆弱", brave: "勇猛", panic: "恐慌" })[e.kind] + "」结束", cls: "is-mute" };
        break;
      case "buffImmune":
        line = { text: round + who + " 免疫「" + ({ strong: "坚强", fragile: "脆弱", brave: "勇猛", panic: "恐慌" })[e.kind] + "」", cls: "is-cancel" };
        break;
      case "dispel":
        if (e.removed && e.removed.length) line = { text: round + who + " 清除 " + e.removed.length + " 项", cls: "is-mute" };
        break;
      case "interrupt":
        if (e.removed && e.removed.length) line = { text: round + who + " 被打断 " + e.removed.length + " 个持续效果", cls: "is-cancel" };
        break;
      case "chargeLost":
        line = { text: round + who + " 蓄力被打断", cls: "is-cancel" };
        break;
      case "charg":
        line = { text: round + who + " 蓄力 " + e.amount + "/" + (e.need || "?"), cls: "is-mute" };
        break;
      case "noDeath":
        line = { text: round + who + " 强行留 1 血", cls: "is-cancel" };
        break;
      case "death":
        line = { text: round + who + " 倒下", cls: "is-cancel" };
        break;
      default:
        line = null;
    }
    return line;
  }

  P.buildForecast = function (state, rows) {
    var out = [];
    var gauge = {};
    var current = { round: state.round, cells: {} };
    state.units.forEach(function (unit) {
      gauge[unit.uid] = unit.gauge;
      current.cells[unit.uid] = {
        gauge: unit.gauge,
        actions: unit.roundActions || 0,
        current: true
      };
    });
    out.push(current);
    for (var i = 1; i < rows; i++) {
      var row = { round: state.round + i, cells: {} };
      state.units.forEach(function (unit) {
        var step = B.rules.gaugeStep(gauge[unit.uid], B.state.spdOf(unit), false);
        gauge[unit.uid] = step.gauge;
        row.cells[unit.uid] = { gauge: step.gauge, actions: step.actions, current: false };
      });
      out.push(row);
    }
    return out;
  }

  P.valueText = function (value) {
    return typeof value === "number" ? value : "按公式";
  }

  P.effectText = function (effect) {
    if (effect.desc) return effect.desc;
    var parts = [];
    (effect.ops || []).forEach(function (op) {
      if (op.op === "damage") {
        parts.push("每标准回合 " + P.valueText(op.value) + " 点" + P.typeName(op.type));
      } else if (op.op === "heal") {
        parts.push("每标准回合回复 " + P.valueText(op.value));
      } else if (op.op === "mp") {
        parts.push("每标准回合蓝 " + (op.delta > 0 ? "+" : "") + op.delta);
      } else if (op.op === "stat") {
        parts.push((P.STAT_LABEL[op.stat] || op.stat) + " " + (op.mode === "set" ? "变为 " : op.value > 0 ? "+" : "") + P.valueText(op.value));
      } else if (op.op === "dice" || op.op === "if" || op.op === "use") {
        parts.push("每标准回合结算一次");
      }
    });
    if (effect.gate && effect.gate.cancel) {
      parts.push("持有者每次行动前掷 d" + (effect.gate.sides || 6) + "，掷出 " +
        effect.gate.cancel.join("/") + " 跳过该次行动");
    }
    return parts.length ? parts.join("；") : "每标准回合结算一次";
  }

  P.chipDetail = function (state, spec) {
    if (!spec) return null;
    var parts = String(spec).split(":");
    var kind = parts[0];
    var uid = parts[1];
    var index = Number(parts[2]);
    var unit;
    try {
      unit = B.state.unitOf(state, uid);
    } catch (err) {
      return null;
    }
    if (kind === "effect") {
      var effect = (unit.effects || [])[index];
      if (!effect) return null;
      return {
        kind: "effect",
        name: effect.label || "持续效果",
        remain: effect.remain,
        text: P.effectText(effect)
      };
    }
    var buff = unit.buffs[index];
    if (!buff) return null;
    var buffName = ({ strong: "坚强", fragile: "脆弱", brave: "勇猛", panic: "恐慌" })[buff.kind] || buff.kind;
    return {
      kind: "buff",
      name: buffName + " " + buff.percent + "%",
      remain: buff.remain,
      text: (P.BUFF_TEXT[buff.kind] || "") + buff.percent + "%"
    };
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

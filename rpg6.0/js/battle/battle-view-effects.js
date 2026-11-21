/* 回合制正传 6.0 · 战斗界面 · 事件行与效果文案分片
   只往 RPG6BattleView 挂函数，在 battle-view.js 之前加载。 */
(function (root) {
  "use strict";
  var P = root.RPG6BattleView || (root.RPG6BattleView = {});
  var B = root.RPG6B;


  P.typeName = function (type) {
    return type === "magic" ? "法伤" : type === "true" ? "真伤" : "普伤";
  }

  /* 额外动作按钮：unlock（解锁属性）与 item（吃碎苹果/功德回血），接在三个基础按钮后面 */
  P.renderExtraActions = function (state, unit, pick, active) {
    var html = "";
    var extras = active && B.battle && B.battle.available ? B.battle.available(state) : [];
    for (var x = 0; x < extras.length; x++) {
      var ex = extras[x];
      if (ex.kind === "unlock") {
        var pickedUnlock = pick && pick.mode === "unlock";
        html += '<button type="button" class="btn btn-ghost bq-btn' + (pickedUnlock ? " is-picked" : "") +
          '" data-unlock' + (ex.enabled ? "" : " disabled") + ' title="' + P.esc(ex.reason) + '">' + P.esc(ex.label) + "</button>";
      } else if (ex.kind === "item") {
        html += '<button type="button" class="btn btn-ghost bq-btn" data-item="' + P.esc(ex.key) + '"' +
          (ex.enabled ? "" : " disabled") + ' title="' + P.esc(ex.reason) + '">' + P.esc(ex.label) + "</button>";
      }
    }
    if (active && pick && pick.mode === "unlock" && pick.stats && pick.stats.length) {
      html += '<div class="bq-choice"><span class="bq-choice-label">选择要解锁的属性</span>';
      pick.stats.forEach(function (st) {
        html += '<button type="button" class="btn btn-ghost bq-btn" data-unlock-stat="' + P.esc(st.key) + '">' +
          P.esc(st.label) + "</button>";
      });
      html += "</div>";
    }
    return html;
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
        if (e.kind === "item") {
          line = { text: round + who + " 使用「" + (e.name || e.itemId) + "」", cls: "is-action" };
        } else {
          line = { text: round + who + " 施放「" + (e.name || e.skillId) + "」", cls: "is-action" };
        }
        break;
      case "unlock":
        line = { text: round + who + " 解锁" + (e.label || e.stat), cls: "is-mute" };
        break;
      case "convertMaxHp":
        line = { text: round + who + " 把 " + e.amount + " 伤害转成血上限", cls: "is-status" };
        break;
      case "buffDecay":
        line = { text: round + who + " 的「" + ({ strong: "坚强", fragile: "脆弱", brave: "勇猛", panic: "恐慌" })[e.kind] + "」衰减到 " + e.percent + "%", cls: "is-mute" };
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

  var BUFF_NAME = { strong: "坚强", fragile: "脆弱", brave: "勇猛", panic: "恐慌", magicVuln: "法伤易伤" };

  var STATUS_DESC = {
    break: "无法行动，直到击溃结束",
    stun: "无法行动，防御与法抗视为 0",
    noSkill: "不能释放技能",
    noBasic: "不能普攻",
    noCharge: "不能蓄力",
    daze: "防御与法抗视为 0，但仍可行动",
    cannotAct: "无法行动",
    onlyBasic: "只能普攻",
    noDeath: "血量不会被降到 0 以下",
    noBreakOut: "造成的伤害不增加击溃值"
  };

  P.summonTargetText = function (who) {
    if (who === "allEnemies") return "敌方全体";
    if (who === "enemyHero") return "敌方英雄";
    if (who === "allAllies") return "己方全体";
    if (who === "ally") return "己方单位";
    if (who === "self") return "自身";
    if (who === "sideUnits") return "同侧单位";
    return "目标";
  }

  P.summonValueText = function (value) {
    if (typeof value === "number") return String(value);
    if (value && value.stat) return "按" + (P.STAT_LABEL[String(value.stat).split(".").pop()] || "公式");
    return "";
  }

  /* 召唤物脚本说明：有一段 op 认不出来就整段返回空串，由调用方写「见技能说明」 */
  P.summonActText = function (ops) {
    var parts = [];
    var unknown = false;
    (ops || []).forEach(function (op) {
      var num = P.summonValueText(op.value);
      if (op.op === "damage") {
        var type = P.typeName(op.type);
        var amount = typeof op.value === "number" ? " " + op.value + " 点" : (num ? "（" + num + "）" : "");
        parts.push(P.summonTargetText(op.who) + "受到" + amount + type + (op.noBreak ? "（不计击溃值）" : ""));
      } else if (op.op === "heal") {
        var heal = typeof op.value === "number" ? " " + op.value + " 点" : (num ? "（" + num + "）" : "");
        parts.push(P.summonTargetText(op.who) + "回复" + heal + "血量");
      } else if (op.op === "buff") {
        parts.push(P.summonTargetText(op.who) + "获得「" + (BUFF_NAME[op.kind] || op.kind) + " " + op.percent + "%」");
      } else if (op.op === "stat") {
        parts.push(P.summonTargetText(op.who) + " " + (P.STAT_LABEL[op.stat] || op.stat) + " " +
          (op.mode === "set" ? "变为 " : (op.value > 0 ? "+" : "")) + num);
      } else if (op.op === "mp") {
        parts.push(P.summonTargetText(op.who) + "蓝 " + (op.delta > 0 ? "+" : "") + op.delta);
      } else if (op.op === "status") {
        parts.push(P.summonTargetText(op.who) + "获得「" + (op.label || P.STATUS_TEXT[op.kind] || op.kind) + "」");
      } else {
        unknown = true;
      }
    });
    return unknown ? "" : parts.join("；");
  }

  /* desc 优先（整段手写）；没有 desc 才按 aura / attack / onExpire 自己拼 */
  P.summonActions = function (def) {
    if (!def) return [];
    if (def.desc) return [{ label: "说明", text: def.desc }];
    var rows = [];
    if (def.aura && def.aura.length) {
      rows.push({ label: "光环", text: "每标准回合末：" + (P.summonActText(def.aura) || "见技能说明") });
    }
    if (def.attack && def.attack.length) {
      rows.push({
        label: "自动攻击",
        text: "每标准回合末速度条 +速度，满 100 出手一次：" + (P.summonActText(def.attack) || "见技能说明")
      });
    }
    if (def.onExpire && def.onExpire.length) {
      rows.push({ label: "到期", text: P.summonActText(def.onExpire) || "见技能说明" });
    }
    return rows;
  }

  P.summonDetail = function (state, uid) {
    var unit;
    try {
      unit = B.state.unitOf(state, uid);
    } catch (err) {
      return null;
    }
    if (!unit || !unit.isSummon) return null;
    var def = B.skills && B.skills.summonDef ? B.skills.summonDef(unit.summonKey) : null;
    var owner = null;
    try {
      owner = B.state.unitOf(state, unit.ownerUid);
    } catch (err) {
      owner = null;
    }
    var maxHp = B.state.maxHpOf(unit);
    var gaugeMax = B.rules.CONFIG.gaugeMax;
    var spd = B.state.spdOf(unit);
    var stats = [];
    if (unit.base.maxHp > 0 || unit.base.atk > 0 || unit.base.def > 0 || unit.base.mres > 0 || spd > 0) {
      stats.push({ label: P.STAT_LABEL.atk, text: String(B.state.statOf(unit, "atk")) });
      stats.push({ label: P.STAT_LABEL.def, text: String(B.state.defOf(unit)) });
      stats.push({ label: P.STAT_LABEL.mres, text: String(B.state.mresOf(unit)) });
      stats.push({ label: "血量", text: unit.hp + "/" + maxHp });
      stats.push({ label: "蓝", text: unit.mp + "/" + B.state.maxMpOf(unit) });
      stats.push({ label: P.STAT_LABEL.spd, text: String(spd) });
    }
    var statuses = (unit.statuses || []).map(function (st) {
      var name = st.label || P.STATUS_TEXT[st.kind] || st.kind;
      var text = STATUS_DESC[st.kind] || "";
      return { name: name, remain: st.remain, text: text ? text : "剩余 " + st.remain + " 标准回合" };
    });
    var buffs = (unit.buffs || []).map(function (b) {
      return {
        name: (BUFF_NAME[b.kind] || b.kind) + " " + b.percent + "%",
        text: (P.BUFF_TEXT[b.kind] || "") + b.percent + "%"
      };
    });
    var marks = [];
    Object.keys(unit.marks || {}).forEach(function (key) {
      var mark = unit.marks[key];
      marks.push({
        name: mark.name,
        text: mark.value + (mark.hideMax ? "" : "/" + mark.max)
      });
    });
    return {
      kind: "summon",
      name: unit.name,
      ownerName: owner ? owner.name : "",
      remain: unit.ttl ? unit.ttl.remain : null,
      targetable: !!unit.targetable,
      breakImmune: !!unit.breakImmune,
      taunt: Number(unit.taunt) || 0,
      stats: stats,
      hasAttack: !!(def && def.attack && def.attack.length),
      gauge: unit.gauge,
      gaugeMax: gaugeMax,
      spd: spd,
      actions: P.summonActions(def),
      statuses: statuses,
      buffs: buffs,
      marks: marks
    };
  }

  P.renderSummonBox = function (detail) {
    var meta = [];
    if (detail.ownerName) meta.push("召唤者 " + P.esc(detail.ownerName));
    meta.push(detail.remain == null ? "无时间限制" : "剩余 " + detail.remain + " 标准回合");
    if (!detail.targetable) meta.push("不可选中");
    if (detail.breakImmune) meta.push("免疫击溃");
    if (detail.taunt > 0) meta.push("嘲讽 " + detail.taunt);

    var html = '<div class="bb-detail is-summon"><h2>' + P.esc(detail.name) + "</h2>" +
      '<p class="bb-meta">' + meta.join(" · ") + "</p>";

    if (detail.stats.length) {
      html += '<div class="bb-stats">';
      detail.stats.forEach(function (item) {
        html += '<span class="bb-stat"><i>' + P.esc(item.label) + "</i><b>" + P.esc(item.text) + "</b></span>";
      });
      html += "</div>";
    } else {
      html += '<p class="bb-line">无面板</p>';
    }

    if (detail.hasAttack) {
      html += '<p class="bb-line">速度条 ' + detail.gauge + " / " + detail.gaugeMax + "</p>";
    }

    if (detail.actions.length) {
      html += '<ul class="bb-rows">';
      detail.actions.forEach(function (row) {
        html += "<li><b>" + P.esc(row.label) + "</b>" + P.esc(row.text) + "</li>";
      });
      html += "</ul>";
    }

    if (detail.statuses.length || detail.buffs.length || detail.marks.length) {
      html += '<ul class="bb-rows is-attached">';
      detail.buffs.forEach(function (item) {
        html += "<li><b>Buff</b>" + P.esc(item.name) + " · " + P.esc(item.text) + "</li>";
      });
      detail.statuses.forEach(function (item) {
        html += "<li><b>状态</b>" + P.esc(item.name) + (item.text ? "（" + P.esc(item.text) + "）" : "") + "</li>";
      });
      detail.marks.forEach(function (item) {
        html += "<li><b>标记</b>" + P.esc(item.name) + " " + P.esc(item.text) + "</li>";
      });
      html += "</ul>";
    }
    return html + "</div>";
  }

  P.chipDetail = function (state, spec) {
    if (!spec) return null;
    var parts = String(spec).split(":");
    var kind = parts[0];
    var uid = parts[1];
    var index = Number(parts[2]);
    if (kind === "summon") return P.summonDetail(state, uid);
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
    if (kind === "sumstatus") {
      var status = (unit.statuses || [])[index];
      if (!status) return null;
      return {
        kind: "status",
        name: status.label || P.STATUS_TEXT[status.kind] || status.kind,
        remain: status.remain,
        text: STATUS_DESC[status.kind] || ""
      };
    }
    var buff = (unit.buffs || [])[index];
    if (!buff) return null;
    return {
      kind: "buff",
      name: (BUFF_NAME[buff.kind] || buff.kind) + " " + buff.percent + "%",
      remain: buff.remain,
      text: (P.BUFF_TEXT[buff.kind] || "") + buff.percent + "%"
    };
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

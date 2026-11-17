/* 回合制正传 6.0 · 战斗界面 · 渲染
   只读 state 与角色档案，不改任何东西。所有交互钩子都用 data- 属性挂出去。
   拆成 2 个文件按顺序加载：battle-view.js → battle-view-effects.js，函数都挂在 RPG6BattleView 上。 */
/* 回合制正传 6.0 · 战斗界面 · 渲染
   只读 state 与角色档案，不改任何东西。所有交互钩子都用 data- 属性挂出去。 */
(function (root) {
  "use strict";

  var B = root.RPG6B;
  var P = root.RPG6BattleView = root.RPG6BattleView || {};

  P.STAT_LABEL = {
    atk: "攻击",
    def: "防御",
    mres: "法抗",
    maxHp: "血量",
    maxMp: "蓝上限",
    spd: "速度"
  };

  P.BUFF_TEXT = {
    strong: "受到伤害减少",
    fragile: "受到伤害增加",
    brave: "造成伤害增加",
    panic: "造成伤害减少"
  };

  P.STATUS_TEXT = {
    break: "击溃",
    stun: "眩晕",
    noSkill: "无法释放技能",
    noBasic: "无法普攻",
    noBreakOut: "伤害不造成击溃值",
    noDeath: "不会死亡",
    cannotAct: "无法行动",
    onlyBasic: "只能普攻"
  };



  P.statCell = function (unit, key) {
    var base = unit.base[key];
    var now = key === "maxHp" ? B.state.maxHpOf(unit) : key === "maxMp" ? B.state.maxMpOf(unit) : B.state.statOf(unit, key);
    var changed = Math.abs(now - base) > 0.001;
    var label = P.STAT_LABEL[key];
    if (!changed) return '<span class="stat"><i>' + label + '</i><b>' + now + '</b></span>';
    return '<span class="stat is-changed"><i>' + label + '</i><s>' + base + '</s><b>' + now + '</b></span>';
  }

  P.renderSpeed = function (state, rows) {
    var head = '<tr><th class="fc-round">回合</th>';
    state.units.forEach(function (unit) {
      head += '<th>' + P.esc(unit.name) + '<i>(' + B.state.spdOf(unit) + ')</i></th>';
    });
    head += "</tr>";

    var body = "";
    rows.forEach(function (row) {
      body += '<tr' + (row.cells[state.units[0].uid].current ? ' class="is-current"' : "") + ">";
      body += '<th class="fc-round">' + row.round + "</th>";
      state.units.forEach(function (unit) {
        var cell = row.cells[unit.uid];
        var slashes = "";
        for (var i = 0; i < cell.actions; i++) slashes += '<span class="slash"></span>';
        body += '<td><span class="fc-gauge">' + cell.gauge + slashes + "</span></td>";
      });
      body += "</tr>";
    });

    return '<table class="fc-table"><thead>' + head + "</thead><tbody>" + body + "</tbody></table>";
  }

  P.renderLog = function (unit) {
    var groups = [];
    var index = {};
    for (var i = 0; i < unit.hpLog.length; i++) {
      var entry = unit.hpLog[i];
      if (!index[entry.round]) {
        index[entry.round] = { round: entry.round, delta: 0 };
        groups.push(index[entry.round]);
      }
      index[entry.round].delta += entry.delta;
    }
    if (!groups.length) return '<p class="bu-log-empty">还没有血量变化</p>';
    var html = "";
    for (var g = 0; g < groups.length; g++) {
      var item = groups[g];
      var sign = item.delta > 0 ? "+" : "";
      html += '<div class="bu-log-row"><span>第 ' + item.round + " 回合</span><b class=\"" +
        (item.delta > 0 ? "is-gain" : "is-loss") + '">' + sign + item.delta + "</b></div>";
    }
    return html;
  }

  /* ---------------- 战斗日志 ---------------- */

  P.unitName = function (state, uid) {
    try {
      return B.state.unitOf(state, uid).name;
    } catch (err) {
      return uid || "?";
    }
  }

  /* 返回 { text, cls }；返回 null 的事件不进日志 */

  /* 桌面是常显的普通区块；紧凑布局才折成一行、点开成覆盖层 */
  P.renderBattleLog = function (state, open, collapsible) {
    var list = state.log || [];
    var start = Math.max(0, list.length - 160);
    var head = collapsible
      ? '<summary><span class="bl-title">战斗日志</span></summary>'
      : '<h2 class="bl-title">战斗日志</h2>';
    var html = collapsible
      ? '<details class="battle-log" data-log' + (open ? " open" : "") + ">" + head + '<ol class="bl-items">'
      : '<section class="battle-log" data-log>' + head + '<ol class="bl-items">';
    var rows = 0;
    for (var i = start; i < list.length; i++) {
      var line = P.eventLine(state, list[i]);
      if (!line) continue;
      rows += 1;
      html += '<li class="bl-row ' + line.cls + '">' + P.esc(line.text) + "</li>";
    }
    if (!rows) html += '<li class="bl-row is-empty">还没有事件</li>';
    html += collapsible ? "</ol></details>" : "</ol></section>";
    return html;
  }

  P.renderSummons = function (state, unit, pick) {
    var list = B.summons && B.summons.ofSide ? B.summons.ofSide(state, unit.side) : [];
    if (!list.length) return "";
    var html = '<section class="bu-summons"><span class="bu-summons-title">召唤物</span>';
    list.forEach(function (s) {
      var picked = pick && pick.targets && pick.targets.indexOf(s.uid) >= 0;
      var cls = "bu-summon" + (s.targetable ? " is-targetable" : " is-ghost") + (picked ? " is-picked" : "");
      var chips = "";
      (s.statuses || []).forEach(function (st) {
        chips += '<span class="bu-sum-status">' + P.esc(st.label || P.STATUS_TEXT[st.kind] || st.kind) + " " + st.remain + "</span>";
      });
      (s.buffs || []).forEach(function (b) {
        chips += '<span class="bu-sum-buff">' + P.esc(({ strong: "坚强", fragile: "脆弱", brave: "勇猛", panic: "恐慌" })[b.kind] || b.kind) + "%</span>";
      });
      var title = s.name + (s.targetable ? " · 血 " + s.hp + "/" + s.base.maxHp : "") +
        (s.ttl ? " · 剩 " + s.ttl.remain + " 回合" : "") + (s.targetable ? "" : " · 不可选中");
      html += '<button type="button" class="' + cls + '" data-summon="' + P.esc(s.uid) + '" title="' + P.esc(title) + '">' +
        "<b>" + P.esc(s.name) + "</b>" +
        (s.targetable ? '<span class="bu-sum-hp">' + s.hp + "/" + s.base.maxHp + "</span>" : "") +
        (s.ttl ? "<i>剩 " + s.ttl.remain + "</i>" : "") +
        chips + "</button>";
    });
    html += "</section>";
    return html;
  }

  P.renderUnit = function (state, unit, active, logUid, pick) {
    var openLog = logUid === unit.uid;
    var html = '<article class="battle-unit' + (active ? " is-active" : "") + (unit.hp <= 0 ? " is-dead" : "") +
      (openLog ? " is-log-open" : "") + '" data-unit="' + unit.uid + '">';
    html += '<header class="bu-head"><span class="bu-name">' + P.esc(unit.name) +
      "<i>（" + P.esc(unit.job || "无主业") + (unit.subJob ? "/" + P.esc(unit.subJob) : "") + "）</i></span>";
    html += '<span class="bu-vitals">蓝 <b>' + unit.mp + "</b>/" + B.state.maxMpOf(unit) +
      " · 血 <b>" + unit.hp + "</b>/" + B.state.maxHpOf(unit) + "</span></header>";

    html += '<div class="bu-stats">';
    ["atk", "def", "mres", "maxHp", "maxMp", "spd"].forEach(function (key) {
      html += P.statCell(unit, key);
    });
    html += "</div>";

    var chips = "";
    unit.buffs.forEach(function (buff, i) {
      chips += '<span class="chip" data-detail="buff:' + unit.uid + ":" + i + '">' +
        P.esc(({ strong: "坚强", fragile: "脆弱", brave: "勇猛", panic: "恐慌" })[buff.kind] || buff.kind) +
        " " + buff.percent + "%</span>";
    });
    (unit.effects || []).forEach(function (effect, i) {
      var left = effect.remain === B.state.PERMANENT ? "永久" : effect.remain + " 回合";
      chips += '<span class="chip is-effect" data-detail="effect:' + unit.uid + ":" + i + '">' +
        P.esc(effect.label || "持续效果") + " " + left + "</span>";
    });
    unit.statuses.forEach(function (status) {
      chips += '<span class="chip is-status">' + P.esc(status.label || P.STATUS_TEXT[status.kind] || status.kind) + " " + status.remain + "</span>";
    });
    if (unit.trait && unit.trait.lowHpBoost && unit.hp * 2 < B.state.maxHpOf(unit)) {
      chips += '<span class="chip is-status" title="斗士：血量低于 50% 时攻防速 ×1.5，向下取 5 的倍数">低血加成 攻防速 ×1.5</span>';
    }
    if (!chips) chips = '<span class="chip is-empty">无 Buff</span>';
    html += '<div class="bu-buffs">' + chips + "</div>";
    html += P.renderSummons(state, unit, pick);

    html += '<div class="bu-log">' + P.renderLog(unit) + "</div>";

    var chargeText = "未蓄力";
    if (unit.charge) {
      var chargeDef = B.skills ? B.skills.find(unit.charge.skillId) : null;
      var chargeName = chargeDef ? chargeDef.name : unit.charge.skillId;
      var chargeNeed = chargeDef && B.skills.effectiveCost
        ? B.skills.effectiveCost(unit, chargeDef).charge
        : (chargeDef ? (chargeDef.charge || 1) : "?");
      chargeText = "蓄力 " + chargeName + " " + unit.charge.amount + "/" + chargeNeed;
    }
    var charge = '<span class="bu-charge">' + P.esc(chargeText) + "</span>";

    var marks = "";
    Object.keys(unit.marks || {}).forEach(function (key) {
      var mark = unit.marks[key];
      marks += '<span class="bu-mark">' + P.esc(mark.name) + " " + mark.value +
        (mark.hideMax ? "" : "/" + mark.max) + "</span>";
    });
    html += '<footer class="bu-status"><span>行动 ' + unit.actionsLeft + "</span><span>击溃值 " +
      unit.breakValue + "</span><span>眩晕值 " + unit.stunValue + "</span>" + charge + marks +
      '<button type="button" class="bu-log-toggle">' + (openLog ? "▾伤害记录" : "▸伤害记录") + "</button>" +
      "</footer>";
    html += "</article>";
    return html;
  }

  P.renderQuery = function (state, unit, meta, pick, readOnly) {
    var character = meta[unit.uid] || { skills: [] };
    var active = !readOnly && state.turnUid === unit.uid && state.phase === "fight";
    var html = '<div class="battle-query' + (active ? " is-active" : "") + '" data-query="' + unit.uid + '">';

    var alias = (character.aliases && character.aliases.length) ? "[" + character.aliases.join("][") + "]" : "";
    html += '<header class="bq-head">' + P.esc(alias) + P.esc(unit.name) +
      "<i>（" + P.esc(unit.job || "无主业") + (unit.subJob ? "/" + P.esc(unit.subJob) : "") + "）</i></header>";

    html += '<div class="bq-stats">';
    ["atk", "def", "mres", "maxHp", "maxMp", "spd"].forEach(function (key) {
      html += "<span>" + P.STAT_LABEL[key] + " " + unit.base[key] + "</span>";
    });
    html += "</div>";

    var sheet = character.skills || [];
    html += '<ul class="bq-skills">';
    for (var i = 0; i < sheet.length; i++) {
      var row = sheet[i];
      var skill = P.findSkill(unit, row.name);
      var check = skill && active ? B.conditions.evaluate(state, unit, skill) : null;
      var disabled = !active || !skill || !!skill.unsupported || (check && !check.ok);
      var reason = !active
        ? "现在不是这个角色的回合"
        : (!skill ? "本版未编码这个技能" : (skill.unsupported || (check && check.reason) || ""));
      var picked = pick && (pick.mode === "skill" || pick.mode === "choice" || pick.mode === "input") && pick.id === (skill && skill.id);
      var condText = row.condition;
      if (skill && skill.costFromLost && B.skills.effectiveCost) {
        var eff = B.skills.effectiveCost(unit, skill);
        if (eff.mp !== ((skill.cost && skill.cost.mp) || 0) || eff.charge !== (skill.charge || 0)) {
          condText += "（已损失 " + (unit.hpLost || 0) + "：实际 " + eff.mp + "蓝" +
            (eff.charge ? eff.charge + "蓄力" : "") + "）";
        }
      }
      html += '<li class="bq-skill' + (disabled ? " is-disabled" : "") + (picked ? " is-picked" : "") + '"' +
        (skill ? ' data-skill="' + P.esc(skill.id) + '"' : "") +
        ' title="' + P.esc(reason) + '">' +
        '<span class="bq-skill-name">' + (i + 1) + "." + P.esc(row.name) + "</span>" +
        '<span class="bq-skill-cond">（' + P.esc(condText) + "）</span>" +
        '<span class="bq-skill-effect">' + P.esc(row.effect) + "</span>" +
        '<button type="button" class="bq-skill-toggle">效果</button>' +
        "</li>";
    }
    if (!sheet.length) html += '<li class="bq-skill is-disabled">这个角色没有技能档案</li>';
    html += "</ul>";

    var actions = [["attack", "普攻"], ["break", "击溃"], ["chargeMp", "蓄蓝"]];
    var healUid = active && B.skills && B.skills.basicHealTarget ? B.skills.basicHealTarget(state, unit) : null;
    html += '<div class="bq-actions">';
    for (var a = 0; a < actions.length; a++) {
      var kind = actions[a][0];
      var label = kind === "attack" && healUid ? "给" + B.state.unitOf(state, healUid).name + "回血" : actions[a][1];
      var pickedBasic = pick && pick.mode === "basic" && pick.type === kind;
      html += '<button type="button" class="btn btn-ghost bq-btn' + (pickedBasic ? " is-picked" : "") +
        '" data-basic="' + kind + '"' + (active ? "" : " disabled") + ">" + P.esc(label) + "</button>";
    }
    html += "</div>";

    if (active && pick && pick.mode === "choice") {
      var choiceSkill = B.skills.find(pick.id);
      if (choiceSkill && choiceSkill.owner === unit.name && choiceSkill.choices) {
        html += '<div class="bq-choice"><span class="bq-choice-label">选择这次造成的伤害</span>';
        choiceSkill.choices.forEach(function (item) {
          html += '<button type="button" class="btn btn-ghost bq-btn" data-choice="' + P.esc(item.key) + '">' +
            P.esc(item.label || item.key) + "</button>";
        });
        html += "</div>";
      }
    }
    if (active && pick && pick.mode === "input") {
      var inputSkill = B.skills.find(pick.id);
      if (inputSkill && inputSkill.owner === unit.name && inputSkill.input) {
        var min = Number(inputSkill.input.min) || 1;
        var max = inputSkill.input.max === "mp" || inputSkill.input.max == null
          ? unit.mp
          : Math.min(unit.mp, Number(inputSkill.input.max));
        max = Math.max(min, max);
        html += '<div class="bq-input"><span class="bq-choice-label">' +
          P.esc(inputSkill.input.label || "数值") + "（" + min + "–" + max + "）</span>" +
          '<input type="number" data-input-n min="' + min + '" max="' + max + '" value="' + max + '" inputmode="numeric">' +
          '<button type="button" class="btn btn-ghost bq-btn" data-input-go>释放</button></div>';
      }
    }
    html += "</div>";
    return html;
  }

  P.findSkill = function (unit, name) {
    var list = B.skills ? B.skills.forUnit(unit) : [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].name === name) return list[i];
    }
    return null;
  }

  P.renderBuffBox = function (detail) {
    if (!detail) {
      return '<p class="bb-empty">把鼠标放到 Buff 或持续效果上查看详情</p>';
    }
    var left = detail.remain === B.state.PERMANENT ? "永久" : detail.remain + " 标准回合";
    var kindText = detail.kind === "effect" ? "持续效果" : "Buff";
    return '<div class="bb-detail"><h2>' + P.esc(detail.name) + "</h2>" +
      '<p class="bb-meta"><b class="bb-kind">' + kindText + "</b> · 剩余 " + left + "</p>" +
      '<p class="bb-text">' + P.esc(detail.text) + "</p></div>";
  }

  P.renderBar = function (state, status, hint) {
    var turn = "对局结束";
    if (state.phase === "fight" && state.turnUid) {
      var unit = B.state.unitOf(state, state.turnUid);
      turn = "第 " + state.round + " 标准回合 · " + unit.name + " 行动（剩 " + unit.actionsLeft + "）";
    }
    return '<span class="bb-turn">' + P.esc(turn) + "</span>" +
      '<span class="bb-hint">' + P.esc(hint || status || "") + "</span>";
  }

  P.render = function (state, meta, pick, hint, options) {
    var readOnly = !!(options && options.readOnly);
    var speedOpen = !!(options && options.speedOpen);
    var logUid = (options && options.logUid) || "";
    var rows = P.buildForecast(state, 21);
    var parts = [];
    parts.push('<details class="battle-speed" data-speed' + (speedOpen ? " open" : "") + ">" +
      '<summary><span class="bs-title">速度条预期</span></summary>' +
      '<div class="bs-body">' + P.renderSpeed(state, rows) + "</div></details>");
    parts.push(P.renderUnit(state, state.units[0], state.turnUid === state.units[0].uid, logUid, pick));
    parts.push(P.renderUnit(state, state.units[1], state.turnUid === state.units[1].uid, logUid, pick));
    parts.push('<aside class="battle-buff" data-buffbox>' + P.renderBuffBox(null) + "</aside>");
    parts.push(P.renderQuery(state, state.units[0], meta, pick, readOnly));
    parts.push(P.renderQuery(state, state.units[1], meta, pick, readOnly));
    parts.push(P.renderBattleLog(state, !!(options && options.battleLogOpen),
      !!(options && options.battleLogCollapsible)));
    return parts.join("");
  }



  /* 持续效果的说明：优先用技能里写的 desc，没有就按 ops 拼一句 */

  /* spec 形如 "buff:a:0" / "effect:b:1" */


  root.BattleView = {
    render: P.render,
    renderBar: P.renderBar,
    renderBuffBox: P.renderBuffBox,
    chipDetail: function () { return P.chipDetail.apply(null, arguments); },
    buildForecast: function () { return P.buildForecast.apply(null, arguments); },
    STAT_LABEL: P.STAT_LABEL
  };
})(typeof globalThis !== "undefined" ? globalThis : this);

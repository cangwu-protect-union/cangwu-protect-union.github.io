/* 回合制正传 6.0 · 战斗界面 · 渲染
   只读 state 与角色档案，不改任何东西。所有交互钩子都用 data- 属性挂出去。 */
(function (root) {
  "use strict";

  var B = root.RPG6B;

  var STAT_LABEL = {
    atk: "攻击",
    def: "防御",
    mres: "法抗",
    maxHp: "血量",
    maxMp: "蓝上限",
    spd: "速度"
  };

  var BUFF_TEXT = {
    strong: "受到伤害减少",
    fragile: "受到伤害增加",
    brave: "造成伤害增加",
    panic: "造成伤害减少"
  };

  var STATUS_TEXT = {
    break: "击溃",
    stun: "眩晕",
    noSkill: "无法释放技能",
    noBasic: "无法普攻",
    noBreakOut: "伤害不造成击溃值",
    noDeath: "不会死亡"
  };

  function esc(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function statCell(unit, key) {
    var base = unit.base[key];
    var now = key === "maxHp" ? B.state.maxHpOf(unit) : key === "maxMp" ? B.state.maxMpOf(unit) : B.state.statOf(unit, key);
    var changed = Math.abs(now - base) > 0.001;
    var label = STAT_LABEL[key];
    if (!changed) return '<span class="stat"><i>' + label + '</i><b>' + now + '</b></span>';
    return '<span class="stat is-changed"><i>' + label + '</i><s>' + base + '</s><b>' + now + '</b></span>';
  }

  function renderSpeed(state, rows) {
    var head = '<tr><th class="fc-round">回合</th>';
    state.units.forEach(function (unit) {
      head += '<th>' + esc(unit.name) + '<i>(' + B.state.spdOf(unit) + ')</i></th>';
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

  function renderLog(unit) {
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

  function renderUnit(state, unit, active) {
    var html = '<article class="battle-unit' + (active ? " is-active" : "") + (unit.hp <= 0 ? " is-dead" : "") + '" data-unit="' + unit.uid + '">';
    html += '<header class="bu-head"><span class="bu-name">' + esc(unit.name) +
      "<i>（" + esc(unit.job || "无主业") + (unit.subJob ? "/" + esc(unit.subJob) : "") + "）</i></span>";
    html += '<span class="bu-vitals">蓝 <b>' + unit.mp + "</b>/" + B.state.maxMpOf(unit) +
      " · 血 <b>" + unit.hp + "</b>/" + B.state.maxHpOf(unit) + "</span></header>";

    html += '<div class="bu-stats">';
    ["atk", "def", "mres", "maxHp", "maxMp", "spd"].forEach(function (key) {
      html += statCell(unit, key);
    });
    html += "</div>";

    var chips = "";
    unit.buffs.forEach(function (buff, i) {
      chips += '<span class="chip" data-buff="' + unit.uid + ":" + i + '">' +
        esc(({ strong: "坚强", fragile: "脆弱", brave: "勇猛", panic: "恐慌" })[buff.kind] || buff.kind) +
        " " + buff.percent + "%</span>";
    });
    unit.statuses.forEach(function (status) {
      chips += '<span class="chip is-status">' + esc(STATUS_TEXT[status.kind] || status.kind) + " " + status.remain + "</span>";
    });
    if (!chips) chips = '<span class="chip is-empty">无 Buff</span>';
    html += '<div class="bu-buffs">' + chips + "</div>";

    html += '<div class="bu-log">' + renderLog(unit) + "</div>";

    var chargeText = "未蓄力";
    if (unit.charge) {
      var chargeDef = B.skills ? B.skills.find(unit.charge.skillId) : null;
      var chargeName = chargeDef ? chargeDef.name : unit.charge.skillId;
      chargeText = "蓄力 " + chargeName + " " + unit.charge.amount + "/" + (chargeDef ? (chargeDef.charge || 1) : "?");
    }
    var charge = '<span class="bu-charge">' + esc(chargeText) + "</span>";

    var marks = "";
    Object.keys(unit.marks || {}).forEach(function (key) {
      var mark = unit.marks[key];
      marks += '<span class="bu-mark">' + esc(mark.name) + " " + mark.value + "/" + mark.max + "</span>";
    });
    html += '<footer class="bu-status"><span>行动 ' + unit.actionsLeft + "</span><span>击溃值 " +
      unit.breakValue + "</span><span>眩晕值 " + unit.stunValue + "</span>" + charge + marks + "</footer>";
    html += "</article>";
    return html;
  }

  function renderQuery(state, unit, meta, pick, readOnly) {
    var character = meta[unit.uid] || { skills: [] };
    var active = !readOnly && state.turnUid === unit.uid && state.phase === "fight";
    var html = '<div class="battle-query' + (active ? " is-active" : "") + '" data-query="' + unit.uid + '">';

    var alias = (character.aliases && character.aliases.length) ? "[" + character.aliases.join("][") + "]" : "";
    html += '<header class="bq-head">' + esc(alias) + esc(unit.name) +
      "<i>（" + esc(unit.job || "无主业") + (unit.subJob ? "/" + esc(unit.subJob) : "") + "）</i></header>";

    html += '<div class="bq-stats">';
    ["atk", "def", "mres", "maxHp", "maxMp", "spd"].forEach(function (key) {
      html += "<span>" + STAT_LABEL[key] + " " + unit.base[key] + "</span>";
    });
    html += "</div>";

    var sheet = character.skills || [];
    html += '<ul class="bq-skills">';
    for (var i = 0; i < sheet.length; i++) {
      var row = sheet[i];
      var skill = findSkill(unit, row.name);
      var check = skill && active ? B.conditions.evaluate(state, unit, skill) : null;
      var disabled = !active || !skill || !!skill.unsupported || (check && !check.ok);
      var reason = !active
        ? "现在不是这个角色的回合"
        : (!skill ? "本版未编码这个技能" : (skill.unsupported || (check && check.reason) || ""));
      var picked = pick && pick.mode === "skill" && pick.id === (skill && skill.id);
      html += '<li class="bq-skill' + (disabled ? " is-disabled" : "") + (picked ? " is-picked" : "") + '"' +
        (skill ? ' data-skill="' + esc(skill.id) + '"' : "") +
        ' title="' + esc(reason) + '">' +
        '<span class="bq-skill-name">' + (i + 1) + "." + esc(row.name) + "</span>" +
        '<span class="bq-skill-cond">（' + esc(row.condition) + "）</span>" +
        '<span class="bq-skill-effect">' + esc(row.effect) + "</span></li>";
    }
    if (!sheet.length) html += '<li class="bq-skill is-disabled">这个角色没有技能档案</li>';
    html += "</ul>";

    var actions = [["attack", "普攻"], ["break", "击溃"], ["chargeMp", "蓄蓝"]];
    html += '<div class="bq-actions">';
    for (var a = 0; a < actions.length; a++) {
      var kind = actions[a][0];
      var pickedBasic = pick && pick.mode === "basic" && pick.type === kind;
      html += '<button type="button" class="btn btn-ghost bq-btn' + (pickedBasic ? " is-picked" : "") +
        '" data-basic="' + kind + '"' + (active ? "" : " disabled") + ">" + actions[a][1] + "</button>";
    }
    html += "</div></div>";
    return html;
  }

  function findSkill(unit, name) {
    var list = B.skills ? B.skills.forUnit(unit) : [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].name === name) return list[i];
    }
    return null;
  }

  function renderBuffBox(detail) {
    if (!detail) {
      return '<p class="bb-empty">把鼠标放到 Buff 图标上查看详情</p>';
    }
    return '<div class="bb-detail"><h2>' + esc(detail.name) + "</h2>" +
      '<p class="bb-meta">剩余 ' + detail.remain + " 标准回合</p>" +
      '<p class="bb-text">' + esc(detail.text) + "</p></div>";
  }

  function renderBar(state, status, hint) {
    var turn = "对局结束";
    if (state.phase === "fight" && state.turnUid) {
      var unit = B.state.unitOf(state, state.turnUid);
      turn = "第 " + state.round + " 标准回合 · " + unit.name + " 行动（剩 " + unit.actionsLeft + "）";
    }
    return '<span class="bb-turn">' + esc(turn) + "</span>" +
      '<span class="bb-hint">' + esc(hint || status || "") + "</span>";
  }

  function render(state, meta, pick, hint, options) {
    var readOnly = !!(options && options.readOnly);
    var rows = buildForecast(state, 21);
    var parts = [];
    parts.push('<div class="battle-speed" data-speed><h2 class="bs-title">速度条预期</h2>' + renderSpeed(state, rows) + "</div>");
    parts.push(renderUnit(state, state.units[0], state.turnUid === state.units[0].uid));
    parts.push(renderUnit(state, state.units[1], state.turnUid === state.units[1].uid));
    parts.push('<aside class="battle-buff" data-buffbox>' + renderBuffBox(null) + "</aside>");
    parts.push(renderQuery(state, state.units[0], meta, pick, readOnly));
    parts.push(renderQuery(state, state.units[1], meta, pick, readOnly));
    return parts.join("");
  }

  function buildForecast(state, rows) {
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

  function buffDetail(state, key) {
    if (!key) return null;
    var parts = key.split(":");
    var unit = B.state.unitOf(state, parts[0]);
    var buff = unit.buffs[Number(parts[1])];
    if (!buff) return null;
    var name = ({ strong: "坚强", fragile: "脆弱", brave: "勇猛", panic: "恐慌" })[buff.kind] || buff.kind;
    return {
      name: name + " " + buff.percent + "%",
      remain: buff.remain,
      text: (BUFF_TEXT[buff.kind] || "") + buff.percent + "%"
    };
  }

  root.BattleView = {
    render: render,
    renderBar: renderBar,
    renderBuffBox: renderBuffBox,
    buffDetail: buffDetail,
    buildForecast: buildForecast,
    STAT_LABEL: STAT_LABEL
  };
})(typeof globalThis !== "undefined" ? globalThis : this);

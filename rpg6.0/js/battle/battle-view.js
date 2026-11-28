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
    panic: "造成伤害减少",
    magicVuln: "下次受到法伤翻倍"
  };

  P.STATUS_TEXT = {
    break: "击溃",
    stun: "眩晕",
    noSkill: "无法释放技能",
    noBasic: "无法普攻",
    noCharge: "无法蓄力",
    daze: "眩晕（防抗 0）",
    noBreakOut: "伤害不造成击溃值",
    noDeath: "不会死亡",
    cannotAct: "无法行动",
    onlyBasic: "只能普攻"
  };



  P.statCell = function (unit, key) {
    var atkExpr = key === "atk" && B.skills && B.skills.basicAtkOf ? B.skills.basicAtkOf(unit) : null;
    if (atkExpr) {
      /* 动态普攻面板（孙嘉怿）：没有固定攻击值，显示 − 并在下方标注规则 */
      var note = atkExpr.hpPercent
        ? "受攻击者当前血量的" + (Number(atkExpr.percent) || 0) + "%"
        : "按公式计算";
      return '<span class="stat is-dynamic"><i>' + P.STAT_LABEL[key] + '</i><b>−</b><em>' +
        P.esc(note) + "</em></span>";
    }
    var base = unit.base[key];
    var now = key === "maxHp" ? B.state.maxHpOf(unit) : key === "maxMp" ? B.state.maxMpOf(unit) : B.state.statOf(unit, key);
    var changed = Math.abs(now - base) > 0.001;
    var label = P.STAT_LABEL[key];
    if (!changed) return '<span class="stat"><i>' + label + '</i><b>' + now + '</b></span>';
    return '<span class="stat is-changed"><i>' + label + '</i><s>' + base + '</s><b>' + now + '</b></span>';
  }

  P.renderSpeed = function (state, rows, ownSide) {
    var units = ownSide === "b" ? [state.units[1], state.units[0]] : state.units;
    var labeled = ownSide === "a" || ownSide === "b";
    var head = '<tr><th class="fc-round">回合</th>';
    units.forEach(function (unit, idx) {
      var tag = labeled ? (idx === 0 ? "己方 · " : "敌方 · ") : "";
      head += '<th>' + P.esc(tag + unit.name) + '<i>(' + B.state.spdOf(unit) + ')</i></th>';
    });
    head += "</tr>";

    var body = "";
    rows.forEach(function (row) {
      body += '<tr' + (row.cells[state.units[0].uid].current ? ' class="is-current"' : "") + ">";
      body += '<th class="fc-round">' + row.round + "</th>";
      units.forEach(function (unit) {
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

  /* 可视化血条：宽度用内部算出的整数百分比，颜色按血量比例三档 */
  P.renderVitalBars = function (unit) {
    var maxHp = B.state.maxHpOf(unit) || 1;
    var hp = Math.max(0, Math.min(unit.hp, maxHp));
    var hpPct = Math.max(0, Math.min(100, Math.round(hp / maxHp * 100)));
    var tone = hpPct > 60 ? "is-high" : hpPct > 30 ? "is-mid" : "is-low";
    return '<div class="bu-bars">' +
      '<span class="bu-hp-bar ' + tone + '"><i style="width:' + hpPct + '%"></i><b>血 ' +
        hp + "/" + maxHp + " · " + hpPct + '%</b></span>' +
      "</div>";
  }

  /* 扣血记录窗：左右两栏，按标准回合合并，底部各栏合计 */
  P.renderHpRecord = function (state, ownSide) {
    var leftIdx = ownSide === "b" ? 1 : 0;
    var rightIdx = leftIdx === 0 ? 1 : 0;
    var left = state.units[leftIdx];
    var right = state.units[rightIdx];

    function column(unit, label, sideKey) {
      var groups = [];
      var index = {};
      var hpLog = unit.hpLog || [];
      for (var i = 0; i < hpLog.length; i++) {
        var entry = hpLog[i];
        if (!index[entry.round]) {
          index[entry.round] = { round: entry.round, delta: 0 };
          groups.push(index[entry.round]);
        }
        index[entry.round].delta += entry.delta;
      }
      var html = '<section class="lw-hp-col" data-hp-side="' + sideKey + '">' +
        "<h3>" + P.esc(label) + "</h3>";
      if (!groups.length) {
        html += '<p class="bu-log-empty">还没有血量变化</p>';
      } else {
        var total = 0;
        for (var g = 0; g < groups.length; g++) {
          var item = groups[g];
          total += item.delta;
          var sign = item.delta > 0 ? "+" : "";
          html += '<div class="bu-log-row"><span>第 ' + item.round + " 回合</span><b class=\"" +
            (item.delta > 0 ? "is-gain" : "is-loss") + '">' + sign + item.delta + "</b></div>";
        }
        var totalSign = total > 0 ? "+" : "";
        html += '<div class="lw-hp-total"><span>合计</span><b class="' +
          (total > 0 ? "is-gain" : "is-loss") + '">' + totalSign + total + "</b></div>";
      }
      html += "</section>";
      return html;
    }

    return '<div class="lw-hp-grid">' +
      column(left, "己方 · " + left.name, left.side || (leftIdx === 0 ? "a" : "b")) +
      column(right, "敌方 · " + right.name, right.side || (rightIdx === 0 ? "a" : "b")) +
      "</div>";
  }

  /* 详细战报窗：完整日志，不带 <details>，滚动由舞台处理 */
  P.renderLogWindow = function (state) {
    var list = state.log || [];
    var html = "";
    var rows = 0;
    for (var i = 0; i < list.length; i++) {
      var line = P.eventLine(state, list[i]);
      if (!line) continue;
      rows += 1;
      html += '<li class="bl-row ' + line.cls + '">' + P.esc(line.text) + "</li>";
    }
    if (!rows) html += '<li class="bl-row is-empty">还没有事件</li>';
    return '<ol class="bl-items lw-log-rows">' + html + "</ol>";
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

  /* 桌面与手机都折成可点标题的 <details>（触发方式同手机端）。
     桌面折叠态在标题下预览上一个有效回合，展开态铺出完整日志；
     手机折叠态只留标题行、展开铺满视口，由 CSS 紧凑断点处理。 */

  P.renderLogPreview = function (state) {
    var list = state.log || [];
    var lastRound = null;
    for (var i = list.length - 1; i >= 0; i--) {
      var probe = P.eventLine(state, list[i]);
      if (!probe || probe.cls === "is-round") continue;
      lastRound = list[i].round;
      break;
    }
    var html = "";
    if (lastRound != null) {
      for (var j = 0; j < list.length; j++) {
        if (list[j].round !== lastRound) continue;
        var line = P.eventLine(state, list[j]);
        if (!line || line.cls === "is-round") continue;
        html += '<li class="bl-row ' + line.cls + '">' + P.esc(line.text) + "</li>";
      }
    }
    if (!html) html = '<li class="bl-row is-empty">还没有事件</li>';
    return '<ol class="bl-items bl-preview">' + html + "</ol>";
  }

  P.renderBattleLog = function (state, open, preview) {
    var list = state.log || [];
    var head = '<summary><span class="bl-title">战斗日志</span>' +
      (preview ? P.renderLogPreview(state) : "") + "</summary>";
    var html = '<details class="battle-log" data-log' + (open ? " open" : "") + ">" + head + '<ol class="bl-items">';
    var rows = 0;
    for (var i = 0; i < list.length; i++) {
      var line = P.eventLine(state, list[i]);
      if (!line) continue;
      rows += 1;
      html += '<li class="bl-row ' + line.cls + '">' + P.esc(line.text) + "</li>";
    }
    if (!rows) html += '<li class="bl-row is-empty">还没有事件</li>';
    html += "</ol></details>";
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
      (s.statuses || []).forEach(function (st, i) {
        chips += '<span class="bu-sum-status" data-detail="sumstatus:' + s.uid + ":" + i + '">' +
          P.esc(st.label || P.STATUS_TEXT[st.kind] || st.kind) + " " + st.remain + "</span>";
      });
      (s.buffs || []).forEach(function (b, i) {
        chips += '<span class="bu-sum-buff" data-detail="sumbuff:' + s.uid + ":" + i + '">' +
          P.esc(({ strong: "坚强", fragile: "脆弱", brave: "勇猛", panic: "恐慌" })[b.kind] || b.kind) + "%</span>";
      });
      var def = B.skills && B.skills.summonDef ? B.skills.summonDef(s.summonKey) : null;
      var pace = "";
      if (def && def.attack && s.base && s.base.spd > 0) {
        var spd = B.state.spdOf(s);
        if (spd > 0) pace = " · 速度 " + spd + "（每 " + Math.ceil(B.rules.CONFIG.gaugeMax / spd) + " 回合攻击）";
      }
      var title = s.name + (s.targetable ? " · 血 " + s.hp + "/" + s.base.maxHp : "") +
        (s.ttl ? " · 剩 " + s.ttl.remain + " 回合" : "") + pace +
        (s.targetable ? "" : " · 不可选中");
      html += '<button type="button" class="' + cls + '" data-summon="' + P.esc(s.uid) +
        '" data-summondetail="' + P.esc(s.uid) + '" title="' + P.esc(title) + '">' +
        "<b>" + P.esc(s.name) + "</b>" +
        (s.targetable ? '<span class="bu-sum-hp">' + s.hp + "/" + s.base.maxHp + "</span>" : "") +
        (s.ttl ? "<i>剩 " + s.ttl.remain + "</i>" : "") +
        chips + "</button>";
    });
    html += "</section>";
    return html;
  }

  P.renderUnit = function (state, unit, active, logUid, pick, opts) {
    var options = opts || {};
    var openLog = logUid === unit.uid;
    var html = '<article class="battle-unit' + (active ? " is-active" : "") + (unit.hp <= 0 ? " is-dead" : "") +
      (openLog ? " is-log-open" : "") + '" data-unit="' + unit.uid + '">';
    html += '<header class="bu-head"><span class="bu-name">' + P.esc(unit.name) +
      "<i>（" + P.esc(unit.job || "无主业") + (unit.subJob ? "/" + P.esc(unit.subJob) : "") + "）</i></span>";
    html += '<span class="bu-vitals">蓝 <b>' + unit.mp + "</b>/" + B.state.maxMpOf(unit) +
      " · 血 <b>" + unit.hp + "</b>/" + B.state.maxHpOf(unit) + "</span></header>";

    if (options.bars) html += P.renderVitalBars(unit);

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
      /* 防护层显示剩余可取消次数，而不是标准回合 */
      if (effect.guard) left = "剩 " + effect.guard.remaining + " 次";
      chips += '<span class="chip is-effect" data-detail="effect:' + unit.uid + ":" + i + '">' +
        P.esc(effect.label || "持续效果") + " " + left + "</span>";
    });
    if (unit.shield) {
      chips += '<span class="chip is-shield">护盾 ' + Math.max(0, unit.shield.hp) +
        "（剩 " + unit.shield.remain + " 回合）</span>";
    }
    unit.statuses.forEach(function (status) {
      chips += '<span class="chip is-status">' + P.esc(status.label || P.STATUS_TEXT[status.kind] || status.kind) + " " + status.remain + "</span>";
    });
    if (unit.trait && unit.trait.lowHpBoost && unit.hp * 2 < B.state.maxHpOf(unit)) {
      chips += '<span class="chip is-status" title="斗士：血量低于 50% 时攻防速 ×1.5，向下取 5 的倍数">低血加成 攻防速 ×1.5</span>';
    }
    if (!chips) chips = '<span class="chip is-empty">无 Buff</span>';
    html += '<div class="bu-buffs">' + chips + "</div>";
    if (!options.hideSummons) html += P.renderSummons(state, unit, pick);

    if (!options.hideLog) html += '<div class="bu-log">' + P.renderLog(unit) + "</div>";

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
      (options.hideLog ? "" : '<button type="button" class="bu-log-toggle">' +
        (openLog ? "▾伤害记录" : "▸伤害记录") + "</button>") +
      "</footer>";
    html += "</article>";
    return html;
  }

  P.renderQuery = function (state, unit, meta, pick, readOnly, opts) {
    var options = opts || {};
    var character = meta[unit.uid] || { skills: [] };
    var active = !readOnly && state.turnUid === unit.uid && state.phase === "fight";
    var html = '<div class="battle-query' + (active ? " is-active" : "") + '" data-query="' + unit.uid + '">';

    var alias = (character.aliases && character.aliases.length) ? "[" + character.aliases.join("][") + "]" : "";
    html += '<header class="bq-head">' + P.esc(alias) + P.esc(unit.name) +
      "<i>（" + P.esc(unit.job || "无主业") + (unit.subJob ? "/" + P.esc(unit.subJob) : "") + "）</i></header>";

    if (!options.hideStats) {
      html += '<div class="bq-stats">';
      var atkExpr = B.skills && B.skills.basicAtkOf ? B.skills.basicAtkOf(unit) : null;
      ["atk", "def", "mres", "maxHp", "maxMp", "spd"].forEach(function (key) {
        if (key === "atk" && atkExpr) {
          /* 动态普攻面板（孙嘉怿）：攻击格没有固定值，显示 − 并在下方标注实际规则 */
          var note = atkExpr.hpPercent
            ? "受攻击者当前血量的" + (Number(atkExpr.percent) || 0) + "%"
            : "按公式计算";
          html += '<span class="bq-stat is-dynamic">' + P.STAT_LABEL[key] + " −" +
            '<em class="bq-stat-note">' + P.esc(note) + "</em></span>";
          return;
        }
        html += "<span>" + P.STAT_LABEL[key] + " " + unit.base[key] + "</span>";
      });
      html += "</div>";
    }

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
      var condText = "（" + row.condition + "）";
      if (skill && skill.costFromLost && B.skills.effectiveCost) {
        var eff = B.skills.effectiveCost(unit, skill);
        if (eff.mp !== ((skill.cost && skill.cost.mp) || 0) || eff.charge !== (skill.charge || 0)) {
          condText += "（当前：" + eff.mp + "蓝" + (eff.charge ? eff.charge + "蓄力" : "") + "）";
        }
      }
      html += '<li class="bq-skill' + (disabled ? " is-disabled" : "") + (picked ? " is-picked" : "") + '"' +
        (skill ? ' data-skill="' + P.esc(skill.id) + '"' : "") +
        ' title="' + P.esc(reason) + '">' +
        '<span class="bq-skill-name">' + (i + 1) + "." + P.esc(row.name) + "</span>" +
        '<span class="bq-skill-cond">' + P.esc(condText) + "</span>" +
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
    /* 额外动作（unlock/item）在 battle-view-effects.js 的 renderExtraActions 里渲染，放在操作行之外 */
    html += P.renderExtraActions(state, unit, pick, active);

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

  /* 角色详情窗：左右两列（左己方、右敌方），列该角色全部技能；只读，不带操作按钮 */
  P.renderRoleDetail = function (state, ownSide, meta) {
    var leftIdx = ownSide === "b" ? 1 : 0;
    var rightIdx = leftIdx === 0 ? 1 : 0;
    var left = state.units[leftIdx];
    var right = state.units[rightIdx];

    function column(unit, label) {
      var character = (meta && meta[unit.uid]) || { skills: [] };
      var sheet = character.skills || [];
      var html = '<section class="lw-hp-col lw-skill-col">' +
        "<h3>" + P.esc(label) + "</h3>";
      if (!sheet.length) {
        html += '<p class="bu-log-empty">这个角色没有技能档案</p>';
      } else {
        html += '<ol class="lw-skill-list">';
        for (var i = 0; i < sheet.length; i++) {
          var row = sheet[i];
          var skill = P.findSkill(unit, row.name);
          var cls = !skill ? " is-missing" : (skill.unsupported ? " is-unsupported" : "");
          html += '<li class="lw-skill-row' + cls + '">' +
            '<div class="lw-skill-name"><b>' + (i + 1) + ".</b>" + P.esc(row.name) +
            (!skill ? '<i class="lw-skill-tag">未编码</i>'
              : (skill.unsupported ? '<i class="lw-skill-tag">本版不可用</i>' : "")) +
            "</div>" +
            '<div class="lw-skill-cond">' + P.esc(row.condition) + "</div>" +
            '<div class="lw-skill-effect">' + P.esc(row.effect) + "</div>" +
            "</li>";
        }
        html += "</ol>";
      }
      html += "</section>";
      return html;
    }

    return '<div class="lw-hp-grid lw-skill-grid">' +
      column(left, "己方 · " + left.name) +
      column(right, "敌方 · " + right.name) +
      "</div>";
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
      return '<p class="bb-empty">把鼠标放到 Buff、持续效果或召唤物上查看详情</p>';
    }
    if (detail.kind === "summon") return P.renderSummonBox(detail);
    var left = detail.remain === B.state.PERMANENT ? "永久" : detail.remain + " 标准回合";
    var kindText = detail.kind === "effect" ? "持续效果" : detail.kind === "status" ? "状态" : "Buff";
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
      !!(options && options.battleLogPreview)));
    return parts.join("");
  }



  /* 持续效果的说明：优先用技能里写的 desc，没有就按 ops 拼一句 */

  /* spec 形如 "buff:a:0" / "effect:b:1" */


  root.BattleView = {
    render: P.render,
    renderBar: P.renderBar,
    renderBuffBox: P.renderBuffBox,
    renderSpeed: function () { return P.renderSpeed.apply(null, arguments); },
    renderUnit: function () { return P.renderUnit.apply(null, arguments); },
    renderQuery: function () { return P.renderQuery.apply(null, arguments); },
    renderHpRecord: function () { return P.renderHpRecord.apply(null, arguments); },
    renderLogWindow: function () { return P.renderLogWindow.apply(null, arguments); },
    renderRoleDetail: function () { return P.renderRoleDetail.apply(null, arguments); },
    chipDetail: function () { return P.chipDetail.apply(null, arguments); },
    buildForecast: function () { return P.buildForecast.apply(null, arguments); },
    STAT_LABEL: P.STAT_LABEL
  };
})(typeof globalThis !== "undefined" ? globalThis : this);

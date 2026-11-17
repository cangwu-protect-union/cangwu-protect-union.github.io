/* 回合制正传 6.0 · 战斗界面 · 页面装配
   三种模式：play（对局）、replay（回放战报）、以及开局前的选人。
   所有规则都在引擎里，这里只调度、存档与提示。 */
(function (root) {
  "use strict";

  var B = root.RPG6B;
  var BASE_TITLE = "回合制正传 6.0 · 对局测试";
  var LIVE_KEY = "rpg6-live-battle";

  var dom = {};
  var roster = [];
  var byName = {};
  var state = null;
  var meta = { a: null, b: null };
  var history = [];
  var actions = [];
  var pick = root.BattlePick.create();
  var hint = "";
  var mode = "play";
  var replayStates = [];
  var replayIndex = 0;
  var replayRecord = null;
  var oldEngine = false;
  var saved = false;
  var saving = false;
  var saveTried = false;
  var recordId = "";
  var saveError = "";
  var speedOpen = null;
  var openSkills = {};
  var logUid = "";
  var battleLogOpen = null;

  function $(sel, ctx) {
    return (ctx || document).querySelector(sel);
  }

  function esc(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ---------------- 选人 ---------------- */

  function coveredNames() {
    var out = {};
    var lib = window.RPG6_SKILLS && window.RPG6_SKILLS.characters ? window.RPG6_SKILLS.characters : {};
    Object.keys(lib).forEach(function (name) {
      if (lib[name] && lib[name].length) out[name] = true;
    });
    return out;
  }

  function dedupe(list, names) {
    var seen = {};
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (!item || item.deleted) continue;
      if (names && !names[item.name]) continue;
      if (seen[item.name]) continue;
      seen[item.name] = true;
      out.push(item);
    }
    out.sort(function (x, y) {
      return String(x.name).localeCompare(String(y.name), "zh-Hans-CN");
    });
    return out;
  }

  function loadCharacters() {
    var names = coveredNames();
    var allSeeds = (window.RPG_SEED_CHARACTERS || []).filter(function (char) {
      return char && !char.deleted;
    });
    var seeds = dedupe(allSeeds, names);

    if (!window.RpgData || typeof window.RpgData.listAll !== "function") {
      return Promise.resolve({ list: seeds, source: "本地副本", total: allSeeds.length });
    }

    var fallback = function (why) {
      return { list: seeds, source: "本地副本（" + why + "）", total: allSeeds.length };
    };

    var timeout = new Promise(function (resolve) {
      setTimeout(function () { resolve(fallback("数据库超时")); }, 4000);
    });

    var remote = window.RpgData.listAll().then(function (list) {
      var all = (list || []).filter(function (char) { return char && !char.deleted; });
      var picked = dedupe(all, names);
      if (!picked.length) return fallback("数据库为空");
      return { list: picked, source: "数据库", total: all.length };
    }).catch(function () {
      return fallback("数据库不可用");
    });

    return { now: Promise.race([remote, timeout]), remote: remote };
  }

  function fillSelects(source, total) {
    var options = roster.map(function (char) {
      return '<option value="' + esc(char.name) + '">' + esc(char.name) +
        "（" + esc(char.occupation || "无主业") + (char.side_job ? "/" + esc(char.side_job) : "") + "）</option>";
    }).join("");

    dom.pickA.innerHTML = options;
    dom.pickB.innerHTML = options;
    if (roster.length > 1) dom.pickB.selectedIndex = 1;
    dom.source.textContent = "角色数据：" + source + " · 可上场 " + roster.length +
      (total ? " / 共 " + total + " 名" : "");
    if (dom.coverage) dom.coverage.textContent = coverageText();
  }

  /* 页面上的角色数/技能数只在这里算，不写字面量：技能库一加人，提示自动跟上 */
  function coverageText() {
    var lib = window.RPG6_SKILLS && window.RPG6_SKILLS.characters ? window.RPG6_SKILLS.characters : null;
    var chars = lib ? Object.keys(lib).length : 0;
    var skills = B.skills && B.skills.all ? B.skills.all().length : 0;
    if (!chars || !skills) return "技能库没有加载成功，对局功能不可用。";
    return "技能库覆盖 " + chars + " 名角色、" + skills + " 条技能，其余角色不会出现在列表里。" +
      "同一种子加同一串操作必然复现同一局。对局结束后战报自动入库，刷新中途可以从「继续上一局」接着打。";
  }

  function applyRoster(result) {
    roster = result.list;
    byName = {};
    roster.forEach(function (char) {
      byName[char.name] = char;
    });
    B.skills.validate(roster);
    fillSelects(result.source, result.total);
  }

  /* ---------------- 本地续战 ---------------- */

  function readLive() {
    try {
      return JSON.parse(root.localStorage.getItem(LIVE_KEY) || "null");
    } catch (err) {
      return null;
    }
  }

  function writeLive() {
    if (!state || mode !== "play") return;
    try {
      root.localStorage.setItem(LIVE_KEY, JSON.stringify({
        seed: state.seed,
        a: meta.a.id,
        b: meta.b.id,
        actions: actions
      }));
    } catch (err) {
      /* 存不下就算了，不影响对局 */
    }
  }

  function clearLive() {
    try {
      root.localStorage.removeItem(LIVE_KEY);
    } catch (err) {
      /* ignore */
    }
  }

  function offerResume() {
    var live = readLive();
    if (!live || !dom.resume) return;
    var a = null;
    var b = null;
    for (var i = 0; i < roster.length; i++) {
      if (roster[i].id === live.a) a = roster[i];
      if (roster[i].id === live.b) b = roster[i];
    }
    if (!a || !b || !live.actions || !live.actions.length) return;
    dom.resume.hidden = false;
    dom.resume.textContent = "继续上一局：" + a.name + " vs " + b.name + "（" + live.actions.length + " 步）";
    dom.resume.onclick = function () {
      startBattle(a, b, live.seed, live.actions);
      dom.resume.hidden = true;
    };
  }

  /* ---------------- 开局 ---------------- */

  function readSeed() {
    var raw = String(dom.seed.value || "").trim();
    if (!raw) return Math.floor(Math.random() * 1000000000);
    var n = Number(raw);
    if (!isFinite(n)) return Math.floor(Math.random() * 1000000000);
    return Math.abs(Math.floor(n));
  }

  function startBattle(a, b, seed, restoreActions) {
    if (!a || !b) {
      setHint("先选两个角色");
      return;
    }
    var useSeed = seed == null ? readSeed() : seed;
    dom.seed.value = String(useSeed);
    meta = { a: a, b: b };
    history = [];
    actions = [];
    saved = false;
    saving = false;
    recordId = "";
    saveError = "";
    mode = "play";
    logUid = "";
    root.BattlePick.cancel(pick);

    var created = B.battle.create({ seed: useSeed, a: a, b: b });
    state = created.state;

    if (restoreActions && restoreActions.length) {
      try {
        for (var i = 0; i < restoreActions.length; i++) {
          var result = B.battle.apply(state, restoreActions[i]);
          state = result.state;
          actions.push(result.committed);
        }
        hint = "已恢复上一局，进度 " + actions.length + " 步";
      } catch (err) {
        hint = "上一局恢复失败（" + err.message + "），已重新开局";
        state = created.state;
        actions = [];
      }
    } else {
      hint = "开战：第 1 标准回合，" + state.units[0].name + " 先手（速度低者先行）";
    }

    dom.setup.hidden = true;
    dom.stage.hidden = false;
    dom.result.hidden = true;
    setImmersive(true);
    render();
  }

  /* ---------------- 渲染 ---------------- */

  function isCompact() {
    return !!(root.matchMedia && root.matchMedia("(orientation: landscape) and (max-height: 520px)").matches);
  }

  function setImmersive(on) {
    var el = root.document.documentElement;
    if (!el || !el.classList) return;
    if (on) el.classList.add("is-battle");
    else el.classList.remove("is-battle");
  }

  function restoreOpenSkills() {
    Object.keys(openSkills).forEach(function (id) {
      if (!openSkills[id]) return;
      var li = dom.grid.querySelector('.bq-skill[data-skill="' + id + '"]');
      if (!li) return;
      li.classList.add("is-open");
      var btn = li.querySelector(".bq-skill-toggle");
      if (btn) btn.textContent = "收起";
    });
  }

  /* 伤害记录浮层：从状态行下方展开，盖住下面的操作栏；高度按视口剩余量算 */
  function applyLogPanel() {
    if (!logUid) return;
    var card = dom.grid.querySelector('.battle-unit[data-unit="' + logUid + '"]');
    if (!card) return;
    var panel = card.querySelector(".bu-log");
    if (!panel) return;
    var limit = dom.bar ? dom.bar.getBoundingClientRect().top : root.innerHeight;
    if (!limit) limit = root.innerHeight;
    var bottom = card.getBoundingClientRect().bottom;
    var avail = Math.max(96, limit - bottom - 8);
    panel.style.maxHeight = avail + "px";
    /* 至少盖住整张技能卡（含操作栏），避免半行文字露在浮层下面 */
    var query = dom.grid.querySelector('[data-query="' + logUid + '"]');
    var need = query ? query.getBoundingClientRect().bottom - bottom + 2 : 96;
    panel.style.minHeight = Math.min(avail, Math.max(96, need)) + "px";
  }

  function render() {
    if (!state) return;
    var compact = isCompact();
    dom.grid.innerHTML = root.BattleView.render(state, meta, pick, hint, {
      readOnly: mode !== "play",
      speedOpen: speedOpen === null ? !compact : speedOpen,
      battleLogOpen: battleLogOpen === null ? !compact : battleLogOpen,
      battleLogCollapsible: compact,
      logUid: logUid
    });
    dom.grid.classList.toggle("is-picking", root.BattlePick.isActive(pick));
    dom.grid.classList.toggle("is-replay", mode !== "play");
    restoreOpenSkills();
    applyLogPanel();
    var logBox = dom.grid.querySelector("[data-log]");
    if (logBox) logBox.scrollTop = logBox.scrollHeight;
    if (dom.turnEl) dom.turnEl.textContent = turnText();
    if (dom.hintEl) dom.hintEl.textContent = hint;
    if (dom.replayBox) {
      dom.replayBox.hidden = mode !== "replay";
      if (dom.takeover) {
        dom.takeover.disabled = mode !== "replay" || replayIndex >= replayStates.length - 1;
      }
      if (mode === "replay") {
        dom.stepInfo.textContent = "第 " + replayIndex + " / " + (replayStates.length - 1) + " 步" +
          (replayIndex === replayStates.length - 1
            ? (oldEngine ? " · 旧引擎战报" : (hashMatched ? " · 校验通过" : " · 与当前角色数据不一致"))
            : "");
      }
    }
    if (dom.undo) dom.undo.hidden = mode !== "play";
    if (dom.restart) dom.restart.textContent = mode === "replay" ? "退出回放" : "换人";
    document.title = state.phase === "finished" && mode === "play" ? "对局结束 · " + BASE_TITLE : BASE_TITLE;
    if (mode === "play" && state.phase === "finished") {
      maybeSave();
      showResult();
    }
  }

  var hashMatched = true;

  function turnText() {
    if (!state) return "";
    if (mode === "replay") {
      return "回放 · 第 " + state.round + " 标准回合";
    }
    if (state.phase === "finished") return "对局结束 · 共 " + state.round + " 标准回合";
    if (!state.turnUid) return "第 " + state.round + " 标准回合";
    var unit = B.state.unitOf(state, state.turnUid);
    return "第 " + state.round + " 标准回合 · " + unit.name + " 行动（剩 " + unit.actionsLeft + " 行动）";
  }

  function setHint(text) {
    hint = text;
    if (dom.hintEl) dom.hintEl.textContent = text;
  }

  /* ---------------- 存档 ---------------- */

  function maybeSave() {
    if (saved || saving || saveTried || !root.BattleRecord) return;
    if (mode !== "play" || state.phase !== "finished") return;
    saving = true;
    saveTried = true;
    saveError = "";
    var record = root.BattleRecord.build(state, meta, actions);
    var finish = function (id) {
      recordId = id;
      saved = true;
      saving = false;
      clearLive();
      showResult();
    };
    if (!window.RpgData || typeof window.RpgData.createBattle !== "function") {
      saving = false;
      saveError = "数据层不可用，战报没有保存";
      showResult();
      return;
    }
    window.RpgData.createBattle(record).then(function (result) {
      finish(result.id);
    }).catch(function (err) {
      saving = false;
      saveError = err.message || "保存失败";
      showResult();
    });
  }

  function showResult() {
    if (mode !== "play") return;
    var winnerUid = state.result;
    var winner = winnerUid === "a" ? meta.a : meta.b;
    var saveLine = "";
    if (saving) saveLine = '<p class="br-line">正在保存战报…</p>';
    else if (saved) {
      saveLine = '<p class="br-line">战报已保存：<code>' + esc(recordId) + "</code> · " +
        '<a href="test.html?record=' + encodeURIComponent(recordId) + '">打开回放</a> · ' +
        '<a href="battles.html">战报列表</a></p>';
    } else if (saveError) {
      saveLine = '<p class="br-line">战报没有保存：' + esc(saveError) + "</p>" +
        '<button type="button" class="btn btn-ghost" data-retry-save>重试保存</button>';
    }

    dom.result.hidden = false;
    dom.result.innerHTML =
      "<h2>对局结束</h2>" +
      '<p class="br-line">胜者：<b>' + esc(winner ? winner.name : "平局") + "</b>" +
      " · 共 " + state.round + " 个标准回合 · 种子 " + state.seed + "</p>" +
      saveLine +
      '<div class="br-actions">' +
      '<button type="button" class="btn" data-again>再来一局</button>' +
      '<button type="button" class="btn btn-ghost" data-back>换人</button>' +
      "</div>";
  }

  /* ---------------- 交互 ---------------- */

  function applyAction(action) {
    var before = B.state.clone(state);
    var result;
    try {
      result = B.battle.apply(state, action);
    } catch (err) {
      setHint(err.message);
      root.BattlePick.cancel(pick);
      render();
      return false;
    }
    history.push(before);
    if (history.length > 60) history.shift();
    state = result.state;
    actions.push(result.committed);
    hint = describe(result.events);
    root.BattlePick.cancel(pick);
    writeLive();
    render();
    return true;
  }

  var BUFF_NAME = { strong: "坚强", fragile: "脆弱", brave: "勇猛", panic: "恐慌" };

  function describe(events) {
    var parts = [];
    for (var i = 0; i < events.length && parts.length < 4; i++) {
      var e = events[i];
      if (e.type === "dice") parts.push((e.label ? e.label + " 掷出 " : "掷出 ") + e.value);
      else if (e.type === "actionCanceled") parts.push(B.state.unitOf(state, e.uid).name + " 行动被跳过");
      else if (e.type === "damage") parts.push("造成 " + e.amount + " 点" + typeName(e.damageType));
      else if (e.type === "directLoss") parts.push("强扣 " + e.amount);
      else if (e.type === "heal") parts.push("回复 " + e.amount);
      else if (e.type === "buffAdd") parts.push("附加 " + (BUFF_NAME[e.kind] || e.kind) + " " + e.percent + "%");
      else if (e.type === "buffImmune") parts.push("免疫 " + (BUFF_NAME[e.kind] || e.kind));
      else if (e.type === "statusAdd") parts.push("附加 " + (e.label || e.kind) + " " + e.remain + " 回合");
      else if (e.type === "charg") parts.push("蓄力 " + e.amount + "/" + (e.need || "?"));
      else if (e.type === "mark") parts.push(e.name + " " + e.value + (e.hideMax ? "" : "/" + e.max));
      else if (e.type === "misfire") parts.push(e.label || "哑火");
      else if (e.type === "dodge") parts.push(B.state.unitOf(state, e.uid).name + " 闪避");
      else if (e.type === "summon") parts.push("召唤「" + e.name + "」");
      else if (e.type === "summonExpire") parts.push("「" + e.name + "」消失");
      else if (e.type === "summonDeath") parts.push("「" + e.name + "」被击毁");
      else if (e.type === "summonBlocked") parts.push("召唤上限，未能召唤");
      else if (e.type === "reflect") parts.push("反弹 " + e.amount);
      else if (e.type === "interrupt" && e.removed.length) parts.push("打断 " + e.removed.length + " 个持续效果");
      else if (e.type === "dispel" && e.removed.length) parts.push("清除 " + e.removed.length + " 个负面效果");
      else if (e.type === "turnSkip") parts.push(B.state.unitOf(state, e.uid).name + " 无法行动");
      else if (e.type === "death") parts.push(B.state.unitOf(state, e.uid).name + " 倒下");
    }
    return parts.join(" · ") || "已行动";
  }

  function typeName(type) {
    return type === "magic" ? "法伤" : type === "true" ? "真伤" : "普伤";
  }

  function currentUnit() {
    if (!state || mode !== "play" || state.phase === "finished" || !state.turnUid) return null;
    return B.state.unitOf(state, state.turnUid);
  }

  function enemySideOf(unit) {
    return B.state.otherSide(state, B.state.sideOf(state, unit.uid));
  }

  function enemyHeroUid(unit) {
    var hero = B.state.heroOf(state, enemySideOf(unit));
    return hero ? hero.uid : "";
  }

  function allowedEnemyUids(unit) {
    var list = B.state.combatantsOf(state, enemySideOf(unit));
    if (B.traits && B.traits.ignoreTaunt && B.traits.ignoreTaunt(unit)) {
      return list.map(function (u) { return u.uid; });
    }
    var max = -Infinity;
    list.forEach(function (u) { max = Math.max(max, Number(u.taunt) || 0); });
    return list.filter(function (u) { return (Number(u.taunt) || 0) === max; })
      .map(function (u) { return u.uid; });
  }

  function onBasic(kind) {
    var unit = currentUnit();
    if (!unit) return;
    if (kind === "chargeMp") {
      applyAction({ kind: "basic", type: "chargeMp" });
      return;
    }
    var healUid = B.skills.basicHealTarget ? B.skills.basicHealTarget(state, unit) : null;
    if (healUid) {
      applyAction({ kind: "basic", type: "attack", target: healUid });
      setHint("给「" + B.state.unitOf(state, healUid).name + "」回血");
      return;
    }
    if (kind === "break") {
      var breakTargets = allowedEnemyUids(unit).filter(function (uid) {
        var target = B.state.unitOf(state, uid);
        return !target.breakImmune && target.breakValue >= B.rules.CONFIG.breakThreshold;
      });
      if (!breakTargets.length) {
        setHint("目标击溃值不足 " + B.rules.CONFIG.breakThreshold + " 或免疫击溃");
        return;
      }
      root.BattlePick.begin(pick, { mode: "basic", type: "break", targets: breakTargets });
      setHint("选择要击溃的角色");
      render();
      return;
    }
    var targets = allowedEnemyUids(unit);
    if (unit.trait && unit.trait.canHitAlly) targets = [unit.uid].concat(targets);
    if (!targets.length) {
      setHint("没有合法目标");
      return;
    }
    root.BattlePick.begin(pick, { mode: "basic", type: "attack", targets: targets });
    setHint("选择普攻目标");
    render();
  }

  function onSkill(skillId) {
    var unit = currentUnit();
    if (!unit) return;
    var skill = B.skills.find(skillId);
    if (!skill) return;
    if (skill.owner !== unit.name) {
      setHint("现在不是「" + skill.owner + "」的回合");
      return;
    }
    var check = B.conditions.evaluate(state, unit, skill);
    if (!check.ok) {
      setHint(check.reason);
      return;
    }
    if (check.needsCharge) {
      var amount = (unit.charge && unit.charge.skillId === skill.id ? unit.charge.amount : 0) + 1;
      if (applyAction({ kind: "skill", skillId: skill.id, target: defaultTarget(unit, skill) })) {
        setHint("为「" + skill.name + "」蓄力 " + amount + "/" + (check.effective ? check.effective.charge : skill.charge));
      }
      return;
    }
    var targets = targetsOf(unit, skill);
    if (!targets.length) {
      setHint("这个技能没有合法目标");
      return;
    }
    if (targets.length === 1 && skill.input) {
      root.BattlePick.begin(pick, { mode: "input", id: skill.id, targets: [targets[0]] });
      setHint("输入「" + skill.name + "」要支付的蓝");
      render();
      return;
    }
    if (targets.length === 1 && skill.choices && skill.choices.length) {
      root.BattlePick.begin(pick, { mode: "choice", id: skill.id, targets: [targets[0]] });
      setHint("选择「" + skill.name + "」这次造成的伤害类型");
      render();
      return;
    }
    if (targets.length === 1) {
      applyAction({ kind: "skill", skillId: skill.id, target: targets[0] });
      return;
    }
    root.BattlePick.begin(pick, { mode: "skill", id: skill.id, targets: targets });
    setHint("选择「" + skill.name + "」的目标");
    render();
  }

  function defaultTarget(unit, skill) {
    if (skill.target === "self" || skill.target === "ally" || skill.target === "allAllies") return unit.uid;
    if (skill.target === "allEnemies") return enemyHeroUid(unit);
    var allowed = allowedEnemyUids(unit);
    return allowed[0] || enemyHeroUid(unit);
  }

  function targetsOf(unit, skill) {
    if (skill.target === "self" || skill.target === "ally" || skill.target === "allAllies") return [unit.uid];
    if (skill.target === "allEnemies") return [enemyHeroUid(unit)];
    if (skill.target === "any") return [unit.uid].concat(allowedEnemyUids(unit));
    return allowedEnemyUids(unit);
  }

  function onUnitClick(uid) {
    if (!root.BattlePick.isActive(pick)) return;
    if (!root.BattlePick.allows(pick, uid)) {
      setHint("这个目标不合法，请选择高亮的目标");
      return;
    }
    if (pick.mode === "basic") {
      applyAction({ kind: "basic", type: pick.type, target: uid });
      return;
    }
    if (pick.mode === "skill") {
      applyAction({ kind: "skill", skillId: pick.id, target: uid });
      return;
    }
    setHint("请在技能行里完成选择");
  }

  function onSummonClick(uid) {
    if (!state) return;
    var summon = null;
    try { summon = B.state.unitOf(state, uid); } catch (err) { return; }
    if (!root.BattlePick.isActive(pick)) {
      var detail = summon.name + (summon.targetable ? "：" + summon.hp + "/" + summon.base.maxHp : "");
      if (summon.ttl) detail += "，剩余 " + summon.ttl.remain + " 回合";
      setHint(detail);
      return;
    }
    if (!summon.targetable) {
      setHint("「" + summon.name + "」不可选中");
      return;
    }
    if (!root.BattlePick.allows(pick, uid)) {
      var unit = currentUnit();
      var enemy = unit && B.state.sideOf(state, uid) !== B.state.sideOf(state, unit.uid);
      setHint(enemy ? "被嘲讽保护，必须选择嘲讽最高的目标" : "这个目标不合法");
      return;
    }
    if (pick.mode === "basic") {
      applyAction({ kind: "basic", type: pick.type, target: uid });
      return;
    }
    if (pick.mode === "skill") {
      applyAction({ kind: "skill", skillId: pick.id, target: uid });
      return;
    }
    setHint("请在技能行里完成选择");
  }

  function onBuffEnter(key) {
    if (!state) return;
    var box = $("[data-buffbox]", dom.grid);
    if (!box) return;
    box.innerHTML = root.BattleView.renderBuffBox(root.BattleView.chipDetail(state, key));
  }

  function onBuffLeave() {
    var box = $("[data-buffbox]", dom.grid);
    if (box) box.innerHTML = root.BattleView.renderBuffBox(null);
  }

  /* 手机没有 hover，点一下 chip 在它旁边弹气泡 */
  var popShownAt = 0;

  function showBuffPop(chip) {
    if (!state || !dom.buffPop) return;
    var detail = root.BattleView.chipDetail(state, chip.getAttribute("data-detail"));
    if (!detail) return;
    dom.buffPop.innerHTML = root.BattleView.renderBuffBox(detail);
    dom.buffPop.hidden = false;
    popShownAt = Date.now();
    var rect = chip.getBoundingClientRect();
    var w = dom.buffPop.offsetWidth;
    var h = dom.buffPop.offsetHeight;
    var left = Math.min(Math.max(8, rect.left + rect.width / 2 - w / 2), root.innerWidth - w - 8);
    var top = rect.bottom + 6;
    if (top + h > root.innerHeight - 8) top = Math.max(8, rect.top - h - 6);
    dom.buffPop.style.left = left + "px";
    dom.buffPop.style.top = top + "px";
  }

  function hideBuffPop() {
    if (dom.buffPop) dom.buffPop.hidden = true;
  }

  function onScrollHidePop() {
    /* 点击时浏览器会先把目标滚进视野，那次滚动不该关掉刚弹出的气泡 */
    if (Date.now() - popShownAt < 300) return;
    hideBuffPop();
  }

  function undo() {
    if (mode !== "play") return;
    if (!history.length) {
      setHint("没有可撤销的步骤");
      return;
    }
    state = history.pop();
    actions.pop();
    root.BattlePick.cancel(pick);
    hint = "已撤销一步";
    dom.result.hidden = true;
    writeLive();
    render();
  }

  function backToSetup() {
    if (mode === "replay") {
      root.location.href = "battles.html";
      return;
    }
    state = null;
    history = [];
    actions = [];
    dom.stage.hidden = true;
    dom.result.hidden = true;
    dom.setup.hidden = false;
    hideBuffPop();
    logUid = "";
    setImmersive(false);
    document.title = BASE_TITLE;
    offerResume();
  }

  /* ---------------- 回放 ---------------- */

  function charOf(id) {
    for (var i = 0; i < roster.length; i++) {
      if (roster[i].id === id) return Promise.resolve(roster[i]);
    }
    if (window.RpgData && typeof window.RpgData.getCharacter === "function") {
      return window.RpgData.getCharacter(id).then(function (char) {
        if (char) {
          roster.push(char);
          byName[char.name] = char;
        }
        return char;
      });
    }
    return Promise.resolve(null);
  }

  function loadRecord(id) {
    mode = "replay";
    dom.setup.hidden = true;
    dom.stage.hidden = false;
    dom.result.hidden = true;
    setImmersive(true);
    dom.grid.innerHTML = '<p class="setup-note">正在读取战报…</p>';

    if (!window.RpgData || typeof window.RpgData.getBattle !== "function") {
      dom.grid.innerHTML = '<p class="setup-note">数据层不可用，无法回放。</p>';
      return;
    }

    window.RpgData.getBattle(id).then(function (record) {
      if (!record) throw new Error("没有找到这份战报");
      replayRecord = record;
      return Promise.all([charOf(record.character_a), charOf(record.character_b)]).then(function (pair) {
        if (!pair[0] || !pair[1]) throw new Error("战报里的角色已经不在档案里");
        meta = { a: pair[0], b: pair[1] };
        B.skills.validate(roster);
        replayStates = root.BattleRecord.states(record, { a: pair[0], b: pair[1] });
        replayIndex = replayStates.length - 1;
        state = replayStates[replayIndex];
        var currentVersion = (root.RPG_APP && root.RPG_APP.engineVersion) || "";
        oldEngine = !!(record.engine_version && currentVersion && record.engine_version !== currentVersion);
        hashMatched = B.state.hash(state) === (record.final_hash || "");
        saved = true;
        hint = "回放：" + record.name_a + " vs " + record.name_b +
          " · 共 " + record.steps + " 步" +
          (oldEngine ? " · 由旧引擎（" + record.engine_version + "）生成，结果可能与现在不同" : "") +
          (oldEngine && replayStates.length - 1 < record.steps
            ? " · 新规则下只能回放到第 " + (replayStates.length - 1) + " 步"
            : "") +
          (!oldEngine && !hashMatched ? " · 与当前角色数据不一致" : "");
        render();
      });
    }).catch(function (err) {
      dom.grid.innerHTML = '<p class="setup-note">读不出这份战报：' + esc(err.message) + "</p>";
    });
  }

  function stepReplay(delta) {
    if (mode !== "replay" || !replayStates.length) return;
    var next = replayIndex + delta;
    if (next < 0) next = 0;
    if (next > replayStates.length - 1) next = replayStates.length - 1;
    replayIndex = next;
    state = replayStates[replayIndex];
    render();
  }

  /* ---------------- 横屏入口 ----------------
     能全屏并锁方向就锁；不能（iOS 网页）就留在遮罩上，等人手动横过来。
     遮罩的显示完全由 CSS 的竖屏媒体查询控制，转成横屏自动消失。 */

  function setGateNote(text) {
    if (dom.gateNote) dom.gateNote.textContent = text;
  }

  function requestFullscreen() {
    var el = root.document.documentElement;
    var fn = el.requestFullscreen || el.webkitRequestFullscreen || null;
    if (!fn) return Promise.resolve(false);
    try {
      return Promise.resolve(fn.call(el)).then(function () {
        return true;
      }).catch(function () {
        return false;
      });
    } catch (err) {
      return Promise.resolve(false);
    }
  }

  function lockLandscape() {
    var so = root.screen && root.screen.orientation;
    if (!so || typeof so.lock !== "function") return Promise.resolve(false);
    try {
      return Promise.resolve(so.lock("landscape")).then(function () {
        return true;
      }).catch(function () {
        return false;
      });
    } catch (err) {
      return Promise.resolve(false);
    }
  }

  function onGateGo() {
    if (dom.gateGo) dom.gateGo.disabled = true;
    setGateNote("正在尝试锁定横屏…");
    requestFullscreen().then(function () {
      return lockLandscape();
    }).then(function (locked) {
      if (dom.gateGo) dom.gateGo.disabled = false;
      setGateNote(locked
        ? "已锁定横屏。"
        : "这个浏览器不能自动转屏，请手动把手机横过来。");
    });
  }

  function bindGate() {
    if (dom.gateGo) dom.gateGo.addEventListener("click", onGateGo);
    syncPhone();
    if (root.addEventListener) {
      root.addEventListener("resize", syncPhone);
      root.addEventListener("orientationchange", syncPhone);
    }
  }

  /* 只认手机：粗指针 + 有触摸 + 短边不超过 520。桌面窄窗口、平板、鼠标设备都不弹遮罩 */
  function syncPhone() {
    var el = root.document.documentElement;
    if (!el || !el.classList) return;
    var coarse = root.matchMedia ? root.matchMedia("(pointer: coarse)").matches : false;
    var touch = !!(root.navigator && (root.navigator.maxTouchPoints || 0) > 0);
    var shortSide = Math.min(root.innerWidth, root.innerHeight);
    if (coarse && touch && shortSide <= 520) el.classList.add("is-phone");
    else el.classList.remove("is-phone");
  }

  /* ---------------- 事件 ---------------- */

  function bind() {
    dom.stage.addEventListener("click", function (event) {
      if (mode !== "play") return;
      var basic = event.target.closest("[data-basic]");
      if (basic) {
        event.preventDefault();
        onBasic(basic.getAttribute("data-basic"));
        return;
      }
      var toggle = event.target.closest(".bq-skill-toggle");
      if (toggle) {
        event.preventDefault();
        var row = toggle.closest(".bq-skill");
        if (row) {
          var opened = row.classList.toggle("is-open");
          toggle.textContent = opened ? "收起" : "效果";
          openSkills[row.getAttribute("data-skill") || ""] = opened;
        }
        return;
      }
      var chip = event.target.closest("[data-detail]");
      if (chip) {
        event.preventDefault();
        showBuffPop(chip);
        return;
      }
      var logBtn = event.target.closest(".bu-log-toggle");
      if (logBtn) {
        event.preventDefault();
        var card = logBtn.closest("[data-unit]");
        var uid = card ? card.getAttribute("data-unit") : "";
        logUid = logUid === uid ? "" : uid;
        render();
        return;
      }
      var skill = event.target.closest("[data-skill]");
      if (skill) {
        event.preventDefault();
        var panel = skill.closest(".battle-query");
        if (panel && !panel.classList.contains("is-active")) return;
        onSkill(skill.getAttribute("data-skill"));
        return;
      }
      var summonChip = event.target.closest("[data-summon]");
      if (summonChip) {
        event.preventDefault();
        onSummonClick(summonChip.getAttribute("data-summon"));
        return;
      }
      var choice = event.target.closest("[data-choice]");
      if (choice) {
        event.preventDefault();
        var choiceTarget = (pick.targets && pick.targets[0]) || "";
        applyAction({
          kind: "skill",
          skillId: pick.id,
          target: choiceTarget,
          choice: choice.getAttribute("data-choice")
        });
        return;
      }
      var inputGo = event.target.closest("[data-input-go]");
      if (inputGo) {
        event.preventDefault();
        var inputBox = inputGo.closest(".bq-input");
        var inputEl = inputBox ? inputBox.querySelector("[data-input-n]") : null;
        applyAction({
          kind: "skill",
          skillId: pick.id,
          target: (pick.targets && pick.targets[0]) || "",
          n: Math.floor(Number(inputEl ? inputEl.value : NaN))
        });
        return;
      }
      if (event.target.closest(".bq-input")) return;
      var unit = event.target.closest("[data-unit]");
      if (unit) {
        event.preventDefault();
        onUnitClick(unit.getAttribute("data-unit"));
        return;
      }
      if (root.BattlePick.isActive(pick)) {
        root.BattlePick.cancel(pick);
        setHint("已取消选择");
        render();
      }
    });

    dom.stage.addEventListener("toggle", function (event) {
      if (!event.target.closest) return;
      var speed = event.target.closest("[data-speed]");
      if (speed) speedOpen = speed.open;
      var battleLog = event.target.closest("[data-log]");
      if (battleLog) battleLogOpen = battleLog.open;
    }, true);

    dom.stage.addEventListener("mouseover", function (event) {
      var chip = event.target.closest("[data-detail]");
      if (chip) onBuffEnter(chip.getAttribute("data-detail"));
    });
    dom.stage.addEventListener("mouseout", function (event) {
      if (event.target.closest("[data-detail]")) onBuffLeave();
    });

    document.addEventListener("click", function (event) {
      if (!dom.buffPop || dom.buffPop.hidden) return;
      if (event.target.closest("[data-detail]") || event.target.closest("[data-buffpop]")) return;
      hideBuffPop();
    });
    root.addEventListener("scroll", onScrollHidePop, true);

    if (root.matchMedia) {
      var compactMq = root.matchMedia("(orientation: landscape) and (max-height: 520px)");
      var onViewport = function () { if (state) render(); };
      if (compactMq.addEventListener) compactMq.addEventListener("change", onViewport);
      else if (compactMq.addListener) compactMq.addListener(onViewport);
    }

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      if (battleLogOpen) {
        battleLogOpen = false;
        render();
        return;
      }
      if (root.BattlePick.isActive(pick)) {
        root.BattlePick.cancel(pick);
        setHint("已取消选择");
        render();
      }
    });

    dom.start.addEventListener("click", function () {
      startBattle(byName[dom.pickA.value], byName[dom.pickB.value], null, null);
    });
    dom.undo.addEventListener("click", undo);
    dom.restart.addEventListener("click", backToSetup);
    dom.replayBox.addEventListener("click", function (event) {
      if (event.target.closest("[data-step-prev]")) stepReplay(-1);
      if (event.target.closest("[data-step-next]")) stepReplay(1);
      if (event.target.closest("[data-step-start]")) {
        replayIndex = 0;
        state = replayStates[0];
        render();
      }
      if (event.target.closest("[data-step-end]")) {
        replayIndex = replayStates.length - 1;
        state = replayStates[replayIndex];
        render();
      }
      if (event.target.closest("[data-takeover]") && replayRecord) {
        if (replayIndex >= replayStates.length - 1) return;
        var prefix = replayRecord.actions.slice(0, replayIndex);
        startBattle(meta.a, meta.b, replayRecord.seed, prefix);
      }
    });

    dom.result.addEventListener("click", function (event) {
      if (event.target.closest("[data-again]")) startBattle(meta.a, meta.b, null, null);
      if (event.target.closest("[data-back]")) backToSetup();
      if (event.target.closest("[data-retry-save]")) {
        saved = false;
        saving = false;
        saveTried = false;
        showResult();
        maybeSave();
      }
    });
  }

  function init() {
    dom.setup = $("[data-setup]");
    dom.stage = $("[data-stage]");
    dom.grid = $("[data-grid]");
    dom.bar = $("[data-bar]");
    dom.result = $("[data-result]");
    dom.pickA = $("[data-pick-a]");
    dom.pickB = $("[data-pick-b]");
    dom.seed = $("[data-seed]");
    dom.start = $("[data-start]");
    dom.undo = $("[data-undo]");
    dom.restart = $("[data-restart]");
    dom.source = $("[data-source]");
    dom.coverage = $("[data-coverage]");
    dom.turnEl = $("[data-turn]");
    dom.hintEl = $("[data-hint]");
    dom.replayBox = $("[data-replay]");
    dom.stepInfo = $("[data-step-info]");
    dom.takeover = $("[data-takeover]");
    dom.resume = $("[data-resume]");
    dom.gate = $("[data-gate]");
    dom.gateGo = $("[data-gate-go]");
    dom.gateNote = $("[data-gate-note]");
    dom.buffPop = $("[data-buffpop]");

    bindGate();

    if (!B || !B.battle || !B.skills || !window.RPG6_SKILLS) {
      dom.source.textContent = "引擎或技能库没有加载成功，对局功能不可用。";
      if (dom.coverage) dom.coverage.textContent = "技能库没有加载成功，对局功能不可用。";
      dom.start.disabled = true;
      return;
    }

    B.skills.load(window.RPG6_SKILLS);
    bind();

    var params = new URLSearchParams(root.location.search);
    var recordIdParam = params.get("record");

    var load = loadCharacters();
    load.now.then(function (result) {
      applyRoster(result);

      /* 4 秒没等到数据库就先给兜底数据；真正的结果晚到时，只要还没开打就换过来 */
      load.remote.then(function (late) {
        if (state || recordIdParam) return;
        if (!late || !late.list || late.list === roster) return;
        applyRoster(late);
        offerResume();
      }).catch(function () {});

      if (recordIdParam) {
        loadRecord(recordIdParam);
        return;
      }
      if (!roster.length) {
        dom.source.textContent = "技能库里没有任何能上场的角色。";
        dom.start.disabled = true;
        return;
      }
      offerResume();
    }).catch(function (err) {
      dom.source.textContent = "读取角色失败：" + err.message;
      dom.start.disabled = true;
    });
  }

  root.BattlePage = { init: init, start: startBattle, undo: undo };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

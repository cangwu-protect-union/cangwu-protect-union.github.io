/* 回合制正传 6.0 · 战斗界面 · 界面细节与名单分片
   只往 RPG6BattlePage 挂函数，在 battle-page.js 之前加载。 */
(function (root) {
  "use strict";
  var P = root.RPG6BattlePage || (root.RPG6BattlePage = {});
  var B = root.RPG6B;


  P.isCompact = function () {
    return !!(root.matchMedia && root.matchMedia("(orientation: landscape) and (max-height: 520px)").matches);
  }

  P.setImmersive = function (on) {
    var el = root.document.documentElement;
    if (!el || !el.classList) return;
    if (on) el.classList.add("is-battle");
    else el.classList.remove("is-battle");
  }

  P.restoreOpenSkills = function () {
    Object.keys(P.openSkills).forEach(function (id) {
      if (!P.openSkills[id]) return;
      var li = P.dom.grid.querySelector('.bq-skill[data-skill="' + id + '"]');
      if (!li) return;
      li.classList.add("is-open");
      var btn = li.querySelector(".bq-skill-toggle");
      if (btn) btn.textContent = "收起";
    });
  }

  P.applyLogPanel = function () {
    if (!P.logUid) return;
    var card = P.dom.grid.querySelector('.battle-unit[data-unit="' + P.logUid + '"]');
    if (!card) return;
    var panel = card.querySelector(".bu-log");
    if (!panel) return;
    var limit = P.dom.bar ? P.dom.bar.getBoundingClientRect().top : root.innerHeight;
    if (!limit) limit = root.innerHeight;
    var bottom = card.getBoundingClientRect().bottom;
    var avail = Math.max(96, limit - bottom - 8);
    panel.style.maxHeight = avail + "px";
    /* 至少盖住整张技能卡（含操作栏），避免半行文字露在浮层下面 */
    var query = P.dom.grid.querySelector('[data-query="' + P.logUid + '"]');
    var need = query ? query.getBoundingClientRect().bottom - bottom + 2 : 96;
    panel.style.minHeight = Math.min(avail, Math.max(96, need)) + "px";
  }

  P.turnText = function () {
    if (!P.state) return "";
    if (P.mode === "replay") {
      return "回放 · 第 " + P.state.round + " 标准回合";
    }
    if (P.state.phase === "finished") return "对局结束 · 共 " + P.state.round + " 标准回合";
    if (!P.state.turnUid) return "第 " + P.state.round + " 标准回合";
    var unit = B.state.unitOf(P.state, P.state.turnUid);
    return "第 " + P.state.round + " 标准回合 · " + unit.name + " 行动（剩 " + unit.actionsLeft + " 行动）";
  }

  P.describe = function (events) {
    var parts = [];
    for (var i = 0; i < events.length && parts.length < 4; i++) {
      var e = events[i];
      if (e.type === "dice") parts.push((e.label ? e.label + " 掷出 " : "掷出 ") + e.value);
      else if (e.type === "actionCanceled") parts.push(B.state.unitOf(P.state, e.uid).name + " 行动被跳过");
      else if (e.type === "damage") parts.push("造成 " + e.amount + " 点" + P.typeName(e.damageType));
      else if (e.type === "directLoss") parts.push("强扣 " + e.amount);
      else if (e.type === "heal") parts.push("回复 " + e.amount);
      else if (e.type === "buffAdd") parts.push("附加 " + (BUFF_NAME[e.kind] || e.kind) + " " + e.percent + "%");
      else if (e.type === "buffImmune") parts.push("免疫 " + (BUFF_NAME[e.kind] || e.kind));
      else if (e.type === "statusAdd") parts.push("附加 " + (e.label || e.kind) + " " + e.remain + " 回合");
      else if (e.type === "charg") parts.push("蓄力 " + e.amount + "/" + (e.need || "?"));
      else if (e.type === "mark") parts.push(e.name + " " + e.value + (e.hideMax ? "" : "/" + e.max));
      else if (e.type === "misfire") parts.push(e.label || "哑火");
      else if (e.type === "dodge") parts.push(B.state.unitOf(P.state, e.uid).name + " 闪避");
      else if (e.type === "summon") parts.push("召唤「" + e.name + "」");
      else if (e.type === "summonExpire") parts.push("「" + e.name + "」消失");
      else if (e.type === "summonDeath") parts.push("「" + e.name + "」被击毁");
      else if (e.type === "summonBlocked") parts.push("召唤上限，未能召唤");
      else if (e.type === "reflect") parts.push("反弹 " + e.amount);
      else if (e.type === "interrupt" && e.removed.length) parts.push("打断 " + e.removed.length + " 个持续效果");
      else if (e.type === "dispel" && e.removed.length) parts.push("清除 " + e.removed.length + " 个负面效果");
      else if (e.type === "turnSkip") parts.push(B.state.unitOf(P.state, e.uid).name + " 无法行动");
      else if (e.type === "death") parts.push(B.state.unitOf(P.state, e.uid).name + " 倒下");
    }
    return parts.join(" · ") || "已行动";
  }

  P.typeName = function (type) {
    return type === "magic" ? "法伤" : type === "true" ? "真伤" : "普伤";
  }

  P.onBuffEnter = function (key) {
    if (!P.state) return;
    var box = P.$("[data-buffbox]", P.dom.grid);
    if (!box) return;
    box.innerHTML = root.BattleView.renderBuffBox(root.BattleView.chipDetail(P.state, key));
  }

  P.onBuffLeave = function () {
    var box = P.$("[data-buffbox]", P.dom.grid);
    if (box) box.innerHTML = root.BattleView.renderBuffBox(null);
  }

  P.showBuffPop = function (chip) {
    if (!P.state || !P.dom.buffPop) return;
    var detail = root.BattleView.chipDetail(P.state, chip.getAttribute("data-detail"));
    if (!detail) return;
    P.dom.buffPop.innerHTML = root.BattleView.renderBuffBox(detail);
    P.dom.buffPop.hidden = false;
    P.popShownAt = Date.now();
    var rect = chip.getBoundingClientRect();
    var w = P.dom.buffPop.offsetWidth;
    var h = P.dom.buffPop.offsetHeight;
    var left = Math.min(Math.max(8, rect.left + rect.width / 2 - w / 2), root.innerWidth - w - 8);
    var top = rect.bottom + 6;
    if (top + h > root.innerHeight - 8) top = Math.max(8, rect.top - h - 6);
    P.dom.buffPop.style.left = left + "px";
    P.dom.buffPop.style.top = top + "px";
  }

  P.hideBuffPop = function () {
    if (P.dom.buffPop) P.dom.buffPop.hidden = true;
  }

  P.onScrollHidePop = function () {
    /* 点击时浏览器会先把目标滚进视野，那次滚动不该关掉刚弹出的气泡 */
    if (Date.now() - P.popShownAt < 300) return;
    P.hideBuffPop();
  }

  P.requestFullscreen = function () {
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

  P.lockLandscape = function () {
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

  P.setGateNote = function (text) {
    if (P.dom.gateNote) P.dom.gateNote.textContent = text;
  }

  P.onGateGo = function () {
    if (P.dom.gateGo) P.dom.gateGo.disabled = true;
    P.setGateNote("正在尝试锁定横屏…");
    P.requestFullscreen().then(function () {
      return P.lockLandscape();
    }).then(function (locked) {
      if (P.dom.gateGo) P.dom.gateGo.disabled = false;
      P.setGateNote(locked
        ? "已锁定横屏。"
        : "这个浏览器不能自动转屏，请手动把手机横过来。");
    });
  }

  P.bindGate = function () {
    if (P.dom.gateGo) P.dom.gateGo.addEventListener("click", P.onGateGo);
    P.syncPhone();
    if (root.addEventListener) {
      root.addEventListener("resize", P.syncPhone);
      root.addEventListener("orientationchange", P.syncPhone);
    }
  }

  P.syncPhone = function () {
    var el = root.document.documentElement;
    if (!el || !el.classList) return;
    var coarse = root.matchMedia ? root.matchMedia("(pointer: coarse)").matches : false;
    var touch = !!(root.navigator && (root.navigator.maxTouchPoints || 0) > 0);
    var shortSide = Math.min(root.innerWidth, root.innerHeight);
    if (coarse && touch && shortSide <= 520) el.classList.add("is-phone");
    else el.classList.remove("is-phone");
  }

  P.$ = function (sel, ctx) {
    return (ctx || document).querySelector(sel);
  }

  P.esc = function (text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  P.coveredNames = function () {
    var out = {};
    var lib = window.RPG6_SKILLS && window.RPG6_SKILLS.characters ? window.RPG6_SKILLS.characters : {};
    Object.keys(lib).forEach(function (name) {
      if (lib[name] && lib[name].length) out[name] = true;
    });
    return out;
  }

  P.dedupe = function (list, names) {
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

  P.loadCharacters = function () {
    var names = P.coveredNames();
    var allSeeds = (window.RPG_SEED_CHARACTERS || []).filter(function (char) {
      return char && !char.deleted;
    });
    var seeds = P.dedupe(allSeeds, names);

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
      var picked = P.dedupe(all, names);
      if (!picked.length) return fallback("数据库为空");
      return { list: picked, source: "数据库", total: all.length };
    }).catch(function () {
      return fallback("数据库不可用");
    });

    return { now: Promise.race([remote, timeout]), remote: remote };
  }

  P.fillSelects = function (source, total) {
    var options = P.roster.map(function (char) {
      return '<option value="' + P.esc(char.name) + '">' + P.esc(char.name) +
        "（" + P.esc(char.occupation || "无主业") + (char.side_job ? "/" + P.esc(char.side_job) : "") + "）</option>";
    }).join("");

    P.dom.pickA.innerHTML = options;
    P.dom.pickB.innerHTML = options;
    if (P.roster.length > 1) P.dom.pickB.selectedIndex = 1;
    P.dom.source.textContent = "角色数据：" + source + " · 可上场 " + P.roster.length +
      (total ? " / 共 " + total + " 名" : "");
    if (P.dom.coverage) P.dom.coverage.textContent = P.coverageText();
  }

  P.coverageText = function () {
    var lib = window.RPG6_SKILLS && window.RPG6_SKILLS.characters ? window.RPG6_SKILLS.characters : null;
    var chars = lib ? Object.keys(lib).length : 0;
    var skills = B.skills && B.skills.all ? B.skills.all().length : 0;
    if (!chars || !skills) return "技能库没有加载成功，对局功能不可用。";
    return "技能库覆盖 " + chars + " 名角色、" + skills + " 条技能，其余角色不会出现在列表里。" +
      "同一种子加同一串操作必然复现同一局。对局结束后战报自动入库，刷新中途可以从「继续上一局」接着打。";
  }

  P.applyRoster = function (result) {
    P.roster = result.list;
    P.byName = {};
    P.roster.forEach(function (char) {
      P.byName[char.name] = char;
    });
    B.skills.validate(P.roster);
    P.fillSelects(result.source, result.total);
  }

  P.readSeed = function () {
    var raw = String(P.dom.seed.value || "").trim();
    if (!raw) return Math.floor(Math.random() * 1000000000);
    var n = Number(raw);
    if (!isFinite(n)) return Math.floor(Math.random() * 1000000000);
    return Math.abs(Math.floor(n));
  }

  P.onSummonClick = function (uid) {
    if (!P.state) return;
    var summon = null;
    try { summon = B.state.unitOf(P.state, uid); } catch (err) { return; }
    if (!root.BattlePick.isActive(P.pick)) {
      var detail = summon.name + (summon.targetable ? "：" + summon.hp + "/" + summon.base.maxHp : "");
      if (summon.ttl) detail += "，剩余 " + summon.ttl.remain + " 回合";
      P.setHint(detail);
      return;
    }
    if (!summon.targetable) {
      P.setHint("「" + summon.name + "」不可选中");
      return;
    }
    if (!root.BattlePick.allows(P.pick, uid)) {
      var unit = P.currentUnit();
      var enemy = unit && B.state.sideOf(P.state, uid) !== B.state.sideOf(P.state, unit.uid);
      P.setHint(enemy ? "被嘲讽保护，必须选择嘲讽最高的目标" : "这个目标不合法");
      return;
    }
    if (P.pick.mode === "basic") {
      P.applyAction({ kind: "basic", type: P.pick.type, target: uid });
      return;
    }
    if (P.pick.mode === "skill") {
      P.applyAction({ kind: "skill", skillId: P.pick.id, target: uid });
      return;
    }
    P.setHint("请在技能行里完成选择");
  }

  P.defaultTarget = function (unit, skill) {
    if (skill.target === "self" || skill.target === "ally" || skill.target === "allAllies") return unit.uid;
    if (skill.target === "allEnemies") return P.enemyHeroUid(unit);
    var allowed = P.allowedEnemyUids(unit);
    return allowed[0] || P.enemyHeroUid(unit);
  }

  P.targetsOf = function (unit, skill) {
    if (skill.target === "self" || skill.target === "ally" || skill.target === "allAllies") return [unit.uid];
    if (skill.target === "allEnemies") return [P.enemyHeroUid(unit)];
    if (skill.target === "any") return [unit.uid].concat(P.allowedEnemyUids(unit));
    return P.allowedEnemyUids(unit);
  }

  P.onUnitClick = function (uid) {
    if (!root.BattlePick.isActive(P.pick)) return;
    if (!root.BattlePick.allows(P.pick, uid)) {
      P.setHint("这个目标不合法，请选择高亮的目标");
      return;
    }
    if (P.pick.mode === "basic") {
      P.applyAction({ kind: "basic", type: P.pick.type, target: uid });
      return;
    }
    if (P.pick.mode === "skill") {
      P.applyAction({ kind: "skill", skillId: P.pick.id, target: uid });
      return;
    }
    P.setHint("请在技能行里完成选择");
  }

  P.charOf = function (id) {
    for (var i = 0; i < P.roster.length; i++) {
      if (P.roster[i].id === id) return Promise.resolve(P.roster[i]);
    }
    if (window.RpgData && typeof window.RpgData.getCharacter === "function") {
      return window.RpgData.getCharacter(id).then(function (char) {
        if (char) {
          P.roster.push(char);
          P.byName[char.name] = char;
        }
        return char;
      });
    }
    return Promise.resolve(null);
  }

  P.backToSetup = function () {
    if (P.mode === "replay") {
      root.location.href = "battles.html";
      return;
    }
    P.state = null;
    P.history = [];
    P.actions = [];
    P.dom.stage.hidden = true;
    P.dom.result.hidden = true;
    P.dom.setup.hidden = false;
    P.hideBuffPop();
    P.logUid = "";
    P.setImmersive(false);
    document.title = P.BASE_TITLE;
    P.offerResume();
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

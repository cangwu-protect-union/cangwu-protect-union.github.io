/* 回合制正传 6.0 · 战斗界面 · 存档/恢复/战报/回放分片
   只往 RPG6BattlePage 挂函数，在 battle-page.js 之前加载。 */
(function (root) {
  "use strict";
  var P = root.RPG6BattlePage || (root.RPG6BattlePage = {});
  var B = root.RPG6B;


  P.readLive = function () {
    try {
      return JSON.parse(root.localStorage.getItem(P.LIVE_KEY) || "null");
    } catch (err) {
      return null;
    }
  }

  P.writeLive = function () {
    if (!P.state || P.mode !== "play") return;
    try {
      root.localStorage.setItem(P.LIVE_KEY, JSON.stringify({
        seed: P.state.seed,
        a: P.meta.a.id,
        b: P.meta.b.id,
        actions: P.actions
      }));
    } catch (err) {
      /* 存不下就算了，不影响对局 */
    }
  }

  P.clearLive = function () {
    try {
      root.localStorage.removeItem(P.LIVE_KEY);
    } catch (err) {
      /* ignore */
    }
  }

  P.offerResume = function () {
    var live = P.readLive();
    if (!live || !P.dom.resume) return;
    var a = null;
    var b = null;
    for (var i = 0; i < P.roster.length; i++) {
      if (P.roster[i].id === live.a) a = P.roster[i];
      if (P.roster[i].id === live.b) b = P.roster[i];
    }
    if (!a || !b || !live.actions || !live.actions.length) return;
    P.dom.resume.hidden = false;
    P.dom.resume.textContent = "继续上一局：" + a.name + " vs " + b.name + "（" + live.actions.length + " 步）";
    P.dom.resume.onclick = function () {
      P.startBattle(a, b, live.seed, live.actions);
      P.dom.resume.hidden = true;
    };
  }

  P.maybeSave = function () {
    if (P.remote && P.remote.saveBattle) return P.remote.saveBattle();
    if (P.saved || P.saving || P.saveTried || !root.BattleRecord) return;
    if (P.mode !== "play" || P.state.phase !== "finished") return;
    P.saving = true;
    P.saveTried = true;
    P.saveError = "";
    var record = root.BattleRecord.build(P.state, P.meta, P.actions);
    var finish = function (id) {
      P.recordId = id;
      P.saved = true;
      P.saving = false;
      P.clearLive();
      P.showResult();
    };
    if (!window.RpgData || typeof window.RpgData.createBattle !== "function") {
      P.saving = false;
      P.saveError = "数据层不可用，战报没有保存";
      P.showResult();
      return;
    }
    window.RpgData.createBattle(record).then(function (result) {
      finish(result.id);
    }).catch(function (err) {
      P.saving = false;
      P.saveError = err.message || "保存失败";
      P.showResult();
    });
  }

  P.showResult = function () {
    if (P.remote && P.remote.showResult) { P.remote.showResult(); return; }
    if (P.mode !== "play" || !P.state) return;
    var winnerUid = P.state.result;
    var winner = winnerUid === "a" ? P.meta.a : P.meta.b;
    var saveLine = "";
    if (P.saving) saveLine = '<p class="br-line">正在保存战报…</p>';
    else if (P.saved) {
      saveLine = '<p class="br-line">战报已保存：<code>' + P.esc(P.recordId) + "</code> · " +
        '<a href="test.html?record=' + encodeURIComponent(P.recordId) + '">打开回放</a> · ' +
        '<a href="battles.html">战报列表</a></p>';
    } else if (P.saveError) {
      saveLine = '<p class="br-line">战报没有保存：' + P.esc(P.saveError) + "</p>" +
        '<button type="button" class="btn btn-ghost" data-retry-save>重试保存</button>';
    }

    P.dom.result.hidden = false;
    P.dom.result.innerHTML =
      "<h2>对局结束</h2>" +
      '<p class="br-line">胜者：<b>' + P.esc(winner ? winner.name : "平局") + "</b>" +
      " · 共 " + P.state.round + " 个标准回合 · 种子 " + P.state.seed + "</p>" +
      saveLine +
      '<div class="br-actions">' +
      '<button type="button" class="btn" data-again>再来一局</button>' +
      '<button type="button" class="btn btn-ghost" data-back>换人</button>' +
      "</div>";
  }

  P.loadRecord = function (id) {
    P.mode = "replay";
    P.dom.setup.hidden = true;
    P.dom.stage.hidden = false;
    P.dom.result.hidden = true;
    P.setImmersive(true);
    P.dom.grid.innerHTML = '<p class="setup-note">正在读取战报…</p>';

    if (!window.RpgData || typeof window.RpgData.getBattle !== "function") {
      P.setImmersive(false);
      P.dom.grid.innerHTML = '<p class="setup-note">数据层不可用，无法回放。</p>';
      return;
    }

    window.RpgData.getBattle(id).then(function (record) {
      if (!record) throw new Error("没有找到这份战报");
      P.replayRecord = record;
      return Promise.all([P.charOf(record.character_a), P.charOf(record.character_b)]).then(function (pair) {
        if (!pair[0] || !pair[1]) throw new Error("战报里的角色已经不在档案里");
        P.meta = { a: pair[0], b: pair[1] };
        B.skills.validate(P.roster);
        P.replayStates = root.BattleRecord.states(record, { a: pair[0], b: pair[1] });
        P.replayIndex = P.replayStates.length - 1;
        P.state = P.replayStates[P.replayIndex];
        var currentVersion = (root.RPG_APP && root.RPG_APP.engineVersion) || "";
        P.oldEngine = !!(record.engine_version && currentVersion && record.engine_version !== currentVersion);
        P.hashMatched = B.state.hash(P.state) === (record.final_hash || "");
        P.saved = true;
        P.hint = "回放：" + record.name_a + " vs " + record.name_b +
          " · 共 " + record.steps + " 步" +
          (P.oldEngine ? " · 由旧引擎（" + record.engine_version + "）生成，结果可能与现在不同" : "") +
          (P.oldEngine && P.replayStates.length - 1 < record.steps
            ? " · 新规则下只能回放到第 " + (P.replayStates.length - 1) + " 步"
            : "") +
          (!P.oldEngine && !P.hashMatched ? " · 与当前角色数据不一致" : "");
        P.render();
      });
    }).catch(function (err) {
      P.setImmersive(false);
      P.dom.grid.innerHTML = '<p class="setup-note">读不出这份战报：' + P.esc(err.message) + "</p>";
    });
  }

  P.stepReplay = function (delta) {
    if (P.mode !== "replay" || !P.replayStates.length) return;
    var next = P.replayIndex + delta;
    if (next < 0) next = 0;
    if (next > P.replayStates.length - 1) next = P.replayStates.length - 1;
    P.replayIndex = next;
    P.state = P.replayStates[P.replayIndex];
    P.render();
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

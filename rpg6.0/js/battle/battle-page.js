/* 回合制正传 6.0 · 战斗界面 · 页面装配
   三种模式：play（对局）、replay（回放战报）、以及开局前的选人。
   所有规则都在引擎里，这里只调度、存档与提示。
   拆成 4 个文件按顺序加载：battle-page-record.js → battle-page-ui.js → battle-page-bind.js → battle-page.js，
   函数都挂在 RPG6BattlePage 上；事件绑定在 bind 分片里，这里只做装配与调度。 */
(function (root) {
  "use strict";

  var B = root.RPG6B;
  var P = root.RPG6BattlePage = root.RPG6BattlePage || {};
  P.BASE_TITLE = "回合制正传 6.0 · 对局测试";
  P.LIVE_KEY = "rpg6-live-battle";

  P.dom = {};
  P.roster = [];
  P.byName = {};
  P.state = null;
  P.meta = { a: null, b: null };
  P.history = [];
  P.actions = [];
  P.pick = root.BattlePick.create();
  P.hint = "";
  P.mode = "play";
  P.replayStates = [];
  P.replayIndex = 0;
  P.replayRecord = null;
  P.oldEngine = false;
  P.saved = false;
  P.saving = false;
  P.saveTried = false;
  P.recordId = "";
  P.saveError = "";
  P.speedOpen = null;
  P.openSkills = {};
  P.logUid = "";
  P.battleLogOpen = null;
  P.live = null;



  /* ---------------- 选人 ---------------- */





  /* 页面上的角色数/技能数只在这里算，不写字面量：技能库一加人，提示自动跟上 */


  /* ---------------- 本地续战 ---------------- */





  /* ---------------- 开局 ---------------- */


  P.startBattle = function (a, b, seed, restoreActions) {
    if (!a || !b) {
      P.setHint("先选两个角色");
      return;
    }
    var useSeed = seed == null ? P.readSeed() : seed;
    P.dom.seed.value = String(useSeed);
    P.meta = { a: a, b: b };
    P.history = [];
    P.actions = [];
    P.saved = false;
    P.saving = false;
    P.saveTried = false;
    P.recordId = "";
    P.saveError = "";
    P.mode = "play";
    P.logUid = "";
    root.BattlePick.cancel(P.pick);

    var created = B.battle.create({ seed: useSeed, a: a, b: b });
    P.state = created.state;

    if (restoreActions && restoreActions.length) {
      try {
        for (var i = 0; i < restoreActions.length; i++) {
          var result = B.battle.apply(P.state, restoreActions[i]);
          P.state = result.state;
          P.actions.push(result.committed);
        }
        P.hint = "已恢复上一局，进度 " + P.actions.length + " 步";
      } catch (err) {
        P.hint = "上一局恢复失败（" + err.message + "），已重新开局";
        P.state = created.state;
        P.actions = [];
      }
    } else {
      P.hint = "开战：第 1 标准回合，" + P.state.units[0].name + " 先手（速度低者先行）";
    }

    P.dom.setup.hidden = true;
    P.dom.stage.hidden = false;
    P.dom.result.hidden = true;
    P.setImmersive(true);
    P.render();
  }

  /* ---------------- 渲染 ---------------- */




  /* 伤害记录浮层：从状态行下方展开，盖住下面的操作栏；高度按视口剩余量算 */

  P.render = function () {
    if (!P.state) return;
    var live = !!P.remote && P.mode === "play" && !!root.RPG6LiveStage;
    if (live) {
      if (!P.live) P.live = root.RPG6LiveStage.create();
      P.live.mount(P.dom.stage);
      P.live.render(P.state, P.meta, P.pick, P.hint, {
        side: P.remote.side || "a",
        readOnly: !P.remote.canAct()
      });
    } else {
      if (P.live) {
        P.live.unmount();
        P.live = null;
      }
      var compact = P.isCompact();
      P.dom.grid.innerHTML = root.BattleView.render(P.state, P.meta, P.pick, P.hint, {
        readOnly: P.mode !== "play" || (!!P.remote && !P.remote.canAct()),
        speedOpen: P.speedOpen === null ? !compact : P.speedOpen,
        battleLogOpen: P.battleLogOpen === null ? !compact : P.battleLogOpen,
        battleLogPreview: !compact,
        logUid: P.logUid
      });
      P.dom.grid.classList.toggle("is-picking", root.BattlePick.isActive(P.pick));
      P.dom.grid.classList.toggle("is-replay", P.mode !== "play");
      P.restoreOpenSkills();
      P.applyLogPanel();
      P.matchLogHeight();
      var logBox = P.dom.grid.querySelector("[data-log]");
      if (logBox && logBox.open) logBox.scrollTop = logBox.scrollHeight;
    }
    if (P.dom.turnEl) P.dom.turnEl.textContent = P.turnText();
    if (P.dom.hintEl) P.dom.hintEl.textContent = P.hint;
    if (P.dom.replayBox) {
      P.dom.replayBox.hidden = P.mode !== "replay";
      if (P.dom.takeover) {
        P.dom.takeover.disabled = P.mode !== "replay" || P.replayIndex >= P.replayStates.length - 1;
      }
      if (P.mode === "replay") {
        P.dom.stepInfo.textContent = "第 " + P.replayIndex + " / " + (P.replayStates.length - 1) + " 步" +
          (P.replayIndex === P.replayStates.length - 1
            ? (P.oldEngine ? " · 旧引擎战报" : (P.hashMatched ? " · 校验通过" : " · 与当前角色数据不一致"))
            : "");
      }
    }
    if (P.dom.undo) P.dom.undo.hidden = P.mode !== "play" || !!P.remote;
    if (P.dom.restart) {
      P.dom.restart.textContent = P.mode === "replay" ? "退出回放" : "认输";
      P.dom.restart.hidden = P.mode !== "replay" &&
        (P.remote ? (!P.remote.canAct() || P.state.phase === "finished") : P.state.phase === "finished");
    }
    if (P.dom.roomLeaveBar) P.dom.roomLeaveBar.hidden = !P.remote;
    document.title = P.state.phase === "finished" && P.mode === "play" ? "对局结束 · " + P.BASE_TITLE : P.BASE_TITLE;
    if (P.mode === "play" && P.state.phase === "finished") {
      P.maybeSave();
      P.showResult();
    }
    if (P.remote && P.remote.syncStatus) P.remote.syncStatus();
  }

  P.hashMatched = true;


  P.setHint = function (text) {
    P.hint = text;
    if (P.dom.hintEl) P.dom.hintEl.textContent = text;
  }

  /* ---------------- 存档 ---------------- */



  /* ---------------- 交互 ---------------- */

  P.applyAction = function (action) {
    if (P.remote) return P.remote.act ? P.remote.act(action) : false;
    var before = B.state.clone(P.state);
    var result;
    try {
      result = B.battle.apply(P.state, action);
    } catch (err) {
      P.setHint(err.message);
      root.BattlePick.cancel(P.pick);
      P.render();
      return false;
    }
    P.history.push(before);
    if (P.history.length > 60) P.history.shift();
    P.state = result.state;
    P.actions.push(result.committed);
    P.hint = P.describe(result.events);
    root.BattlePick.cancel(P.pick);
    P.writeLive();
    P.render();
    return true;
  }

  P.currentUnit = function () {
    if (!P.state || P.mode !== "play" || P.state.phase === "finished" || !P.state.turnUid) return null;
    return B.state.unitOf(P.state, P.state.turnUid);
  }

  P.enemySideOf = function (unit) {
    return B.state.otherSide(P.state, B.state.sideOf(P.state, unit.uid));
  }

  P.enemyHeroUid = function (unit) {
    var hero = B.state.heroOf(P.state, P.enemySideOf(unit));
    return hero ? hero.uid : "";
  }

  P.allowedEnemyUids = function (unit) {
    var list = B.state.combatantsOf(P.state, P.enemySideOf(unit));
    if (B.traits && B.traits.ignoreTaunt && B.traits.ignoreTaunt(unit)) {
      return list.map(function (u) { return u.uid; });
    }
    var max = -Infinity;
    list.forEach(function (u) { max = Math.max(max, Number(u.taunt) || 0); });
    return list.filter(function (u) { return (Number(u.taunt) || 0) === max; })
      .map(function (u) { return u.uid; });
  }

  P.onBasic = function (kind) {
    var unit = P.currentUnit();
    if (!unit) return;
    if (kind === "chargeMp") {
      P.applyAction({ kind: "basic", type: "chargeMp" });
      return;
    }
    var healUid = B.skills.basicHealTarget ? B.skills.basicHealTarget(P.state, unit) : null;
    if (healUid) {
      P.applyAction({ kind: "basic", type: "attack", target: healUid });
      P.setHint("给「" + B.state.unitOf(P.state, healUid).name + "」回血");
      return;
    }
    if (kind === "break") {
      var breakTargets = P.allowedEnemyUids(unit).filter(function (uid) {
        var target = B.state.unitOf(P.state, uid);
        return !target.breakImmune && target.breakValue >= B.rules.CONFIG.breakThreshold;
      });
      if (!breakTargets.length) {
        P.setHint("目标击溃值不足 " + B.rules.CONFIG.breakThreshold + " 或免疫击溃");
        return;
      }
      root.BattlePick.begin(P.pick, { mode: "basic", type: "break", targets: breakTargets });
      P.setHint("选择要击溃的角色");
      P.render();
      return;
    }
    var targets = P.allowedEnemyUids(unit);
    if (unit.trait && unit.trait.canHitAlly) targets = [unit.uid].concat(targets);
    if (!targets.length) {
      P.setHint("没有合法目标");
      return;
    }
    root.BattlePick.begin(P.pick, { mode: "basic", type: "attack", targets: targets });
    P.setHint("选择普攻目标");
    P.render();
  }

  P.onSkill = function (skillId) {
    var unit = P.currentUnit();
    if (!unit) return;
    var skill = B.skills.find(skillId);
    if (!skill) return;
    if (skill.owner !== unit.name) {
      P.setHint("现在不是「" + skill.owner + "」的回合");
      return;
    }
    var check = B.conditions.evaluate(P.state, unit, skill);
    if (!check.ok) {
      P.setHint(check.reason);
      return;
    }
    if (check.needsCharge) {
      var amount = (unit.charge && unit.charge.skillId === skill.id ? unit.charge.amount : 0) + 1;
      if (P.applyAction({ kind: "skill", skillId: skill.id, target: P.defaultTarget(unit, skill) })) {
        P.setHint("为「" + skill.name + "」蓄力 " + amount + "/" + (check.effective ? check.effective.charge : skill.charge));
      }
      return;
    }
    var targets = P.targetsOf(unit, skill);
    if (!targets.length) {
      P.setHint("这个技能没有合法目标");
      return;
    }
    if (targets.length === 1 && skill.input) {
      root.BattlePick.begin(P.pick, { mode: "input", id: skill.id, targets: [targets[0]] });
      P.setHint("输入「" + skill.name + "」要支付的蓝");
      P.render();
      return;
    }
    if (targets.length === 1 && skill.choices && skill.choices.length) {
      root.BattlePick.begin(P.pick, { mode: "choice", id: skill.id, targets: [targets[0]] });
      P.setHint("选择「" + skill.name + "」这次造成的伤害类型");
      P.render();
      return;
    }
    if (targets.length === 1) {
      P.applyAction({ kind: "skill", skillId: skill.id, target: targets[0] });
      return;
    }
    root.BattlePick.begin(P.pick, { mode: "skill", id: skill.id, targets: targets });
    P.setHint("选择「" + skill.name + "」的目标");
    P.render();
  }







  /* 手机没有 hover，点一下 chip 在它旁边弹气泡 */
  P.popShownAt = 0;




  P.undo = function () {
    if (P.remote) {
      P.setHint("联机对局不能撤销");
      return;
    }
    if (P.mode !== "play") return;
    if (!P.history.length) {
      P.setHint("没有可撤销的步骤");
      return;
    }
    P.state = P.history.pop();
    P.actions.pop();
    root.BattlePick.cancel(P.pick);
    P.hint = "已撤销一步";
    P.dom.result.hidden = true;
    P.writeLive();
    P.render();
  }

  /* 认输：当前行动方判负，对方获胜；确认后作为动作写入战报，回放照常重算 */
  P.surrender = function () {
    if (P.remote && !P.remote.canAct()) {
      P.setHint("只能在自己回合认输");
      return;
    }
    var unit = P.currentUnit();
    if (!unit) return;
    if (!root.confirm("确定由「" + unit.name + "」认输吗？对方获胜。")) return;
    P.applyAction({ kind: "surrender" });
  }


  /* ---------------- 回放 ---------------- */




  /* ---------------- 横屏入口 ----------------
     能全屏并锁方向就锁；不能（iOS 网页）就留在遮罩上，等人手动横过来。
     遮罩的显示完全由 CSS 的竖屏媒体查询控制，转成横屏自动消失。 */






  /* 只认手机：粗指针 + 有触摸 + 短边不超过 520。桌面窄窗口、平板、鼠标设备都不弹遮罩 */


  P.init = function () {
    P.dom.setup = P.$("[data-setup]");
    P.dom.stage = P.$("[data-stage]");
    P.dom.grid = P.$("[data-grid]");
    P.dom.bar = P.$("[data-bar]");
    P.dom.result = P.$("[data-result]");
    P.dom.pickA = P.$("[data-pick-a]");
    P.dom.pickB = P.$("[data-pick-b]");
    P.dom.seed = P.$("[data-seed]");
    P.dom.start = P.$("[data-start]");
    P.dom.undo = P.$("[data-undo]");
    P.dom.restart = P.$("[data-restart]");
    P.dom.roomLeaveBar = P.$("[data-room-leave-bar]");
    P.dom.source = P.$("[data-source]");
    P.dom.coverage = P.$("[data-coverage]");
    P.dom.turnEl = P.$("[data-turn]");
    P.dom.hintEl = P.$("[data-hint]");
    P.dom.replayBox = P.$("[data-replay]");
    P.dom.stepInfo = P.$("[data-step-info]");
    P.dom.takeover = P.$("[data-takeover]");
    P.dom.resume = P.$("[data-resume]");
    P.dom.gate = P.$("[data-gate]");
    P.dom.gateGo = P.$("[data-gate-go]");
    P.dom.gateNote = P.$("[data-gate-note]");
    P.dom.buffPop = P.$("[data-buffpop]");

    P.bindGate();

    if (!B || !B.battle || !B.skills || !window.RPG6_SKILLS) {
      P.dom.source.textContent = "引擎或技能库没有加载成功，对局功能不可用。";
      if (P.dom.coverage) P.dom.coverage.textContent = "技能库没有加载成功，对局功能不可用。";
      P.dom.start.disabled = true;
      return;
    }

    B.skills.load(window.RPG6_SKILLS);
    P.bind();

    var params = new URLSearchParams(root.location.search);
    var recordIdParam = params.get("record");
    var roomParam = recordIdParam ? "" : (params.get("room") || "");

    var load = P.loadCharacters();
    load.now.then(function (result) {
      P.applyRoster(result);
      if (P.remoteRefreshRoster) P.remoteRefreshRoster();

      /* 4 秒没等到数据库就先给兜底数据；真正的结果晚到时，只要还没开打就换过来 */
      load.remote.then(function (late) {
        if (P.state || recordIdParam || roomParam) return;
        if (!late || !late.list || late.list === P.roster) return;
        P.applyRoster(late);
        if (P.remoteRefreshRoster) P.remoteRefreshRoster();
        P.offerResume();
      }).catch(function () {});

      if (recordIdParam) {
        P.loadRecord(recordIdParam);
        return;
      }
      if (P.remoteInit) P.remoteInit(roomParam);
      if (!P.roster.length) {
        P.dom.source.textContent = "技能库里没有任何能上场的角色。";
        P.dom.start.disabled = true;
        return;
      }
      if (roomParam) return;
      P.offerResume();
    }).catch(function (err) {
      P.dom.source.textContent = "读取角色失败：" + err.message;
      P.dom.start.disabled = true;
    });
  }


  root.BattlePage = { init: P.init, start: P.startBattle, undo: P.undo };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", P.init);
  } else {
    P.init();
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

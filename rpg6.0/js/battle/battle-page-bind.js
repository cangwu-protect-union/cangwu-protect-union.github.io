/* 回合制正传 6.0 · 对局页 · 事件绑定
   只把 DOM 事件接到 P 上的处理函数；规则在引擎里，渲染在 battle-view 里。
   与 battle-page.js 共用 RPG6BattlePage 命名空间，由 entry.js 在装配文件之前加载。 */
(function (root) {
  "use strict";

  var P = root.RPG6BattlePage = root.RPG6BattlePage || {};

  /* ---------------- 事件 ---------------- */

  P.bind = function () {
    P.dom.stage.addEventListener("click", function (event) {
      if (P.mode !== "play") return;
      var basic = event.target.closest("[data-basic]");
      if (basic) {
        event.preventDefault();
        P.onBasic(basic.getAttribute("data-basic"));
        return;
      }
      var toggle = event.target.closest(".bq-skill-toggle");
      if (toggle) {
        event.preventDefault();
        var row = toggle.closest(".bq-skill");
        if (row) {
          var opened = row.classList.toggle("is-open");
          toggle.textContent = opened ? "收起" : "效果";
          P.openSkills[row.getAttribute("data-skill") || ""] = opened;
        }
        return;
      }
      var chip = event.target.closest("[data-detail]");
      if (chip) {
        event.preventDefault();
        P.showBuffPop(chip);
        return;
      }
      var logBtn = event.target.closest(".bu-log-toggle");
      if (logBtn) {
        event.preventDefault();
        var card = logBtn.closest("[data-unit]");
        var uid = card ? card.getAttribute("data-unit") : "";
        P.logUid = P.logUid === uid ? "" : uid;
        P.render();
        return;
      }
      var skill = event.target.closest("[data-skill]");
      if (skill) {
        event.preventDefault();
        var panel = skill.closest(".battle-query");
        if (panel && !panel.classList.contains("is-active")) return;
        P.onSkill(skill.getAttribute("data-skill"));
        return;
      }
      var summonChip = event.target.closest("[data-summon]");
      if (summonChip) {
        event.preventDefault();
        P.onSummonClick(summonChip.getAttribute("data-summon"), summonChip);
        return;
      }
      var choice = event.target.closest("[data-choice]");
      if (choice) {
        event.preventDefault();
        var choiceTarget = (P.pick.targets && P.pick.targets[0]) || "";
        P.applyAction({
          kind: "skill",
          skillId: P.pick.id,
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
        P.applyAction({
          kind: "skill",
          skillId: P.pick.id,
          target: (P.pick.targets && P.pick.targets[0]) || "",
          n: Math.floor(Number(inputEl ? inputEl.value : NaN))
        });
        return;
      }
      if (event.target.closest(".bq-input")) return;
      var unlockBtn = event.target.closest("[data-unlock]");
      if (unlockBtn) {
        event.preventDefault();
        P.onUnlock();
        return;
      }
      var unlockStat = event.target.closest("[data-unlock-stat]");
      if (unlockStat) {
        event.preventDefault();
        P.applyAction({ kind: "unlock", stat: unlockStat.getAttribute("data-unlock-stat") });
        return;
      }
      var itemBtn = event.target.closest("[data-item]");
      if (itemBtn) {
        event.preventDefault();
        P.onItem(itemBtn.getAttribute("data-item"));
        return;
      }
      var unit = event.target.closest("[data-unit]");
      if (unit) {
        event.preventDefault();
        P.onUnitClick(unit.getAttribute("data-unit"));
        return;
      }
      if (root.BattlePick.isActive(P.pick)) {
        root.BattlePick.cancel(P.pick);
        P.setHint("已取消选择");
        P.render();
      }
    });

    P.dom.stage.addEventListener("toggle", function (event) {
      if (!event.target.closest) return;
      var speed = event.target.closest("[data-speed]");
      if (speed) P.speedOpen = speed.open;
      var battleLog = event.target.closest("[data-log]");
      if (battleLog) {
        P.battleLogOpen = battleLog.open;
        P.matchLogHeight();
      }
    }, true);

    P.dom.stage.addEventListener("mouseover", function (event) {
      var chip = event.target.closest("[data-detail]");
      if (chip) {
        P.onBuffEnter(chip.getAttribute("data-detail"));
        return;
      }
      var summon = event.target.closest("[data-summondetail]");
      if (summon) P.onBuffEnter("summon:" + summon.getAttribute("data-summondetail"));
    });
    P.dom.stage.addEventListener("mouseout", function (event) {
      if (event.target.closest("[data-detail]") || event.target.closest("[data-summondetail]")) P.onBuffLeave();
    });

    document.addEventListener("click", function (event) {
      if (!P.dom.buffPop || P.dom.buffPop.hidden) return;
      if (event.target.closest("[data-detail]") || event.target.closest("[data-summondetail]") ||
        event.target.closest("[data-buffpop]")) return;
      P.hideBuffPop();
    });
    root.addEventListener("scroll", P.onScrollHidePop, true);

    if (root.matchMedia) {
      var compactMq = root.matchMedia("(orientation: landscape) and (max-height: 520px)");
      var onViewport = function () { if (P.state) P.render(); };
      if (compactMq.addEventListener) compactMq.addEventListener("change", onViewport);
      else if (compactMq.addListener) compactMq.addListener(onViewport);
    }

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      if (P.battleLogOpen) {
        P.battleLogOpen = false;
        P.render();
        return;
      }
      if (root.BattlePick.isActive(P.pick)) {
        root.BattlePick.cancel(P.pick);
        P.setHint("已取消选择");
        P.render();
      }
    });

    P.dom.start.addEventListener("click", function () {
      P.startBattle(P.byName[P.dom.pickA.value], P.byName[P.dom.pickB.value], null, null);
    });
    P.dom.undo.addEventListener("click", P.undo);
    P.dom.restart.addEventListener("click", function () {
      if (P.mode === "replay") {
        P.backToSetup();
        return;
      }
      P.surrender();
    });
    P.dom.replayBox.addEventListener("click", function (event) {
      if (event.target.closest("[data-step-prev]")) P.stepReplay(-1);
      if (event.target.closest("[data-step-next]")) P.stepReplay(1);
      if (event.target.closest("[data-step-start]")) {
        P.replayIndex = 0;
        P.state = P.replayStates[0];
        P.render();
      }
      if (event.target.closest("[data-step-end]")) {
        P.replayIndex = P.replayStates.length - 1;
        P.state = P.replayStates[P.replayIndex];
        P.render();
      }
      if (event.target.closest("[data-takeover]") && P.replayRecord) {
        if (P.replayIndex >= P.replayStates.length - 1) return;
        var prefix = P.replayRecord.actions.slice(0, P.replayIndex);
        P.startBattle(P.meta.a, P.meta.b, P.replayRecord.seed, prefix);
      }
    });

    P.dom.result.addEventListener("click", function (event) {
      if (event.target.closest("[data-again]")) P.startBattle(P.meta.a, P.meta.b, null, null);
      if (event.target.closest("[data-back]")) P.backToSetup();
      if (event.target.closest("[data-retry-save]")) {
        P.saved = false;
        P.saving = false;
        P.saveTried = false;
        P.showResult();
        P.maybeSave();
      }
    });
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

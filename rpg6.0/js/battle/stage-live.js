/* 回合制正传 6.0 · 联机对局舞台
   把 BattleView.render() 的旧片段分拣进 7 个浮窗；只在 P.remote 且对局中启用。
   组件自身不保存游戏状态，所有展示数据都来自 render(state, meta, pick, hint, opts)。 */

import { createWindowManager } from "./battle-windows.js";

const root = globalThis;
const SIDE_INDEX = { a: 0, b: 1 };

function create() {
  let manager = null;
  let liveRoot = null;
  let winRoot = null;
  let dockRoot = null;
  let stageEl = null;
  let observer = null;
  let resetBtn = null;
  let mountedFlag = false;

  function page() {
    return root.RPG6BattlePage || null;
  }

  function barEl() {
    var P = page();
    var bar = (P && P.dom && P.dom.bar) || root.document.querySelector("[data-bar]");
    return bar || null;
  }

  function barHeight() {
    var bar = barEl();
    var h = bar ? bar.getBoundingClientRect().height : 0;
    return h || 38;
  }

  function onReset(event) {
    event.stopPropagation();
    if (manager) manager.reset();
  }

  function addResetButton() {
    var bar = barEl();
    if (!bar) return;
    var old = bar.querySelector("[data-reset-windows]");
    if (old && old.parentNode) old.parentNode.removeChild(old);
    resetBtn = root.document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "btn btn-ghost";
    resetBtn.setAttribute("data-reset-windows", "");
    resetBtn.textContent = "复位窗口";
    resetBtn.addEventListener("click", onReset);
    bar.appendChild(resetBtn);
  }

  function mount(stage) {
    if (mountedFlag) return;
    stageEl = stage || root.document.querySelector("[data-stage]");
    if (!stageEl) return;
    liveRoot = stageEl.querySelector("[data-live]");
    if (!liveRoot) return;
    winRoot = liveRoot.querySelector("[data-windows]");
    dockRoot = liveRoot.querySelector("[data-dock]");
    if (!winRoot) return;

    liveRoot.hidden = false;
    root.document.documentElement.classList.add("is-live");

    manager = createWindowManager({ getBarHeight: barHeight });
    manager.mount(winRoot, dockRoot);
    addResetButton();

    observer = new MutationObserver(function () {
      if (stageEl && stageEl.hidden) unmount();
    });
    observer.observe(stageEl, { attributes: true, attributeFilter: ["hidden"] });

    mountedFlag = true;
  }

  function setBody(id, node) {
    if (!manager) return;
    var body = manager.bodyOf(id);
    if (!body) return;
    body.innerHTML = "";
    if (node) body.appendChild(node);
  }

  function hpCol(side, label, logNode) {
    var col = root.document.createElement("div");
    col.className = "lw-hp-col";
    col.setAttribute("data-hp-side", side);
    var title = root.document.createElement("h3");
    title.textContent = label;
    col.appendChild(title);
    if (logNode) {
      col.appendChild(logNode);
    } else {
      var empty = root.document.createElement("p");
      empty.className = "bu-log-empty";
      empty.textContent = "还没有血量变化";
      col.appendChild(empty);
    }
    return col;
  }

  function restoreOpenSkills() {
    var P = page();
    var open = P && P.openSkills ? P.openSkills : {};
    Object.keys(open).forEach(function (id) {
      if (!open[id]) return;
      var li = liveRoot.querySelector('.bq-skill[data-skill="' + id + '"]');
      if (!li) return;
      li.classList.add("is-open");
      var btn = li.querySelector(".bq-skill-toggle");
      if (btn) btn.textContent = "收起";
    });
  }

  function render(state, meta, pick, hint, opts) {
    if (!mountedFlag || !state || !root.BattleView) return;
    var options = opts || {};

    var html = root.BattleView.render(state, meta, pick, hint, {
      readOnly: !!options.readOnly,
      speedOpen: true,
      battleLogOpen: true,
      battleLogPreview: false,
      logUid: ""
    });

    var tpl = root.document.createElement("template");
    tpl.innerHTML = html;
    var frag = tpl.content;

    var units = frag.querySelectorAll(".battle-unit");
    var queries = frag.querySelectorAll(".battle-query");
    var speed = frag.querySelector("[data-speed]");
    var log = frag.querySelector("[data-log]");

    var sideKey = options.side === "b" ? "b" : "a";
    var ownIdx = SIDE_INDEX[sideKey];
    var enemyIdx = ownIdx === 0 ? 1 : 0;
    var ownUnit = units[ownIdx] || null;
    var enemyUnit = units[enemyIdx] || null;
    var ownQuery = queries[ownIdx] || null;
    var enemyQuery = queries[enemyIdx] || null;

    var ownLog = ownUnit ? ownUnit.querySelector(".bu-log") : null;
    var enemyLog = enemyUnit ? enemyUnit.querySelector(".bu-log") : null;
    if (ownLog && ownLog.parentNode) ownLog.parentNode.removeChild(ownLog);
    if (enemyLog && enemyLog.parentNode) enemyLog.parentNode.removeChild(enemyLog);

    var hpGrid = root.document.createElement("div");
    hpGrid.className = "lw-hp-grid";
    hpGrid.appendChild(hpCol("own", "己方", ownLog));
    hpGrid.appendChild(hpCol("enemy", "敌方", enemyLog));

    setBody("speed", speed);
    setBody("panel-own", ownUnit);
    setBody("panel-enemy", enemyUnit);
    setBody("query-own", ownQuery);
    setBody("query-enemy", enemyQuery);
    setBody("hp-record", hpGrid);
    setBody("battle-log", log);

    if (speed) speed.open = true;

    liveRoot.classList.toggle("is-picking", !!(root.BattlePick && root.BattlePick.isActive(pick)));
    restoreOpenSkills();

    if (log) {
      log.scrollTop = log.scrollHeight;
      var items = log.querySelector(".bl-items");
      if (items) items.scrollTop = items.scrollHeight;
    }

    if (manager) manager.syncContent();
  }

  function unmount() {
    if (!mountedFlag) return;
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (manager) {
      manager.destroy();
      manager = null;
    }
    if (resetBtn) {
      resetBtn.removeEventListener("click", onReset);
      if (resetBtn.parentNode) resetBtn.parentNode.removeChild(resetBtn);
      resetBtn = null;
    }
    root.document.documentElement.classList.remove("is-live");
    if (liveRoot) {
      liveRoot.classList.remove("is-picking");
      liveRoot.hidden = true;
    }
    if (winRoot) winRoot.innerHTML = "";
    if (dockRoot) dockRoot.innerHTML = "";
    winRoot = null;
    dockRoot = null;
    liveRoot = null;
    stageEl = null;
    mountedFlag = false;
  }

  function mounted() {
    return mountedFlag;
  }

  return {
    mount: mount,
    render: render,
    unmount: unmount,
    mounted: mounted
  };
}

root.RPG6LiveStage = { create: create };

/* 回合制正传 6.0 · 联机对局舞台
   直接按窗口生成内容，不再解析旧网格片段；只在 P.remote 且对局中启用。
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

  function scrollLogToEnd() {
    if (!manager) return;
    var body = manager.bodyOf("battle-log");
    if (!body || !body.clientHeight) return;
    body.scrollTop = body.scrollHeight;
  }

  /* 战报窗默认折叠；折叠时 scrollHeight 为 0，展开后补一次滚到最新 */
  function onLiveClick(event) {
    var chip = event.target.closest ? event.target.closest("[data-fold], [data-dock-win]") : null;
    if (!chip) return;
    var win = chip.closest(".lw-window");
    var winId = win ? win.getAttribute("data-win") : chip.getAttribute("data-dock-win");
    if (winId !== "battle-log") return;
    root.setTimeout(scrollLogToEnd, 0);
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
    liveRoot.addEventListener("click", onLiveClick);

    observer = new MutationObserver(function () {
      if (stageEl && stageEl.hidden) unmount();
    });
    observer.observe(stageEl, { attributes: true, attributeFilter: ["hidden"] });

    mountedFlag = true;
  }

  function setBody(id, html) {
    if (!manager) return;
    var body = manager.bodyOf(id);
    if (!body) return;
    var prevTop = body.scrollTop;
    var wasEmpty = !body.firstElementChild;
    var atBottom = body.scrollHeight - body.scrollTop - body.clientHeight <= 2;
    body.innerHTML = typeof html === "string" ? html : "";
    var sticky = id === "battle-log" || id === "speed";
    if (sticky && (wasEmpty || atBottom)) {
      body.scrollTop = body.scrollHeight;
    } else {
      body.scrollTop = prevTop;
    }
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
    var BV = root.BattleView;

    var sideKey = options.side === "b" ? "b" : "a";
    var ownIdx = SIDE_INDEX[sideKey];
    var enemyIdx = ownIdx === 0 ? 1 : 0;
    var own = state.units[ownIdx];
    var enemy = state.units[enemyIdx];
    var readOnly = !!options.readOnly;

    setBody("speed", '<div class="lw-speed">' +
      BV.renderSpeed(state, BV.buildForecast(state, 21), sideKey) + "</div>");
    setBody("panel-own", BV.renderUnit(state, own, state.turnUid === own.uid, "", pick,
      { hideSummons: true, hideLog: true, bars: true }));
    setBody("panel-enemy", BV.renderUnit(state, enemy, state.turnUid === enemy.uid, "", pick,
      { hideSummons: true, hideLog: true, bars: true }));
    setBody("query-own", BV.renderQuery(state, own, meta, pick, readOnly, { hideStats: true }));
    setBody("query-enemy", BV.renderQuery(state, enemy, meta, pick, true, { hideStats: true }));
    setBody("hp-record", BV.renderHpRecord(state, sideKey));
    setBody("battle-log", BV.renderLogWindow(state));

    liveRoot.classList.toggle("is-picking", !!(root.BattlePick && root.BattlePick.isActive(pick)));
    restoreOpenSkills();

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
      liveRoot.removeEventListener("click", onLiveClick);
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

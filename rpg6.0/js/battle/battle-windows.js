/* 回合制正传 6.0 · 联机舞台浮窗管理
   只负责窗口壳、拖动、折叠、置顶与位置记忆；窗口内容由 stage-live 写入 [data-body]。 */

const STORAGE_KEY = "rpg6-live-windows-v1";
const COMPACT_QUERY = "(max-width: 900px), (orientation: landscape) and (max-height: 520px)";

const WINDOW_DEFS = [
  { id: "speed", title: "速度条预期" },
  { id: "panel-own", title: "角色 · 己方" },
  { id: "panel-enemy", title: "角色 · 敌方" },
  { id: "query-own", title: "操作 · 己方" },
  { id: "query-enemy", title: "操作 · 敌方" },
  { id: "hp-record", title: "扣血记录" },
  { id: "battle-log", title: "详细战报" }
];

const DESKTOP_EXPANDED = ["speed", "panel-own", "panel-enemy", "query-own"];
const COMPACT_EXPANDED = ["panel-own", "query-own"];
const DOCK_ORDER = ["hp-record", "battle-log", "query-enemy"];

/* 紧凑模式各窗上限：己方面板压到 0.22、己方查询 0.40，其余沿用 0.46 */
function compactHeight(id, vh) {
  var ratio = id === "panel-own" ? 0.22 : (id === "query-own" ? 0.40 : 0.46);
  return Math.max(id === "panel-own" ? 72 : 80, Math.round(vh * ratio));
}

export function createWindowManager(options) {
  const opts = options || {};
  const getBarHeight = typeof opts.getBarHeight === "function" ? opts.getBarHeight : function () { return 38; };
  const onChange = typeof opts.onChange === "function" ? opts.onChange : null;

  const rootWin = typeof window !== "undefined" ? window : globalThis;

  let winRoot = null;
  let dockRoot = null;
  let wins = [];
  let byId = {};
  let drag = null;
  let zTop = 10;
  let mq = null;
  let mounted = false;
  let lastCompact = null;
  let desktopSnapshot = null;

  function isCompact() {
    return !!(rootWin.matchMedia && rootWin.matchMedia(COMPACT_QUERY).matches);
  }

  function expandedIds(compact) {
    return compact ? COMPACT_EXPANDED : DESKTOP_EXPANDED;
  }

  function bounds() {
    var barH = Number(getBarHeight()) || 38;
    var cw = winRoot ? winRoot.clientWidth : 0;
    var ch = winRoot ? winRoot.clientHeight : 0;
    var vw = cw > 0 ? cw : (rootWin.innerWidth || 1024);
    var vh = ch > 0 ? ch : Math.max(200, (rootWin.innerHeight || 768) - barH);
    return { vw: vw, vh: vh };
  }

  function defaultLayout() {
    var b = bounds();
    var vw = b.vw;
    var vh = b.vh;
    var compact = isCompact();
    var out = {
      speed: { left: 8, top: 8, w: 222, h: 519 },
      "panel-own": { left: 8, top: Math.max(0, vh - 156 - 8), w: 375, h: 156 },
      "panel-enemy": { left: Math.max(0, vw - 372 - 8), top: 8, w: 372, h: 156 },
      "query-own": { left: Math.max(0, vw - 468 - 8), top: Math.max(0, vh - 261 - 8), w: 468, h: 261 },
      "query-enemy": { left: Math.max(0, vw - 468 - 8), top: Math.max(0, vh - 261 - 8), w: 468, h: 261 },
      "hp-record": { left: Math.max(0, Math.round((vw - 390) / 2)), top: Math.max(0, Math.round(vh * 0.12)), w: 390, h: 225 },
      "battle-log": { left: Math.max(0, Math.round((vw - 375) / 2)), top: Math.max(0, Math.round((vh - 285) / 2)), w: 375, h: 285 }
    };
    if (compact) {
      var mid = Math.round(vh * 0.48);
      out.speed = { left: 6, top: 8, w: out.speed.w, h: out.speed.h };
      out["panel-enemy"] = { left: 6, top: 8, w: out["panel-enemy"].w, h: out["panel-enemy"].h };
      out["query-enemy"] = { left: 6, top: mid, w: out["query-enemy"].w, h: out["query-enemy"].h };
      out["hp-record"] = { left: 6, top: 8, w: out["hp-record"].w, h: out["hp-record"].h };
      out["battle-log"] = { left: 6, top: 8, w: out["battle-log"].w, h: out["battle-log"].h };
      var queryH = Math.min(out["query-own"].h, compactHeight("query-own", vh));
      out["panel-own"] = { left: 6, top: 26, w: out["panel-own"].w, h: out["panel-own"].h };
      out["query-own"] = { left: 6, top: Math.max(0, vh - queryH - 6), w: out["query-own"].w, h: out["query-own"].h };
    }
    return out;
  }

  function effectiveSize(w) {
    var b = bounds();
    var compact = isCompact();
    var ew = w.w;
    if (compact) ew = w.id === "panel-own" ? Math.max(160, Math.round(b.vw * 0.5)) : Math.max(120, b.vw - 12);
    var eh = compact ? Math.min(w.h, compactHeight(w.id, b.vh)) : w.h;
    ew = Math.min(ew, b.vw);
    eh = Math.min(eh, Math.max(80, b.vh - 6));
    return { w: ew, h: eh };
  }

  function clampWin(w) {
    var b = bounds();
    var size = effectiveSize(w);
    var maxLeft = Math.max(0, b.vw - size.w);
    var maxTop = Math.max(0, b.vh - size.h - 6);
    w.left = Math.max(0, Math.min(w.left, maxLeft));
    w.top = Math.max(0, Math.min(w.top, maxTop));
  }

  function applyWin(w) {
    var compact = isCompact();
    var size = effectiveSize(w);
    var el = w.el;
    el.style.left = Math.round(w.left) + "px";
    el.style.top = Math.round(w.top) + "px";
    el.style.width = Math.round(size.w) + "px";
    el.style.height = Math.round(size.h) + "px";
    el.style.zIndex = String(w.z);
    el.classList.toggle("is-compact", compact);
    el.classList.toggle("is-folded", !!w.collapsed);
  }

  function buildShell(def) {
    var section = rootWin.document.createElement("section");
    section.className = "lw-window";
    section.setAttribute("data-win", def.id);

    var header = rootWin.document.createElement("header");
    header.className = "lw-bar";

    var grip = rootWin.document.createElement("span");
    grip.className = "lw-grip";
    grip.setAttribute("aria-hidden", "true");
    grip.textContent = "⋮⋮";

    var title = rootWin.document.createElement("span");
    title.className = "lw-title";
    title.textContent = def.title;

    var fold = rootWin.document.createElement("button");
    fold.type = "button";
    fold.className = "lw-fold";
    fold.setAttribute("data-fold", "");
    fold.setAttribute("aria-label", "折叠");
    fold.textContent = "–";

    header.appendChild(grip);
    header.appendChild(title);
    header.appendChild(fold);

    var body = rootWin.document.createElement("div");
    body.className = "lw-body";
    body.setAttribute("data-body", "");

    section.appendChild(header);
    section.appendChild(body);
    return { el: section, bodyEl: body };
  }

  function readSaved() {
    try {
      var raw = rootWin.localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      var obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : {};
    } catch (e) {
      return {};
    }
  }

  function writeSaved() {
    if (isCompact()) return;
    try {
      var out = {};
      wins.forEach(function (w) {
        out[w.id] = { left: Math.round(w.left), top: Math.round(w.top), collapsed: !!w.collapsed, z: w.z };
      });
      rootWin.localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
    } catch (e) {
      /* 隐私模式或配额满，忽略即可 */
    }
  }

  function findWin(node) {
    var el = node && node.closest ? node.closest(".lw-window") : null;
    if (!el) return null;
    return byId[el.getAttribute("data-win")] || null;
  }

  function lift(w) {
    if (!w) return;
    zTop += 1;
    if (zTop > 29) {
      var sorted = wins.slice().sort(function (a, b) { return a.z - b.z; });
      zTop = 9;
      sorted.forEach(function (item) {
        zTop += 1;
        item.z = zTop;
        item.el.style.zIndex = String(item.z);
      });
      zTop += 1;
    }
    w.z = zTop;
    w.el.style.zIndex = String(w.z);
  }

  function renderDock() {
    if (!dockRoot) return;
    dockRoot.innerHTML = "";
    var folded = wins.filter(function (w) { return w.collapsed; });
    folded.sort(function (a, b) {
      var ai = DOCK_ORDER.indexOf(a.id);
      var bi = DOCK_ORDER.indexOf(b.id);
      if (ai < 0) ai = 100 + wins.indexOf(a);
      if (bi < 0) bi = 100 + wins.indexOf(b);
      return ai - bi;
    });
    folded.forEach(function (w) {
      var chip = rootWin.document.createElement("button");
      chip.type = "button";
      chip.className = "lw-dock-chip";
      chip.setAttribute("data-dock-win", w.id);
      chip.setAttribute("aria-label", "展开" + w.title);
      chip.textContent = w.title;
      dockRoot.appendChild(chip);
    });
  }

  function toggleFold(w) {
    w.collapsed = !w.collapsed;
    if (!w.collapsed) {
      clampWin(w);
      lift(w);
    }
    applyWin(w);
    renderDock();
    writeSaved();
  }

  function onPointerDown(e) {
    var w = findWin(e.target);
    if (!w) return;
    lift(w);
    if (e.target.closest && e.target.closest("[data-fold]")) return;
    var bar = e.target.closest ? e.target.closest(".lw-bar") : null;
    if (!bar) return;
    drag = { id: w.id, startX: e.clientX, startY: e.clientY, baseLeft: w.left, baseTop: w.top };
    w.el.classList.add("is-dragging");
    rootWin.document.body.classList.add("is-lw-dragging");
    if (e.cancelable) e.preventDefault();
    if (w.el.setPointerCapture && e.pointerId != null) {
      try { w.el.setPointerCapture(e.pointerId); } catch (err) { /* 老浏览器忽略 */ }
    }
  }

  function onPointerMove(e) {
    if (!drag) return;
    var w = byId[drag.id];
    if (!w) { drag = null; return; }
    w.left = drag.baseLeft + (e.clientX - drag.startX);
    w.top = drag.baseTop + (e.clientY - drag.startY);
    clampWin(w);
    w.el.style.left = Math.round(w.left) + "px";
    w.el.style.top = Math.round(w.top) + "px";
  }

  function onPointerUp() {
    if (!drag) return;
    var w = byId[drag.id];
    drag = null;
    if (w) {
      w.el.classList.remove("is-dragging");
      clampWin(w);
      applyWin(w);
    }
    rootWin.document.body.classList.remove("is-lw-dragging");
    writeSaved();
  }

  function onWinClick(e) {
    var fold = e.target.closest ? e.target.closest("[data-fold]") : null;
    if (!fold) return;
    var w = findWin(fold);
    if (!w) return;
    e.preventDefault();
    toggleFold(w);
  }

  function onDockClick(e) {
    var chip = e.target.closest ? e.target.closest("[data-dock-win]") : null;
    if (!chip) return;
    e.preventDefault();
    var w = byId[chip.getAttribute("data-dock-win")];
    if (!w || !w.collapsed) return;
    w.collapsed = false;
    clampWin(w);
    lift(w);
    applyWin(w);
    renderDock();
    writeSaved();
  }

  function onResize() {
    if (!mounted) return;
    var compact = isCompact();
    var enteredCompact = compact && lastCompact === false;
    var leftCompact = !compact && lastCompact === true;
    var anchors = enteredCompact ? defaultLayout() : null;
    var restored = leftCompact ? defaultLayout() : null;
    var snapById = {};
    if (enteredCompact) {
      desktopSnapshot = wins.map(function (w) {
        return { id: w.id, left: w.left, top: w.top, collapsed: !!w.collapsed, z: w.z };
      });
    }
    if (leftCompact) {
      (desktopSnapshot || []).forEach(function (s) { snapById[s.id] = s; });
    }
    lastCompact = compact;
    wins.forEach(function (w) {
      if (enteredCompact && (w.id === "panel-own" || w.id === "query-own")) {
        w.left = anchors[w.id].left;
        w.top = anchors[w.id].top;
      }
      if (leftCompact) {
        var s = snapById[w.id];
        if (s) {
          w.left = s.left;
          w.top = s.top;
          w.collapsed = !!s.collapsed;
          w.z = s.z;
        } else {
          w.left = restored[w.id].left;
          w.top = restored[w.id].top;
          w.collapsed = DESKTOP_EXPANDED.indexOf(w.id) < 0;
        }
      }
      if (enteredCompact) w.collapsed = COMPACT_EXPANDED.indexOf(w.id) < 0;
      if (compact && COMPACT_EXPANDED.indexOf(w.id) < 0) w.collapsed = true;
      clampWin(w);
      applyWin(w);
    });
    if (leftCompact) {
      desktopSnapshot = null;
      zTop = 10;
      wins.forEach(function (w) { zTop = Math.max(zTop, w.z); });
    }
    if (!compact) fitAutoHeights();
    renderDock();
  }

  function mount(wRoot, dRoot) {
    if (mounted) destroy();
    winRoot = wRoot;
    dockRoot = dRoot;
    if (!winRoot) return;
    winRoot.innerHTML = "";
    if (dockRoot) dockRoot.innerHTML = "";

    var saved = readSaved();
    var layout = defaultLayout();
    var compact = isCompact();
    var useSavedPos = !compact;
    var expanded = expandedIds(compact);
    lastCompact = compact;
    desktopSnapshot = null;

    wins = [];
    byId = {};
    zTop = 10;

    WINDOW_DEFS.forEach(function (def, idx) {
      var shell = buildShell(def);
      var base = layout[def.id] || { left: 8, top: 8, w: 260, h: 200 };
      var prev = saved[def.id] || null;
      var w = {
        id: def.id,
        title: def.title,
        el: shell.el,
        bodyEl: shell.bodyEl,
        left: useSavedPos && prev && isFinite(prev.left) ? Number(prev.left) : base.left,
        top: useSavedPos && prev && isFinite(prev.top) ? Number(prev.top) : base.top,
        w: base.w,
        h: base.h,
        collapsed: compact ? COMPACT_EXPANDED.indexOf(def.id) < 0 : (prev ? !!prev.collapsed : expanded.indexOf(def.id) < 0),
        z: prev && isFinite(prev.z) ? Math.max(10, Math.min(29, Number(prev.z))) : (10 + idx)
      };
      clampWin(w);
      applyWin(w);
      winRoot.appendChild(shell.el);
      wins.push(w);
      byId[def.id] = w;
    });

    zTop = 10;
    wins.forEach(function (w) { zTop = Math.max(zTop, w.z); });

    winRoot.addEventListener("pointerdown", onPointerDown);
    winRoot.addEventListener("click", onWinClick);
    if (dockRoot) dockRoot.addEventListener("click", onDockClick);
    rootWin.addEventListener("pointermove", onPointerMove);
    rootWin.addEventListener("pointerup", onPointerUp);
    rootWin.addEventListener("pointercancel", onPointerUp);
    rootWin.addEventListener("resize", onResize);
    if (rootWin.matchMedia) {
      mq = rootWin.matchMedia(COMPACT_QUERY);
      if (mq.addEventListener) mq.addEventListener("change", onResize);
      else if (mq.addListener) mq.addListener(onResize);
    }

    mounted = true;
    renderDock();
    if (onChange) onChange();
  }

  function destroy() {
    if (winRoot) {
      winRoot.removeEventListener("pointerdown", onPointerDown);
      winRoot.removeEventListener("click", onWinClick);
    }
    if (dockRoot) {
      dockRoot.removeEventListener("click", onDockClick);
      dockRoot.innerHTML = "";
    }
    rootWin.removeEventListener("pointermove", onPointerMove);
    rootWin.removeEventListener("pointerup", onPointerUp);
    rootWin.removeEventListener("pointercancel", onPointerUp);
    rootWin.removeEventListener("resize", onResize);
    if (mq) {
      if (mq.removeEventListener) mq.removeEventListener("change", onResize);
      else if (mq.removeListener) mq.removeListener(onResize);
      mq = null;
    }
    if (rootWin.document && rootWin.document.body) rootWin.document.body.classList.remove("is-lw-dragging");
    if (winRoot) winRoot.innerHTML = "";
    drag = null;
    wins = [];
    byId = {};
    zTop = 10;
    mounted = false;
  }

  function reset() {
    try { rootWin.localStorage.removeItem(STORAGE_KEY); } catch (e) { /* 忽略 */ }
    var layout = defaultLayout();
    var compact = isCompact();
    var expanded = expandedIds(compact);
    wins.forEach(function (w) {
      var base = layout[w.id] || { left: 8, top: 8, w: w.w, h: w.h };
      w.left = base.left;
      w.top = base.top;
      w.w = base.w;
      w.h = base.h;
      w.collapsed = expanded.indexOf(w.id) < 0;
      if (compact && COMPACT_EXPANDED.indexOf(w.id) < 0) w.collapsed = true;
      clampWin(w);
      applyWin(w);
    });
    renderDock();
    if (onChange) onChange();
  }

  /* 桌面端角色面板按内容自适应高度：取内容块 + 标题栏 + 内边距 + 边框，
     最低 120px、最高不超过视口；超出部分仍由内部滚动处理。 */
  function fitAutoHeights() {
    if (isCompact()) return;
    var b = bounds();
    ["panel-own", "panel-enemy"].forEach(function (id) {
      var w = byId[id];
      if (!w || w.collapsed) return;
      if (!w.bodyEl || !w.bodyEl.firstElementChild) return;
      var child = w.bodyEl.firstElementChild;
      var cs = rootWin.getComputedStyle(w.el);
      var borderY = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
      var bs = rootWin.getComputedStyle(w.bodyEl);
      var padY = (parseFloat(bs.paddingTop) || 0) + (parseFloat(bs.paddingBottom) || 0);
      var barEl = w.el.querySelector(".lw-bar");
      var barH = barEl ? barEl.offsetHeight : 30;
      var h = Math.ceil(barH + padY + child.offsetHeight + borderY);
      h = Math.max(120, Math.min(h, b.vh));
      if (h === Math.round(w.h)) return;
      w.h = h;
      clampWin(w);
      applyWin(w);
    });
  }

  function syncContent() {
    wins.forEach(function (w) {
      if (!w.bodyEl) return;
      w.bodyEl.classList.toggle("is-empty", !w.bodyEl.firstElementChild);
    });
    fitAutoHeights();
    renderDock();
    if (onChange) onChange();
  }

  function bodyOf(id) {
    var w = byId[id];
    return w ? w.bodyEl : null;
  }

  return {
    mount: mount,
    destroy: destroy,
    reset: reset,
    isCompact: isCompact,
    syncContent: syncContent,
    bodyOf: bodyOf
  };
}

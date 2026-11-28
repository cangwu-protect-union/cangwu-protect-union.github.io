/* 回合制正传 6.0 · 联机对局舞台
   直接按窗口生成内容，不再解析旧网格片段；只在 P.remote 且对局中启用。
   组件自身不保存游戏状态，所有展示数据都来自 render(state, meta, pick, hint, opts)。 */

import { createWindowManager } from "./battle-windows.js";
import { createScene3d } from "./scene3d.js";

const root = globalThis;
const SIDE_INDEX = { a: 0, b: 1 };

function create() {
  let manager = null;
  let scene = null;
  let liveRoot = null;
  let winRoot = null;
  let dockRoot = null;
  let stageEl = null;
  let observer = null;
  let resetBtn = null;
  let cancelBtn = null;
  let roomNode = null;
  let roomObserver = null;
  let mountedFlag = false;
  let cardEl = null;
  let cardUid = "";
  let cardPicking = false;

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

  /* ---------------- 底栏：取消选择与状态圆点 ---------------- */

  function onPickCancel(event) {
    event.stopPropagation();
    var P = page();
    if (!P) return;
    if (root.BattlePick) root.BattlePick.cancel(P.pick);
    if (P.setHint) P.setHint("已取消选择");
    else P.hint = "已取消选择";
    if (P.render) P.render();
  }

  function addCancelButton() {
    var bar = barEl();
    if (!bar) return;
    var status = bar.querySelector("[data-room-status]");
    if (!status) return;
    var old = bar.querySelector("[data-pick-cancel]");
    if (old && old.parentNode) old.parentNode.removeChild(old);
    cancelBtn = root.document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn-ghost";
    cancelBtn.setAttribute("data-pick-cancel", "");
    cancelBtn.textContent = "取消选择";
    cancelBtn.hidden = true;
    cancelBtn.addEventListener("click", onPickCancel);
    bar.insertBefore(cancelBtn, status);
  }

  function toneOf(text) {
    var t = (text || "").replace(/\s+/g, " ").trim();
    if (!t) return "";
    /* 先认固定前缀：对手昵称可能带「失败」「轮到你」，不能拿整句正则去猜 */
    if (/^等\s/.test(t) || /^等待对手加入/.test(t)) return "wait";
    if (/^轮到你/.test(t)) return "you";
    if (/^提交中|^已进入房间/.test(t)) return "busy";
    if (/^房间已结束|^房间已关闭/.test(t)) return "end";
    if (/不一致|不连续|同步中断|提交失败|对手离线|失败|错误|无法进入|已下架|请刷新|没有这个房间/.test(t)) return "bad";
    return "";
  }

  /* halt 只改状态文本、不触发 render；这里跟着状态变化同步认输按钮 */
  function refreshTone() {
    if (!roomNode) return;
    var tone = roomNode.hidden ? "" : toneOf(roomNode.textContent);
    if (tone) roomNode.setAttribute("data-tone", tone);
    else roomNode.removeAttribute("data-tone");
    var P = page();
    if (P && P.remote && P.dom && P.dom.restart) P.dom.restart.disabled = !P.remote.canAct();
  }

  function addRoomObserver() {
    var bar = barEl();
    roomNode = bar ? bar.querySelector("[data-room-status]") : null;
    if (!roomNode) return;
    roomObserver = new MutationObserver(refreshTone);
    roomObserver.observe(roomNode, { childList: true, characterData: true, subtree: true });
    refreshTone();
  }

  function syncBar(pick) {
    var P = page();
    if (!P) return;
    refreshTone();
    var active = !!(root.BattlePick && root.BattlePick.isActive(pick));
    if (cancelBtn) cancelBtn.hidden = !active;
    if (!active) return;
    var hintEl = (P.dom && P.dom.hintEl) || (barEl() && barEl().querySelector("[data-hint]"));
    if (hintEl) hintEl.textContent = (P.hint || "") + " · Esc 取消";
  }

  function scrollLogToEnd() {
    if (!manager) return;
    var body = manager.bodyOf("battle-log");
    if (!body || !body.clientHeight) return;
    body.scrollTop = body.scrollHeight;
  }

  /* ---------------- 召唤物详情卡 ---------------- */

  function view() {
    return root.RPG6BattleView || null;
  }

  function esc(text) {
    var V = view();
    if (V && V.esc) return V.esc(text);
    return String(text == null ? "" : text);
  }

  function closeSummonCard() {
    if (cardEl && cardEl.parentNode) cardEl.parentNode.removeChild(cardEl);
    cardEl = null;
    cardUid = "";
    cardPicking = false;
  }

  function canPickSummon(detail, pick, readOnly) {
    var BP = root.BattlePick;
    if (readOnly) return false;
    if (!BP || !BP.isActive(pick)) return false;
    if (!detail || !detail.targetable) return false;
    if (pick.mode !== "basic" && pick.mode !== "skill") return false;
    return BP.allows(pick, cardUid);
  }

  function cardHtml(detail, pick, readOnly) {
    var hp = "—";
    (detail.stats || []).forEach(function (item) {
      if (item.label === "血量") hp = item.text;
    });
    var rows = [
      ["所有者", detail.ownerName || "—"],
      ["血量", detail.targetable ? hp : "不参与受击"],
      ["剩余回合", detail.remain == null ? "不限" : detail.remain + " 标准回合"]
    ];
    var interval = "不自动攻击";
    if (detail.hasAttack && detail.spd > 0) {
      interval = "每 " + Math.ceil(detail.gaugeMax / detail.spd) + " 标准回合自动攻击一次";
    }
    rows.push(["速度", detail.spd + " · " + interval]);
    if (detail.actions && detail.actions.length) {
      rows.push(["光环 / 行为", detail.actions.map(function (row) {
        return row.label + "：" + row.text;
      }).join("；")]);
    }
    var html = '<div class="lw-sc-name">' + esc(detail.name) + '</div><dl class="lw-sc-rows">';
    rows.forEach(function (row) {
      html += "<div><dt>" + esc(row[0]) + "</dt><dd>" + esc(row[1]) + "</dd></div>";
    });
    html += "</dl>";
    html += '<div class="lw-sc-btns">';
    if (canPickSummon(detail, pick, readOnly)) {
      html += '<button type="button" class="btn lw-sc-pick" data-sc-pick>选为目标</button>';
    }
    html += '<button type="button" class="btn btn-ghost" data-sc-close>关闭</button></div>';
    return html;
  }

  /* 打开时按热区位置放上方；放不下放下方；最后夹进 live 区域 */
  function positionCard(hit) {
    if (!cardEl || !liveRoot) return;
    var host = liveRoot.getBoundingClientRect();
    var cw = cardEl.offsetWidth;
    var ch = cardEl.offsetHeight;
    var left = (host.width - cw) / 2;
    var top = 8;
    if (hit) {
      var rect = hit.getBoundingClientRect();
      left = rect.left + rect.width / 2 - host.left - cw / 2;
      top = rect.top - host.top - ch - 8;
      if (top < 4) top = rect.bottom - host.top + 8;
    }
    left = Math.max(4, Math.min(left, host.width - cw - 4));
    top = Math.max(4, Math.min(top, host.height - ch - 4));
    cardEl.style.left = Math.round(left) + "px";
    cardEl.style.top = Math.round(top) + "px";
  }

  function openSummonCard(uid) {
    var P = page();
    var V = view();
    if (!P || !P.state || !V || !V.summonDetail) return;
    var detail = V.summonDetail(P.state, uid);
    if (!detail) return;
    closeSummonCard();
    cardUid = uid;
    cardPicking = !!(root.BattlePick && root.BattlePick.isActive(P.pick));
    cardEl = root.document.createElement("div");
    cardEl.className = "lw-summon-card";
    cardEl.setAttribute("data-summon-card", "");
    cardEl.innerHTML = cardHtml(detail, P.pick, !!(P.remote && P.remote.canAct && !P.remote.canAct()));
    liveRoot.appendChild(cardEl);
    positionCard(liveRoot.querySelector('.scene-hit[data-summon="' + uid + '"]'));
  }

  function refreshSummonCard(state, pick, readOnly) {
    if (!cardEl) return;
    var BP = root.BattlePick;
    if (cardPicking && !(BP && BP.isActive(pick))) {
      closeSummonCard();
      return;
    }
    var B = root.RPG6B;
    var unit = null;
    try {
      unit = B && B.state && B.state.unitOf ? B.state.unitOf(state, cardUid) : null;
    } catch (err) {
      unit = null;
    }
    if (!unit || !unit.isSummon || (unit.targetable && unit.hp <= 0) || (cardPicking && !unit.targetable)) {
      closeSummonCard();
      return;
    }
    var V = view();
    var detail = V && V.summonDetail ? V.summonDetail(state, cardUid) : null;
    if (!detail) {
      closeSummonCard();
      return;
    }
    var html = cardHtml(detail, pick, readOnly);
    if (cardEl.innerHTML !== html) {
      cardEl.innerHTML = html;
      positionCard(liveRoot.querySelector('.scene-hit[data-summon="' + cardUid + '"]'));
    }
  }

  function onLiveKeydown(event) {
    if (event.key !== "Escape") return;
    if (cardEl) closeSummonCard();
  }

  /* 拦截召唤物热区（阻止旧 onSummonClick 直接出手）；角色热区放行给舞台委托 */
  /* 战报窗默认折叠；折叠时 scrollHeight 为 0，展开后补一次滚到最新 */
  function onLiveClick(event) {
    var target = event.target;
    /* 角色卡里的 Buff/持续效果/状态 chip：触摸端没有 hover，点了直接弹气泡 */
    var detail = target.closest ? target.closest("[data-detail]") : null;
    if (detail) {
      var P = page();
      if (P && P.showBuffPop) P.showBuffPop(detail);
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    var card = target.closest ? target.closest("[data-summon-card]") : null;
    if (card) {
      event.stopPropagation();
      if (target.closest("[data-sc-close]")) {
        closeSummonCard();
        return;
      }
      if (target.closest("[data-sc-pick]")) {
        var uid = cardUid;
        closeSummonCard();
        var P = page();
        if (P && P.onSummonClick && uid) P.onSummonClick(uid, null);
      }
      return;
    }
    var summonHit = target.closest ? target.closest(".scene-hit[data-summon]") : null;
    if (summonHit) {
      event.preventDefault();
      event.stopPropagation();
      openSummonCard(summonHit.getAttribute("data-summon"));
      return;
    }
    var unitHit = target.closest ? target.closest(".scene-hit[data-unit]") : null;
    if (unitHit) {
      if (cardEl) closeSummonCard();
      return;
    }
    var chip = target.closest ? target.closest("[data-fold], [data-dock-win]") : null;
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
    if (liveRoot.querySelector("[data-scene]")) scene = createScene3d(liveRoot);
    addResetButton();
    addCancelButton();
    addRoomObserver();
    liveRoot.addEventListener("click", onLiveClick);
    root.document.addEventListener("keydown", onLiveKeydown);

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
    setBody("role-detail", BV.renderRoleDetail(state, sideKey, meta));
    setBody("hp-record", BV.renderHpRecord(state, sideKey));
    setBody("battle-log", BV.renderLogWindow(state));

    liveRoot.classList.toggle("is-picking", !!(root.BattlePick && root.BattlePick.isActive(pick)));
    restoreOpenSkills();

    if (scene) scene.update(state, { side: sideKey, pick: pick, readOnly: readOnly });

    if (manager) manager.syncContent();
    refreshSummonCard(state, pick, readOnly);
  }

  function unmount() {
    if (!mountedFlag) return;
    closeSummonCard();
    root.document.removeEventListener("keydown", onLiveKeydown);
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (manager) {
      manager.destroy();
      manager = null;
    }
    if (scene) {
      scene.destroy();
      scene = null;
    }
    if (resetBtn) {
      resetBtn.removeEventListener("click", onReset);
      if (resetBtn.parentNode) resetBtn.parentNode.removeChild(resetBtn);
      resetBtn = null;
    }
    if (cancelBtn) {
      cancelBtn.removeEventListener("click", onPickCancel);
      if (cancelBtn.parentNode) cancelBtn.parentNode.removeChild(cancelBtn);
      cancelBtn = null;
    }
    if (roomObserver) {
      roomObserver.disconnect();
      roomObserver = null;
    }
    if (roomNode) {
      roomNode.removeAttribute("data-tone");
      roomNode = null;
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
    syncBar: syncBar,
    unmount: unmount,
    mounted: mounted
  };
}

root.RPG6LiveStage = { create: create };

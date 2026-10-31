/* ============================================================
   pick-tips.js —— 引用情报（勾选界面）
   ------------------------------------------------------------
   和「查看情报」长得差不多，区别是：
     · 每一条右侧有小方格，可以勾选 / 取消
     · 底部有一条固定的操作栏（不随页面滚动）
     · 一条都没勾时，「确定」是灰色不可点的
   确认后把选中的情报写进 sessionStorage，由增加条目页读取并合并。
   ============================================================ */
(function () {
  "use strict";

  var listEl   = document.getElementById("pickList");
  var emptyEl  = document.getElementById("pickEmpty");
  var countEl  = document.getElementById("pickCount");
  var inputEl  = document.getElementById("pickSearch");
  var backLink = document.getElementById("backLink");
  var barCount = document.getElementById("pickBarCount");
  var okBtn    = document.getElementById("pickConfirm");
  var cancelBtn = document.getElementById("pickCancel");

  var PICK_KEY = "gui_picked_tips";

  /* 确认后回到哪一页（由调用方通过 ?back= 指定） */
  var params = new URLSearchParams(location.search);
  var backUrl = params.get("back") || "add-gui.html";
  backLink.href = backUrl;

  var allTips = [];
  var selected = {};   /* id → true */

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function selectedCount() {
    return Object.keys(selected).filter(function (k) { return selected[k]; }).length;
  }

  /* 底部栏：按钮状态 + 已选数量 */
  function syncBar() {
    var n = selectedCount();
    okBtn.disabled = (n === 0);
    barCount.textContent = n === 0 ? "未选择" : "已选 " + n + " 条";
  }

  function itemHtml(t) {
    var tags = (t.tags || []).slice(0, 3).map(function (x) {
      return "<li>" + esc(x) + "</li>";
    }).join("");
    var imgCount = window.guiImagesFor(t).length;
    var isOn = !!selected[t.id];

    return "" +
      '<div class="pick-item' + (isOn ? " is-on" : "") + '" data-id="' + esc(t.id) + '">' +
        '<div class="pick-item-img">' +
          '<img src="' + esc(window.guiThumbFor(t)) + '" alt="" loading="lazy">' +
        "</div>" +
        '<div class="pick-item-body">' +
          '<h3 class="pick-item-title">' + esc(t.title) + "</h3>" +
          '<p class="pick-item-intro">' + esc(t.intro || "") + "</p>" +
          '<p class="pick-item-meta">' +
            (imgCount ? imgCount + " 张图" : "无图") +
            ((t.tags || []).length ? " · " + esc((t.tags || []).join("、")) : "") +
          "</p>" +
        "</div>" +
        '<div class="pick-item-check">' +
          '<span class="pick-box' + (isOn ? " is-on" : "") + '" role="checkbox" ' +
                'aria-checked="' + (isOn ? "true" : "false") + '" aria-label="勾选此情报">✓</span>' +
        "</div>" +
      "</div>";
  }

  function render(keyword) {
    var kw = (keyword || "").trim().toLowerCase();
    var shown = allTips.filter(function (t) {
      if (!kw) return true;
      return String(t.title || "").toLowerCase().indexOf(kw) !== -1;
    });

    listEl.innerHTML = shown.map(itemHtml).join("");
    emptyEl.hidden = shown.length !== 0;

    if (allTips.length === 0) countEl.textContent = "还没有任何情报可以引用。";
    else if (kw) countEl.textContent = "匹配到 " + shown.length + " 条（共 " + allTips.length + " 条）";
    else countEl.textContent = "共 " + allTips.length + " 条情报";

    syncBar();
  }

  /* 点整行都能勾选，不必非得点到小方格 */
  listEl.addEventListener("click", function (ev) {
    var row = ev.target.closest ? ev.target.closest(".pick-item") : null;
    if (!row) return;
    var id = row.getAttribute("data-id");
    if (!id) return;

    selected[id] = !selected[id];
    render(inputEl.value);
  });

  inputEl.addEventListener("input", function () { render(inputEl.value); });

  /* ---------- 取消：什么都不写，直接回去 ---------- */
  cancelBtn.addEventListener("click", function () {
    try { sessionStorage.removeItem(PICK_KEY); } catch (e) {}
    location.href = backUrl;
  });

  /* ---------- 确定：把选中的情报交给增加条目页 ---------- */
  okBtn.addEventListener("click", function () {
    var picked = allTips.filter(function (t) { return selected[t.id]; });
    if (!picked.length) return;

    try {
      sessionStorage.setItem(PICK_KEY, JSON.stringify(picked));
    } catch (e) {
      alert("浏览器不让保存选择结果，请重试。");
      return;
    }
    location.href = backUrl;
  });

  window.GuiData.listTips().then(function (tips) {
    allTips = tips;
    render(inputEl.value);
  }).catch(function (err) {
    countEl.textContent = "载入失败：" + err.message;
  });
})();
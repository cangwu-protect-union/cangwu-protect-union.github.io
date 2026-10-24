/* ============================================================
   tips.js —— 查看情报（列表）
   ------------------------------------------------------------
   数据来自独立的 gui_tips 表，与图鉴完全隔离。
   地址上的 ?from= 决定“返回”按钮跳回哪里：
     from=provide → 提供情报页
     from=edit    → 编辑图鉴
     其他         → 项目页
   ============================================================ */
(function () {
  "use strict";

  var listEl  = document.getElementById("tipList");
  var emptyEl = document.getElementById("tipEmpty");
  var countEl = document.getElementById("tipCount");
  var inputEl = document.getElementById("tipSearch");
  var backLink = document.getElementById("backLink");

  var allTips = [];

  /* 返回目标由来源决定 */
  var from = new URLSearchParams(location.search).get("from");
  var backMap = {
    provide: { href: "provide-tip.html", text: "← 返回提供情报" },
    edit:    { href: "edit-gui.html",    text: "← 返回编辑图鉴" }
  };
  var back = backMap[from] || { href: "projects.html", text: "← 返回项目" };
  backLink.href = back.href;
  backLink.textContent = back.text;

  /* 从「提供情报」点进来的话，这一页就不要再显示「提供情报」按钮了——
     否则点回去会把正在填的内容冲掉。 */
  var actionsEl = document.getElementById("tipsActions");
  if (actionsEl && from === "provide") actionsEl.hidden = true;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function cardHtml(t) {
    var tags = (t.tags || []).slice(0, 4).map(function (x) {
      return "<li>" + esc(x) + "</li>";
    }).join("");
    var href = "tips-entry.html?id=" + encodeURIComponent(t.id) + (from ? "&from=" + encodeURIComponent(from) : "");
    var imgCount = window.guiImagesFor(t).length;
    var multi = imgCount > 1 ? '<span class="gui-card-multi">' + imgCount + " 图</span>" : "";

    return "" +
      '<a class="gui-card" href="' + href + '">' +
        '<div class="gui-card-img"><img src="' + esc(window.guiThumbFor(t)) + '" alt="" loading="lazy">' + multi + "</div>" +
        '<div class="gui-card-body">' +
          '<h3 class="gui-card-title">' + esc(t.title) + "</h3>" +
          '<p class="gui-card-intro">' + esc(t.intro) + "</p>" +
          (tags ? '<ul class="tags">' + tags + "</ul>" : "") +
        "</div>" +
        '<div class="gui-card-go" aria-hidden="true">›</div>' +
      "</a>";
  }

  function render(keyword) {
    var kw = (keyword || "").trim().toLowerCase();
    var shown = allTips.filter(function (t) {
      if (!kw) return true;
      return String(t.title || "").toLowerCase().indexOf(kw) !== -1;
    });

    listEl.innerHTML = shown.map(cardHtml).join("");
    emptyEl.hidden = shown.length !== 0;

    if (allTips.length === 0) countEl.textContent = "还没有任何情报。";
    else if (kw) countEl.textContent = "匹配到 " + shown.length + " 条（共 " + allTips.length + " 条）";
    else countEl.textContent = "共 " + allTips.length + " 条情报";
  }

  window.GuiData.listTips().then(function (tips) {
    allTips = tips;
    render(inputEl.value);
  }).catch(function (err) {
    countEl.textContent = "载入失败：" + err.message;
  });

  inputEl.addEventListener("input", function () { render(inputEl.value); });
})();
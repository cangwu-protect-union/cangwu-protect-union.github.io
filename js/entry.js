/* ============================================================
   entry.js —— 条目详情页逻辑：按 ?id=... 找到并渲染该条目
   ============================================================ */
(function () {
  "use strict";

  var root = document.getElementById("entryRoot");

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function notFound() {
    document.title = "条目不存在 · 鬼图鉴 · CPU";
    root.innerHTML =
      "<h1>条目不存在</h1>" +
      '<p class="lead">这个条目可能已被移除，或者链接里的编号不正确。</p>' +
      '<p><a class="btn" href="guitu.html">返回图鉴</a></p>';
  }

  var id = new URLSearchParams(location.search).get("id");

  window.GuiData.list().then(function (entries) {
    var entry = entries.filter(function (e) { return e.id === id; })[0];
    if (!entry) { notFound(); return; }

    document.title = entry.title + " · 鬼图鉴 · CPU";

    var paras = String(entry.body || "").split(/\n+/).filter(function (p) {
      return p.trim() !== "";
    }).map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("");

    var tags = (entry.tags || []).map(function (t) {
      return "<li>" + esc(t) + "</li>";
    }).join("");

    root.innerHTML =
      '<h1 class="entry-title">' + esc(entry.title) + "</h1>" +
      (entry.date ? '<p class="entry-date muted">记录日期：' + esc(entry.date) + "</p>" : "") +
      '<div class="entry-hero"><img src="' + esc(window.guiImageFor(entry)) + '" alt=""></div>' +
      '<div class="entry-body">' + paras + "</div>" +
      (tags ? '<ul class="tags entry-tags">' + tags + "</ul>" : "") +
      '<p class="entry-foot"><a class="btn btn-ghost" href="guitu.html">← 返回图鉴</a></p>';
  }).catch(function () { notFound(); });
})();
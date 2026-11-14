/* ============================================================
   rule.js —— 单条规则
   ------------------------------------------------------------
   正文是 data/rule-docs.js 里手写的 HTML，只读渲染。
   id 不存在或缺失时给提示，并留一条回规则列表的链接。
   ============================================================ */
(function () {
  "use strict";

  var rootEl = document.getElementById("ruleRoot");
  var id = new URLSearchParams(location.search).get("id");

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function fail(text) {
    document.title = text + " · 游戏规则 · CPU";
    rootEl.innerHTML = '<h1 class="entry-title">' + esc(text) + "</h1>" +
      '<p class="lead">这条规则不存在。可以回到<a href="rules.html">规则列表</a>再看。</p>';
  }

  if (!id) {
    fail("没有指定规则");
    return;
  }

  var item = (window.RPG_RULES || []).filter(function (r) {
    return r && r.id === id;
  })[0];

  if (!item) {
    fail("没有找到这条规则");
    return;
  }

  document.title = item.title + " · 游戏规则 · CPU";
  rootEl.innerHTML = '<h1 class="entry-title">' + esc(item.title) + "</h1>" +
    '<div class="rule-body">' + String(item.html || "") + "</div>";
})();

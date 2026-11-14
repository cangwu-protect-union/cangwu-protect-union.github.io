/* ============================================================
   rules.js —— 规则列表
   ------------------------------------------------------------
   只读 data/rule-docs.js，不碰数据库。条目顺序与文件里一致。
   ============================================================ */
(function () {
  "use strict";

  var listEl = document.getElementById("ruleList");
  var emptyEl = document.getElementById("ruleEmpty");

  var items = (window.RPG_RULES || []).filter(function (r) {
    return r && String(r.id || "").trim();
  });

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  if (!items.length) {
    listEl.innerHTML = "";
    if (emptyEl) emptyEl.hidden = false;
    return;
  }

  listEl.innerHTML = items.map(function (r) {
    return '<a class="rpg-row" href="rule.html?id=' + encodeURIComponent(r.id) + '">' +
             '<span class="rpg-row-main"><span class="rpg-name">' + esc(r.title) + "</span></span>" +
           "</a>";
  }).join("");
})();

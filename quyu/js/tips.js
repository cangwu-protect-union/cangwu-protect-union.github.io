/* ============================================================
   tips.js —— 投稿列表
   ------------------------------------------------------------
   读 gui_zone_tips（公开可读）。云端不可用时给出空列表 + 提示，
   不拿种子数据冒充投稿。
   ============================================================ */
(function () {
  "use strict";

  var listEl = document.getElementById("tipList");
  var emptyEl = document.getElementById("tipEmpty");
  var countEl = document.getElementById("tipCount");

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function cardHtml(t) {
    var badge = t.adopted
      ? '<span class="zone-badge zone-status" data-status="已清除">已采纳</span>'
      : '<span class="zone-badge">待核实</span>';

    var link = t.adopted && t.adopted_zone_id
      ? 'zone.html?id=' + encodeURIComponent(t.adopted_zone_id)
      : 'tips-entry.html?id=' + encodeURIComponent(t.id);

    var img = (t.thumbs && t.thumbs[0]) || (t.images && t.images[0]) || "";

    return "" +
      '<a class="gui-card" href="' + link + '">' +
        (img ? '<div class="gui-card-img"><img src="' + esc(img) + '" alt="" loading="lazy"></div>' : "") +
        '<div class="gui-card-body">' +
          '<h3 class="gui-card-title">' + esc(t.title) + "</h3>" +
          '<p class="gui-card-intro">' + esc(t.intro) + "</p>" +
          '<p class="zone-badges">' + badge +
            (t.date ? '<span class="muted">' + esc(t.date) + "</span>" : "") +
          "</p>" +
        "</div>" +
        '<div class="gui-card-go" aria-hidden="true">›</div>' +
      "</a>";
  }

  window.ZoneData.listTips().then(function (tips) {
    listEl.innerHTML = tips.map(cardHtml).join("");
    emptyEl.hidden = tips.length !== 0;
    countEl.textContent = tips.length
      ? "共 " + tips.length + " 条投稿，其中 " + tips.filter(function (t) { return t.adopted; }).length + " 条已采纳"
      : "暂无投稿";
  }).catch(function (err) {
    countEl.textContent = (err.message || "读取投稿失败，请稍后重试");
    emptyEl.hidden = false;
  });
})();

/* ============================================================
   edit-zones.js —— 编辑区入口：全部区域（含已删除）
   ------------------------------------------------------------
   先过组织验证（GuiGate.require），本会话验过一次就不再问。
   ============================================================ */
(function () {
  "use strict";

  var gateSection = document.getElementById("gateSection");
  var listSection = document.getElementById("listSection");
  var countEl = document.getElementById("editCount");
  var listEl = document.getElementById("editList");

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function badges(z) {
    var out = "";
    if (z.level) out += '<span class="zone-badge zone-level" data-level="' + esc(z.level) + '">' + esc(z.level) + "</span>";
    if (z.status) out += '<span class="zone-badge zone-status" data-status="' + esc(z.status) + '">' + esc(z.status) + "</span>";
    if (z.deleted) out += '<span class="zone-badge zone-status" data-status="已清除">已删除</span>';
    return out;
  }

  function rowHtml(z) {
    return "" +
      '<div class="gui-card">' +
        '<div class="gui-card-body">' +
          '<h3 class="gui-card-title">' + esc(z.title) +
            (z.deleted ? ' <span class="muted">（已删除）</span>' : "") + "</h3>" +
          '<p class="zone-where">' + esc(z.region || "未填地区") +
            ' · <span class="muted">' + esc(z.id) + "</span></p>" +
          '<p class="zone-badges">' + badges(z) + "</p>" +
        "</div>" +
        '<div class="gui-card-go">' +
          '<a class="btn btn-ghost" href="edit-zone.html?id=' + encodeURIComponent(z.id) + '">编辑</a> ' +
          '<a class="btn btn-ghost" href="zone.html?id=' + encodeURIComponent(z.id) + '">查看</a>' +
        "</div>" +
      "</div>";
  }

  function showList() {
    gateSection.hidden = true;
    listSection.hidden = false;

    window.ZoneData.listAll().then(function (zones) {
      if (!zones.length) {
        countEl.textContent = "还没有区域。点上面的「增加区域」开始。";
        listEl.innerHTML = "";
        return;
      }
      var alive = zones.filter(function (z) { return !z.deleted; }).length;
      countEl.textContent = "共 " + zones.length + " 个区域（" + alive + " 个未删除）";
      listEl.innerHTML = zones.map(rowHtml).join("");
    }).catch(function (err) {
      countEl.textContent = "载入失败：" + (err.message || "请刷新重试");
    });
  }

  window.GuiGate.require(document.getElementById("gateMount"), {
    cancelHref: "quyu.html",
    failHref: "quyu.html",
    onPass: showList
  });
})();

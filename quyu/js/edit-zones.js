/* ============================================================
   edit-zones.js —— 编辑区入口：全部区域（含已删除）
   ------------------------------------------------------------
   先过组织验证（GuiGate.require），本会话验过一次就不再问。
   等级与地区字段已删除，这一页只显示标题与时间。
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

  function when(z) {
    var t = z.updated_at || z.created_at || "";
    return t ? String(t).replace("T", " ").slice(0, 16) : "";
  }

  function rowHtml(z) {
    return "" +
      '<div class="gui-card">' +
        '<div class="gui-card-body">' +
          '<h3 class="gui-card-title">' + esc(z.title) +
            (z.deleted ? ' <span class="muted">（已删除）</span>' : "") + "</h3>" +
          '<p class="zone-where muted">' + esc(when(z)) +
            (typeof z.lng === "number" ? "" : " · 未标点") + "</p>" +
        "</div>" +
        '<div class="gui-card-go">' +
          '<a class="btn btn-ghost" href="edit-zone.html?id=' + encodeURIComponent(z.id) + '">编辑</a> ' +
          '<a class="btn btn-ghost" href="zone.html?id=' + encodeURIComponent(z.id) + '">查看</a>' +
        "</div>" +
      "</div>";
  }

  window.GuiGate.require(document.getElementById("gateMount"), {
    cancelHref: "quyu.html",
    failHref: "quyu.html",
    onPass: function () {
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
  });
})();

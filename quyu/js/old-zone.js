/* ============================================================
   old-zone.js —— 某个区域的全部历史版本
   ============================================================ */
(function () {
  "use strict";

  var gateSection = document.getElementById("gateSection");
  var oldSection = document.getElementById("oldSection");
  var countEl = document.getElementById("oldCount");
  var listEl = document.getElementById("oldList");
  var emptyEl = document.getElementById("oldEmpty");
  var oldTitle = document.getElementById("oldTitle");
  var oldSub = document.getElementById("oldSub");
  var editLink = document.getElementById("editLink");

  var zoneId = new URLSearchParams(location.search).get("id");

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function when(v) {
    var t = v.archived_at || "";
    return t ? String(t).replace("T", " ").slice(0, 16) : "";
  }

  function cardHtml(v) {
    return "" +
      '<div class="gui-card">' +
        '<div class="gui-card-body">' +
          '<h3 class="gui-card-title">' + esc(v.title || "（无标题）") + "</h3>" +

          '<p class="zone-badges">' +
            '<span class="zone-badge">' + (v.reason === "delete" ? "删除前存档" : "编辑前存档") + "</span>" +
            (v.applied ? '<span class="zone-badge zone-status" data-status="已清除">已应用</span>' : "") +
            '<span class="muted">' + esc(when(v)) + "</span>" +
          "</p>" +
        "</div>" +
        '<div class="gui-card-go">' +
          '<a class="btn btn-ghost" href="version.html?v=' + encodeURIComponent(v.version_id) + '">查看</a>' +
        "</div>" +
      "</div>";
  }

  function show() {
    gateSection.hidden = true;
    oldSection.hidden = false;

    if (!zoneId) {
      oldTitle.textContent = "缺少区域编号";
      countEl.textContent = "链接里没有带 ?id=。";
      return;
    }

    editLink.href = "edit-zone.html?id=" + encodeURIComponent(zoneId);
    oldSub.textContent = "";

    window.ZoneData.listVersionsForZone(zoneId).then(function (versions) {
      listEl.innerHTML = versions.map(cardHtml).join("");
      emptyEl.hidden = versions.length !== 0;
      countEl.textContent = versions.length
        ? "共 " + versions.length + " 个历史版本"
        : "这个区域还没有历史版本。";
    }).catch(function (err) {
      countEl.textContent = "载入失败：" + (err.message || "请刷新重试");
    });
  }

  window.GuiGate.require(document.getElementById("gateMount"), {
    cancelHref: "old-zones.html",
    failHref: "edit-zones.html",
    onPass: show
  });
})();

/* ============================================================
   old-zones.js —— 旧档案：所有区域的历史版本
   ------------------------------------------------------------
   只列 applied = false 的版本（已经应用回去的不再重复出现）。
   卡片结构与公开列表一致，右边一个「查看」。
   ============================================================ */
(function () {
  "use strict";

  var gateSection = document.getElementById("gateSection");
  var oldSection = document.getElementById("oldSection");
  var countEl = document.getElementById("oldCount");
  var listEl = document.getElementById("oldList");
  var emptyEl = document.getElementById("oldEmpty");

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function when(v) {
    var t = v.archived_at || "";
    return t ? String(t).replace("T", " ").slice(0, 16) : "";
  }

  function reasonText(r) {
    return r === "delete" ? "删除前存档" : "编辑前存档";
  }

  function cardHtml(v) {
    return "" +
      '<div class="gui-card">' +
        '<div class="gui-card-body">' +
          '<h3 class="gui-card-title">' + esc(v.title || "（无标题）") + "</h3>" +
          '<p class="zone-badges">' +
            '<span class="zone-badge">' + esc(reasonText(v.reason)) + "</span>" +
            '<span class="muted">' + esc(when(v)) + "</span>" +
          "</p>" +
        "</div>" +
        '<div class="gui-card-go">' +
          '<a class="btn btn-ghost" href="version.html?v=' + encodeURIComponent(v.version_id) + '">查看</a>' +
        "</div>" +
      "</div>";
  }

  window.GuiGate.require(document.getElementById("gateMount"), {
    cancelHref: "edit-zones.html",
    failHref: "edit-zones.html",
    onPass: function () {
      gateSection.hidden = true;
      oldSection.hidden = false;

      window.ZoneData.listVersions().then(function (versions) {
        listEl.innerHTML = versions.map(cardHtml).join("");
        emptyEl.hidden = versions.length !== 0;
        countEl.textContent = versions.length
          ? "共 " + versions.length + " 个历史版本"
          : "没有历史版本。";
      }).catch(function (err) {
        countEl.textContent = "载入失败：" + (err.message || "请刷新重试");
        emptyEl.hidden = false;
      });
    }
  });
})();

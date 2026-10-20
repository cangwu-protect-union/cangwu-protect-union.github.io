/* ============================================================
   edit-gui.js —— 编辑图鉴列表
   ------------------------------------------------------------
   流程：先过组织验证 → 显示条目列表（点条目进编辑）；
        右上角可以「增加条目」或「查看旧图鉴」。
   与公开的 guitu.html 区别：这里的条目可点击进入编辑界面，
   而且新增/旧图鉴入口只在这个页面出现。
   ============================================================ */
(function () {
  "use strict";

  var gateSection = document.getElementById("gateSection");
  var editSection = document.getElementById("editSection");
  var gateMount   = document.getElementById("gateMount");
  var listEl      = document.getElementById("guiList");
  var emptyEl     = document.getElementById("guiEmpty");
  var countEl     = document.getElementById("guiCount");
  var inputEl     = document.getElementById("guiSearch");

  var allEntries = [];

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* 一张可编辑的条目卡片，点击进编辑界面 */
  function cardHtml(e) {
    var tags = (e.tags || []).slice(0, 4).map(function (t) {
      return "<li>" + esc(t) + "</li>";
    }).join("");
    var imgCount = window.guiImagesFor(e).length;
    var multi = imgCount > 1 ? '<span class="gui-card-multi">' + imgCount + " 图</span>" : "";
    var href = "edit-entry.html?id=" + encodeURIComponent(e.id);

    return "" +
      '<a class="gui-card" href="' + href + '">' +
        '<div class="gui-card-img"><img src="' + esc(window.guiThumbFor(e)) + '" alt="" loading="lazy">' + multi + "</div>" +
        '<div class="gui-card-body">' +
          '<h3 class="gui-card-title">' + esc(e.title) + "</h3>" +
          '<p class="gui-card-intro">' + esc(e.intro) + "</p>" +
          (tags ? '<ul class="tags">' + tags + "</ul>" : "") +
        "</div>" +
        '<div class="gui-card-go" aria-hidden="true">›</div>' +
      "</a>";
  }

  function render(keyword) {
    var kw = (keyword || "").trim().toLowerCase();
    var shown = allEntries.filter(function (e) {
      if (!kw) return true;
      return String(e.title || "").toLowerCase().indexOf(kw) !== -1;
    });

    listEl.innerHTML = shown.map(cardHtml).join("");
    emptyEl.hidden = shown.length !== 0;

    if (!allEntries.length) {
      countEl.textContent = "还没有条目。";
    } else if (kw) {
      countEl.textContent = "匹配到 " + shown.length + " 条（共 " + allEntries.length + " 条）";
    } else {
      countEl.textContent = "共 " + allEntries.length + " 个条目";
    }
  }

  function loadEntries() {
    return window.GuiData.list().then(function (entries) {
      allEntries = entries;
      render(inputEl.value);
    });
  }

  /* 验证通过 → 显示列表 */
  window.GuiGate.mount(gateMount, {
    cancelHref: "projects.html",
    failHref: "projects.html",
    onPass: function () {
      gateSection.hidden = true;
      editSection.hidden = false;
      loadEntries();
    }
  });

  inputEl.addEventListener("input", function () { render(inputEl.value); });
})();
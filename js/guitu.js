/* ============================================================
   guitu.js —— 图鉴页逻辑：载入条目、搜索、渲染卡片
   ============================================================ */
(function () {
  "use strict";

  var listEl  = document.getElementById("guiList");
  var emptyEl = document.getElementById("guiEmpty");
  var countEl = document.getElementById("guiCount");
  var inputEl = document.getElementById("guiSearch");

  var allEntries = [];

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function cardHtml(e) {
    var tags = (e.tags || []).slice(0, 4).map(function (t) {
      return "<li>" + esc(t) + "</li>";
    }).join("");
    var href = "条目.html?id=" + encodeURIComponent(e.id);
    return "" +
      '<a class="gui-card" href="' + href + '">' +
        '<div class="gui-card-img"><img src="' + esc(e.image) + '" alt="" loading="lazy"></div>' +
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

    if (allEntries.length === 0) {
      countEl.textContent = "暂无条目。";
    } else if (kw) {
      countEl.textContent = "匹配到 " + shown.length + " 条（共 " + allEntries.length + " 条）";
    } else {
      countEl.textContent = "共 " + allEntries.length + " 个条目";
    }
  }

  function refresh() {
    return window.GuiData.list().then(function (entries) {
      allEntries = entries;
      render(inputEl.value);
    });
  }

  inputEl.addEventListener("input", function () { render(inputEl.value); });

  refresh();

  window.addEventListener("pageshow", function (ev) {
    if (ev.persisted) refresh();
  });
})();
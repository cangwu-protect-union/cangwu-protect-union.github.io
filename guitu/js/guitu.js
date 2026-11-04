/* ============================================================
   guitu.js —— 图鉴页逻辑：分页检索 + 渲染卡片
   ------------------------------------------------------------
   检索交给数据库（GuiData.search），浏览器只拿当前这一页。
   原先这里把整表拉下来再 filter，条目一多首屏就撑不住。
   ============================================================ */
(function () {
  "use strict";

  var listEl  = document.getElementById("guiList");
  var emptyEl = document.getElementById("guiEmpty");
  var countEl = document.getElementById("guiCount");
  var inputEl = document.getElementById("guiSearch");
  var pagerEl = document.getElementById("guiPager");

  var PAGE_SIZE = (window.GuiData && window.GuiData.PAGE_SIZE) || 12;
  var state = { q: "", page: 1, total: 0 };

  var seq = 0;              /* 请求序号：慢请求回来时若已有新请求就丢弃 */
  var debounceTimer = null;

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
    var imgCount = window.guiImagesFor(e).length;
    var multi = imgCount > 1 ? '<span class="gui-card-multi">' + imgCount + ' 图</span>' : "";
    return "" +
      '<a class="gui-card" href="' + href + '">' +
        '<div class="gui-card-img"><img src="' + esc(window.guiThumbFor(e)) + '" alt="" loading="lazy">' + multi + '</div>' +
        '<div class="gui-card-body">' +
          '<h3 class="gui-card-title">' + esc(e.title) + "</h3>" +
          '<p class="gui-card-intro">' + esc(e.intro) + "</p>" +
          (tags ? '<ul class="tags">' + tags + "</ul>" : "") +
        "</div>" +
        '<div class="gui-card-go" aria-hidden="true">›</div>' +
      "</a>";
  }

  function totalPages() {
    return Math.max(1, Math.ceil(state.total / PAGE_SIZE));
  }

  function renderPager() {
    if (!pagerEl) return;

    if (state.total <= PAGE_SIZE) {
      pagerEl.hidden = true;
      pagerEl.innerHTML = "";
      return;
    }

    var pages = totalPages();
    pagerEl.hidden = false;
    pagerEl.innerHTML =
      '<button type="button" class="btn btn-ghost" data-page="' + (state.page - 1) + '"' +
        (state.page <= 1 ? " disabled" : "") + '>上一页</button>' +
      '<span class="gui-pager-info">第 ' + state.page + " / " + pages + " 页</span>" +
      '<button type="button" class="btn btn-ghost" data-page="' + (state.page + 1) + '"' +
        (state.page >= pages ? " disabled" : "") + '>下一页</button>';
  }

  function render(result) {
    state.total = result.total || 0;

    var shown = result.items || [];
    listEl.innerHTML = shown.map(cardHtml).join("");
    emptyEl.hidden = shown.length !== 0;

    var kw = state.q.trim();
    if (!state.total) {
      countEl.textContent = kw ? "没有找到匹配「" + kw + "」的条目。" : "暂无条目。";
    } else if (kw) {
      countEl.textContent = "找到 " + state.total + " 个匹配「" + kw + "」的条目";
    } else {
      countEl.textContent = "共 " + state.total + " 个条目";
    }

    renderPager();
  }

  function load() {
    var my = ++seq;
    countEl.textContent = "正在载入…";

    window.GuiData.search({ q: state.q, page: state.page, pageSize: PAGE_SIZE })
      .then(function (result) {
        if (my !== seq) return;     /* 已经有更新的请求了 */
        render(result);
      })
      .catch(function () {
        if (my !== seq) return;
        listEl.innerHTML = "";
        emptyEl.hidden = false;
        countEl.textContent = "载入失败，请刷新重试。";
        if (pagerEl) pagerEl.hidden = true;
      });
  }

  inputEl.addEventListener("input", function () {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      state.q = inputEl.value;
      state.page = 1;               /* 换关键词回到第一页 */
      load();
    }, 250);
  });

  if (pagerEl) {
    pagerEl.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-page]");
      if (!btn || btn.disabled) return;

      var p = parseInt(btn.getAttribute("data-page"), 10);
      if (!(p >= 1) || p > totalPages() || p === state.page) return;

      state.page = p;
      load();
      if (listEl.scrollIntoView) listEl.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  load();

  /* 从详情页后退回来时浏览器可能走了缓存，重新拉一次当前页 */
  window.addEventListener("pageshow", function (ev) {
    if (ev.persisted) load();
  });
})();

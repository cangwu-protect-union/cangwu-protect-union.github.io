/* ============================================================
   zones.js —— 区域列表页：关键词 + 地区筛选 + 分页
   ------------------------------------------------------------
   检索交给数据库（ZoneData.search），浏览器只拿当前这一页。
   地区下拉的选项从数据库里取不重复值（ZoneData.listRegions）。
   ============================================================ */
(function () {
  "use strict";

  var listEl  = document.getElementById("zoneList");
  var emptyEl = document.getElementById("zoneEmpty");
  var countEl = document.getElementById("zoneCount");
  var inputEl = document.getElementById("zoneSearch");
  var regionEl = document.getElementById("zoneRegion");
  var pagerEl = document.getElementById("zonePager");

  var PAGE_SIZE = (window.ZoneData && window.ZoneData.PAGE_SIZE) || 12;
  var state = { q: "", region: "", page: 1, total: 0 };

  var seq = 0;
  var debounceTimer = null;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* 等级与状态的配色走 CSS 类，值本身来自 ZoneData 的枚举 */
  function badges(z) {
    var out = "";
    if (z.level) out += '<span class="zone-badge zone-level" data-level="' + esc(z.level) + '">' + esc(z.level) + " 级</span>";
    if (z.status) out += '<span class="zone-badge zone-status" data-status="' + esc(z.status) + '">' + esc(z.status) + "</span>";
    return out ? '<p class="zone-badges">' + out + "</p>" : "";
  }

  function cardHtml(z) {
    var tags = (z.tags || []).slice(0, 3).map(function (t) {
      return "<li>" + esc(t) + "</li>";
    }).join("");
    var href = "zone.html?id=" + encodeURIComponent(z.id);
    var imgCount = window.zoneImagesFor(z).length;
    var multi = imgCount > 1 ? '<span class="gui-card-multi">' + imgCount + " 图</span>" : "";
    var where = [z.region, z.terrain].filter(Boolean).join(" · ");
    return "" +
      '<a class="gui-card" href="' + href + '">' +
        '<div class="gui-card-img"><img src="' + esc(window.zoneThumbFor(z)) + '" alt="" loading="lazy">' + multi + "</div>" +
        '<div class="gui-card-body">' +
          '<h3 class="gui-card-title">' + esc(z.title) + "</h3>" +
          (where ? '<p class="zone-where">' + esc(where) + "</p>" : "") +
          '<p class="gui-card-intro">' + esc(z.intro) + "</p>" +
          badges(z) +
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
        (state.page <= 1 ? " disabled" : "") + ">上一页</button>" +
      '<span class="gui-pager-info">第 ' + state.page + " / " + pages + " 页</span>" +
      '<button type="button" class="btn btn-ghost" data-page="' + (state.page + 1) + '"' +
        (state.page >= pages ? " disabled" : "") + ">下一页</button>";
  }

  function render(result) {
    state.total = result.total || 0;

    var shown = result.items || [];
    listEl.innerHTML = shown.map(cardHtml).join("");
    emptyEl.hidden = shown.length !== 0;

    var kw = state.q.trim();
    var parts = [];
    if (state.region) parts.push("地区「" + state.region + "」");
    if (kw) parts.push("关键词「" + kw + "」");
    var cond = parts.join(" + ");

    if (!state.total) {
      countEl.textContent = cond ? "没有找到匹配 " + cond + " 的区域。" : "暂无区域。";
    } else if (cond) {
      countEl.textContent = "找到 " + state.total + " 个区域（" + cond + "）";
    } else {
      countEl.textContent = "共 " + state.total + " 个区域";
    }

    renderPager();
  }

  function load() {
    var my = ++seq;
    countEl.textContent = "正在载入…";

    window.ZoneData.search({ q: state.q, region: state.region, page: state.page, pageSize: PAGE_SIZE })
      .then(function (result) {
        if (my !== seq) return;
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

  /* 地区下拉：数据库里的不重复地区，加上「全部地区」 */
  function fillRegions() {
    if (!regionEl) return;
    window.ZoneData.listRegions().then(function (regions) {
      var html = '<option value="">全部地区</option>';
      regions.forEach(function (r) {
        html += '<option value="' + esc(r) + '">' + esc(r) + "</option>";
      });
      regionEl.innerHTML = html;
      regionEl.disabled = regions.length === 0;
    });
  }

  inputEl.addEventListener("input", function () {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      state.q = inputEl.value;
      state.page = 1;
      load();
    }, 250);
  });

  if (regionEl) {
    regionEl.addEventListener("change", function () {
      state.region = regionEl.value;
      state.page = 1;
      load();
    });
  }

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

  fillRegions();
  load();

  window.addEventListener("pageshow", function (ev) {
    if (ev.persisted) load();
  });
})();

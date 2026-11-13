/* ============================================================
   list.js —— 公开角色列表
   ------------------------------------------------------------
   检索、筛选、排序、分页全部交给数据库（RpgData.search），
   浏览器只渲染当前这一页。筛选状态写进 URL，刷新与后退可恢复。
   ============================================================ */
(function () {
  "use strict";

  var listEl = document.getElementById("rpgList");
  var emptyEl = document.getElementById("rpgEmpty");
  var countEl = document.getElementById("rpgCount");
  var noteEl = document.getElementById("rpgNote");
  var inputEl = document.getElementById("rpgSearch");
  var ratingEl = document.getElementById("rpgRating");
  var occEl = document.getElementById("rpgOcc");
  var orderEl = document.getElementById("rpgOrder");
  var resetEl = document.getElementById("rpgReset");
  var pagerEl = document.getElementById("rpgPager");

  var PAGE_SIZE = (window.RpgData && window.RpgData.PAGE_SIZE) || 12;

  var state = {
    q: "",
    rating: "",
    occ: "",
    order: "asc",
    page: 1,
    total: 0
  };

  var seq = 0;
  var debounceTimer = null;

  var MARK_CLASS = {
    "√": "mark-ok",
    "O": "mark-half",
    "X": "mark-bad",
    "？": "mark-unknown"
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function markHtml(mark) {
    var m = String(mark || "").trim();
    if (!m) return '<span class="rpg-mark is-empty" aria-hidden="true"></span>';
    return '<span class="rpg-mark ' + (MARK_CLASS[m] || "mark-unknown") + '">' + esc(m) + "</span>";
  }

  function aliasHtml(aliases) {
    var list = (aliases || []).filter(function (a) { return String(a).trim(); });
    if (!list.length) return "";
    return list.map(function (a) {
      return '<span class="rpg-alias">[' + esc(a) + "]</span>";
    }).join("");
  }

  function occHtml(item) {
    var occ = String(item.occupation || "").trim();
    var side = String(item.side_job || "").trim();
    if (!occ && !side) return "";
    return '<span class="rpg-occ">（' + esc(occ) + (side ? "/" + esc(side) : "") + "）</span>";
  }

  function rowHtml(item) {
    return '<a class="rpg-row" href="character.html?id=' + encodeURIComponent(item.id) + '">' +
             markHtml(item.review_mark) +
             '<span class="rpg-row-main">' +
               aliasHtml(item.aliases) +
               '<span class="rpg-name">' + esc(item.name) + "</span>" +
               occHtml(item) +
             "</span>" +
             (String(item.rating || "").trim()
               ? '<span class="rpg-rating">' + esc(item.rating) + "</span>"
               : '<span class="rpg-rating is-empty"></span>') +
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
      '<span class="gui-pager-info">第 ' + state.page + " / " + pages + " 页 · 共 " +
        state.total + " 位角色</span>" +
      '<button type="button" class="btn btn-ghost" data-page="' + (state.page + 1) + '"' +
        (state.page >= pages ? " disabled" : "") + ">下一页</button>";
  }

  function syncUrl() {
    var params = new URLSearchParams();
    if (state.q) params.set("q", state.q);
    if (state.rating) params.set("rating", state.rating);
    if (state.occ) params.set("occ", state.occ);
    if (state.order === "desc") params.set("order", "desc");
    if (state.page > 1) params.set("page", String(state.page));

    var qs = params.toString();
    var next = location.pathname + (qs ? "?" + qs : "") + location.hash;
    history.replaceState(null, "", next);
  }

  function render(result) {
    var items = result.items || [];
    state.total = result.total || 0;

    listEl.innerHTML = items.map(rowHtml).join("");
    emptyEl.hidden = items.length !== 0;

    if (!state.total) {
      countEl.textContent = state.q
        ? "没有找到匹配「" + state.q + "」的角色。"
        : "档案还是空的。";
    } else {
      countEl.textContent = "共 " + state.total + " 位角色";
    }

    if (noteEl) {
      noteEl.hidden = !result.fallback;
      noteEl.textContent = result.fallback ? "云端暂不可用，显示的是内置副本。" : "";
    }

    renderPager();
  }

  function load() {
    var my = ++seq;
    countEl.textContent = "正在载入…";

    window.RpgData.search({
      q: state.q,
      rating: state.rating,
      occ: state.occ,
      order: state.order,
      page: state.page,
      pageSize: PAGE_SIZE
    }).then(function (result) {
      if (my !== seq) return;

      var pages = Math.max(1, Math.ceil((result.total || 0) / PAGE_SIZE));
      if (state.page > pages) {
        state.page = pages;
        load();
        return;
      }
      render(result);
      syncUrl();
    }).catch(function (err) {
      if (my !== seq) return;
      listEl.innerHTML = "";
      emptyEl.hidden = true;
      countEl.textContent = "载入失败：" + err.message;
      if (pagerEl) pagerEl.hidden = true;
    });
  }

  /* ---------------- 筛选选项 ---------------- */

  function fillSelect(selectEl, values, allLabel) {
    var keep = selectEl.value;
    var html = '<option value="">' + esc(allLabel) + "</option>";
    values.forEach(function (v) {
      html += '<option value="' + esc(v) + '">' + esc(v) + "</option>";
    });
    selectEl.innerHTML = html;
    if (keep && values.indexOf(keep) !== -1) selectEl.value = keep;
  }

  window.RpgData.facets().then(function (facets) {
    fillSelect(ratingEl, facets.ratings || [], "全部评级");
    fillSelect(occEl, facets.occupations || [], "全部职业");
    if (state.rating) ratingEl.value = state.rating;
    if (state.occ) occEl.value = state.occ;
  });

  /* ---------------- 状态与事件 ---------------- */

  function readUrl() {
    var params = new URLSearchParams(location.search);
    state.q = params.get("q") || "";
    state.rating = params.get("rating") || "";
    state.occ = params.get("occ") || "";
    state.order = params.get("order") === "desc" ? "desc" : "asc";
    state.page = Math.max(1, parseInt(params.get("page"), 10) || 1);

    inputEl.value = state.q;
    orderEl.value = state.order;
  }

  inputEl.addEventListener("input", function () {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      state.q = inputEl.value.trim();
      state.page = 1;
      load();
    }, 300);
  });

  inputEl.addEventListener("keydown", function (ev) {
    if (ev.key !== "Enter") return;
    ev.preventDefault();
    if (debounceTimer) clearTimeout(debounceTimer);
    state.q = inputEl.value.trim();
    state.page = 1;
    load();
  });

  ratingEl.addEventListener("change", function () {
    state.rating = ratingEl.value;
    state.page = 1;
    load();
  });

  occEl.addEventListener("change", function () {
    state.occ = occEl.value;
    state.page = 1;
    load();
  });

  orderEl.addEventListener("change", function () {
    state.order = orderEl.value === "desc" ? "desc" : "asc";
    load();
  });

  resetEl.addEventListener("click", function () {
    state.q = "";
    state.rating = "";
    state.occ = "";
    state.order = "asc";
    state.page = 1;
    inputEl.value = "";
    ratingEl.value = "";
    occEl.value = "";
    orderEl.value = "asc";
    load();
  });

  if (pagerEl) {
    pagerEl.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-page]");
      if (!btn || btn.disabled) return;
      var page = parseInt(btn.getAttribute("data-page"), 10);
      if (!page || page === state.page) return;
      state.page = page;
      load();
    });
  }

  readUrl();
  load();
})();

/* ============================================================
   character.js —— 角色详情
   ------------------------------------------------------------
   只看不改。图片默认折叠在页面最底部（<details>），
   审核人与最近编辑各一行；旧档案没有时间就只显示审核人。
   底部按列表同样的筛选与排序翻上一个 / 下一个角色。
   ============================================================ */
(function () {
  "use strict";

  var rootEl = document.getElementById("charRoot");
  var backEl = document.querySelector(".entry-back a");

  var params = new URLSearchParams(location.search);
  var id = params.get("id");
  var filters = {
    q: params.get("q") || "",
    rating: params.get("rating") || "",
    occ: params.get("occ") || "",
    order: params.get("order") === "desc" ? "desc" : "asc"
  };
  var PAGE_SIZE = (window.RpgData && window.RpgData.PAGE_SIZE) || 12;
  var siblings = null;
  var rendered = false;

  var MARK_CLASS = {
    "√": "mark-ok",
    "O": "mark-half",
    "X": "mark-bad",
    "？": "mark-unknown"
  };

  var STAT_KEYS = ["atk", "def", "mres", "hp", "mp", "spd"];
  var STAT_LABELS = {
    atk: "攻击", def: "防御", mres: "法抗",
    hp: "血量", mp: "蓝上限", spd: "速度"
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 10);
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  function markHtml(mark) {
    var m = String(mark || "").trim();
    if (!m) return "";
    return '<span class="rpg-mark ' + (MARK_CLASS[m] || "mark-unknown") + '">' + esc(m) + "</span>";
  }

  function aliasHtml(aliases) {
    return (aliases || []).filter(function (a) { return String(a).trim(); })
      .map(function (a) { return '<span class="rpg-alias">[' + esc(a) + "]</span>"; })
      .join("");
  }

  function statsHtml(item) {
    return '<div class="char-stats">' + STAT_KEYS.map(function (k) {
      var v = String(item[k] == null ? "" : item[k]).trim();
      return '<div class="char-stat">' +
               '<span class="char-stat-label">' + STAT_LABELS[k] + "</span>" +
               '<span class="char-stat-value">' + esc(v || "—") + "</span>" +
             "</div>";
    }).join("") + "</div>";
  }

  function skillsHtml(skills) {
    var list = (skills || []).filter(function (s) {
      return s && (String(s.name || "").trim() || String(s.effect || "").trim());
    });
    if (!list.length) {
      return '<section class="char-skills"><h2 class="entry-section-title">技能</h2>' +
             '<p class="muted">没有记录技能。</p></section>';
    }

    return '<section class="char-skills">' +
             '<h2 class="entry-section-title">技能</h2>' +
             '<ol class="char-skill-list">' +
               list.map(function (s) {
                 var cond = String(s.condition || "").trim();
                 var note = String(s.note || "").trim();
                 return '<li class="char-skill">' +
                          '<p class="char-skill-head">' +
                            '<span class="char-skill-name">' + esc(s.name) + "</span>" +
                            (cond ? '<span class="char-skill-cond">（' + esc(cond) + "）</span>" : "") +
                          "</p>" +
                          (String(s.effect || "").trim()
                            ? '<p class="char-skill-effect">' + esc(s.effect) + "</p>"
                            : "") +
                          (note ? '<p class="char-skill-note">备注：' + esc(note) + "</p>" : "") +
                        "</li>";
               }).join("") +
             "</ol>" +
           "</section>";
  }

  function peopleHtml(item) {
    var reviewer = String(item.reviewer || "").trim();
    var reviewedAt = item.reviewed_at ? fmtDate(item.reviewed_at) : "";
    var reviewLine = reviewer
      ? "审核：" + reviewer + (reviewedAt ? " · " + reviewedAt : "")
      : "审核：未记录";

    var editor = String(item.editor || "").trim();
    var editedAt = item.edited_at ? fmtDate(item.edited_at) : "";
    var editLine = editor
      ? "最近编辑：" + editor + (editedAt ? " · " + editedAt : "")
      : "";

    return '<footer class="char-people">' +
             "<p>" + esc(reviewLine) + "</p>" +
             (editLine ? "<p>" + esc(editLine) + "</p>" : "") +
           "</footer>";
  }

  function galleryHtml(images) {
    var list = (images || []).filter(function (u) { return String(u).trim(); });
    if (!list.length) return "";

    return '<details class="char-gallery">' +
             "<summary>图片（" + list.length + " 张）</summary>" +
             '<div class="entry-gallery">' + list.map(function (u) {
               return '<figure class="gallery-item"><img src="' + esc(u) + '" alt="" loading="lazy"></figure>';
             }).join("") + "</div>" +
           "</details>";
  }

  /* ---------------- 翻页 ---------------- */

  function listUrl(page) {
    var p = new URLSearchParams();
    if (filters.q) p.set("q", filters.q);
    if (filters.rating) p.set("rating", filters.rating);
    if (filters.occ) p.set("occ", filters.occ);
    if (filters.order === "desc") p.set("order", "desc");
    if (page > 1) p.set("page", String(page));
    var qs = p.toString();
    return "rpg6.0.html" + (qs ? "?" + qs : "");
  }

  function detailUrl(charId) {
    var p = new URLSearchParams();
    p.set("id", charId);
    if (filters.q) p.set("q", filters.q);
    if (filters.rating) p.set("rating", filters.rating);
    if (filters.occ) p.set("occ", filters.occ);
    if (filters.order === "desc") p.set("order", "desc");
    return "character.html?" + p.toString();
  }

  /* 返回列表时带上同样的筛选，并落在当前角色所在那一页 */
  function updateBackLink() {
    if (!backEl) return;
    var page = 1;
    if (siblings && siblings.index >= 0) {
      page = Math.floor(siblings.index / PAGE_SIZE) + 1;
    }
    backEl.href = listUrl(page);
  }

  function pagerHtml() {
    if (!siblings || siblings.index < 0) return "";

    var ids = siblings.ids || [];
    var total = ids.length;
    if (total < 2) return "";

    var index = siblings.index;
    return '<nav class="gui-pager char-pager" aria-label="角色翻页">' +
             '<button type="button" class="btn btn-ghost" data-dir="-1"' +
               (index <= 0 ? " disabled" : "") + ">上一个</button>" +
             '<span class="gui-pager-info">第 ' + (index + 1) + " / 共 " + total + " 位</span>" +
             '<button type="button" class="btn btn-ghost" data-dir="1"' +
               (index >= total - 1 ? " disabled" : "") + ">下一个</button>" +
           "</nav>";
  }

  /* 相邻列表比正文晚到时，把翻页条补在末尾 */
  function appendPager() {
    if (!rendered || !siblings || siblings.index < 0) return;
    if (rootEl.querySelector(".char-pager")) return;
    var html = pagerHtml();
    if (html) rootEl.insertAdjacentHTML("beforeend", html);
  }

  function go(delta) {
    if (!siblings || siblings.index < 0) return;
    if (!delta) return;

    var nextIndex = siblings.index + delta;
    var nextId = siblings.ids[nextIndex];
    if (!nextId) return;

    Array.prototype.forEach.call(rootEl.querySelectorAll("[data-dir]"), function (btn) {
      btn.disabled = true;
    });
    rootEl.setAttribute("aria-busy", "true");

    window.RpgData.getCharacter(nextId).then(function (item) {
      rootEl.removeAttribute("aria-busy");
      if (!item) {
        fail("没有找到这条档案");
        return;
      }
      siblings.index = nextIndex;
      render(item);
      history.replaceState(null, "", detailUrl(nextId));
      window.scrollTo(0, 0);
    }).catch(function (err) {
      rootEl.removeAttribute("aria-busy");
      rootEl.innerHTML = '<h1 class="entry-title">载入失败</h1>' +
        '<p class="lead">' + esc(err.message) + "</p>";
    });
  }

  function render(item) {
    var banner = item.deleted
      ? '<p class="rpg-banner">这条档案已被删除，仅编辑区可见。</p>'
      : "";

    var head = '<h1 class="entry-title char-title">' +
                 markHtml(item.review_mark) +
                 aliasHtml(item.aliases) +
                 '<span class="char-name">' + esc(item.name) + "</span>" +
                 (String(item.occupation || "").trim() || String(item.side_job || "").trim()
                   ? '<span class="rpg-occ">（' + esc(item.occupation) +
                     (String(item.side_job || "").trim() ? "/" + esc(item.side_job) : "") + "）</span>"
                   : "") +
                 (String(item.rating || "").trim()
                   ? '<span class="rpg-rating">' + esc(item.rating) + "</span>"
                   : "") +
               "</h1>";

    document.title = item.name + " · 角色档案 · CPU";
    rendered = true;
    rootEl.innerHTML = banner + head + statsHtml(item) + skillsHtml(item.skills) +
      peopleHtml(item) + galleryHtml(item.images) + pagerHtml();
    updateBackLink();
  }

  function fail(text) {
    rootEl.innerHTML = '<h1 class="entry-title">' + esc(text) + "</h1>" +
      '<p class="lead"><a href="rpg6.0.html">返回档案列表</a></p>';
  }

  if (!id) {
    fail("没有指定角色");
    return;
  }

  rootEl.addEventListener("click", function (ev) {
    var btn = ev.target.closest("[data-dir]");
    if (!btn || btn.disabled) return;
    go(parseInt(btn.getAttribute("data-dir"), 10));
  });

  updateBackLink();

  window.RpgData.getCharacter(id).then(function (item) {
    if (!item) {
      fail("没有找到这条档案");
      return;
    }
    render(item);

    return window.RpgData.listSiblings(item, filters).then(function (res) {
      siblings = res;
      updateBackLink();
      appendPager();
    }).catch(function () {
      updateBackLink();
    });
  }).catch(function (err) {
    rootEl.innerHTML = '<h1 class="entry-title">载入失败</h1>' +
      '<p class="lead">' + esc(err.message) + "</p>";
  });
})();

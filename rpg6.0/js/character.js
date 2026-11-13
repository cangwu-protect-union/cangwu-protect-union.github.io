/* ============================================================
   character.js —— 角色详情
   ------------------------------------------------------------
   只看不改。图片默认折叠在页面最底部（<details>），
   审核人与最近编辑各一行；旧档案没有时间就只显示审核人。
   ============================================================ */
(function () {
  "use strict";

  var rootEl = document.getElementById("charRoot");
  var id = new URLSearchParams(location.search).get("id");

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
    rootEl.innerHTML = banner + head + statsHtml(item) + skillsHtml(item.skills) +
      peopleHtml(item) + galleryHtml(item.images);
  }

  function fail(text) {
    rootEl.innerHTML = '<h1 class="entry-title">' + esc(text) + "</h1>" +
      '<p class="lead"><a href="rpg6.0.html">返回档案列表</a></p>';
  }

  if (!id) {
    fail("没有指定角色");
    return;
  }

  window.RpgData.getCharacter(id).then(function (item) {
    if (!item) {
      fail("没有找到这条档案");
      return;
    }
    render(item);
  }).catch(function (err) {
    rootEl.innerHTML = '<h1 class="entry-title">载入失败</h1>' +
      '<p class="lead">' + esc(err.message) + "</p>";
  });
})();

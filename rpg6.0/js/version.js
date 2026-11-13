/* ============================================================
   version.js —— 只读查看一个历史版本
   ------------------------------------------------------------
   角色仍在档：可以「应用这个版本」——先把当前内容存进旧档案，
   再用这个版本的内容替换。
   角色已删除：不给应用按钮，指到「恢复此角色」。
   ============================================================ */
(function () {
  "use strict";

  var gateSection = document.getElementById("gateSection");
  var gateMount = document.getElementById("gateMount");
  var versionSection = document.getElementById("versionSection");
  var rootEl = document.getElementById("verRoot");
  var backLink = document.getElementById("backLink");
  var banner = document.getElementById("banner");
  var bannerText = document.getElementById("bannerText");
  var applyWrap = document.getElementById("applyWrap");
  var applyBtn = document.getElementById("applyBtn");
  var applyStatus = document.getElementById("applyStatus");

  var versionId = new URLSearchParams(location.search).get("v");

  var version = null;
  var character = null;
  var busy = false;

  var STAT_KEYS = ["atk", "def", "mres", "hp", "mp", "spd"];
  var STAT_LABELS = {
    atk: "攻击", def: "防御", mres: "法抗",
    hp: "血量", mp: "蓝上限", spd: "速度"
  };
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

  function fmtTime(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 16);
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
           " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  function setStatus(text) {
    applyStatus.hidden = !text;
    applyStatus.textContent = text || "";
  }

  function render(v) {
    var mark = String(v.review_mark || "").trim();
    var alias = (v.aliases || []).filter(function (a) { return String(a).trim(); })
      .map(function (a) { return '<span class="rpg-alias">[' + esc(a) + "]</span>"; }).join("");
    var side = String(v.side_job || "").trim();
    var occ = String(v.occupation || "").trim();

    var head = '<h1 class="entry-title">' + alias + esc(v.name) +
      (occ || side ? '<span class="rpg-occ">（' + esc(occ) + (side ? "/" + esc(side) : "") + "）</span>" : "") +
      (String(v.rating || "").trim() ? '<span class="rpg-rating">' + esc(v.rating) + "</span>" : "") +
      (mark ? '<span class="rpg-mark ' + (MARK_CLASS[mark] || "mark-unknown") + '">' + esc(mark) + "</span>" : "") +
      "</h1>";

    var stats = '<div class="char-stats">' + STAT_KEYS.map(function (k) {
      var value = String(v[k] == null ? "" : v[k]).trim();
      return '<div class="char-stat">' +
               '<span class="char-stat-label">' + STAT_LABELS[k] + "</span>" +
               '<span class="char-stat-value">' + esc(value || "—") + "</span>" +
             "</div>";
    }).join("") + "</div>";

    var skills = (v.skills || []).filter(function (s) {
      return s && (String(s.name || "").trim() || String(s.effect || "").trim());
    });
    var skillsHtml = '<section class="char-skills"><h2 class="entry-section-title">技能</h2>' +
      (skills.length
        ? '<ol class="char-skill-list">' + skills.map(function (s) {
            var cond = String(s.condition || "").trim();
            var note = String(s.note || "").trim();
            return '<li class="char-skill">' +
                     '<p class="char-skill-head"><span class="char-skill-name">' + esc(s.name) + "</span>" +
                     (cond ? '<span class="char-skill-cond">（' + esc(cond) + "）</span>" : "") + "</p>" +
                     (String(s.effect || "").trim()
                       ? '<p class="char-skill-effect">' + esc(s.effect) + "</p>" : "") +
                     (note ? '<p class="char-skill-note">备注：' + esc(note) + "</p>" : "") +
                   "</li>";
          }).join("") + "</ol>"
        : '<p class="muted">没有记录技能。</p>') +
      "</section>";

    var images = (v.images || []).filter(function (u) { return String(u).trim(); });
    var gallery = images.length
      ? '<details class="char-gallery"><summary>图片（' + images.length + " 张）</summary>" +
        '<div class="entry-gallery">' + images.map(function (u) {
          return '<figure class="gallery-item"><img src="' + esc(u) + '" alt="" loading="lazy"></figure>';
        }).join("") + "</div></details>"
      : "";

    document.title = v.name + "（旧版本）· CPU";
    rootEl.innerHTML = head + stats + skillsHtml + gallery;
  }

  function fail(title, text) {
    versionSection.hidden = false;
    gateSection.hidden = true;
    rootEl.innerHTML = '<h1 class="entry-title">' + esc(title) + "</h1>" +
      (text ? '<p class="lead">' + esc(text) + "</p>" : "");
    applyWrap.hidden = true;
  }

  function bindApply(alive) {
    if (!alive) {
      applyWrap.hidden = true;

      var link = document.createElement("p");
      link.className = "rpg-sub-link";
      link.innerHTML = '<a href="old-character.html?id=' +
        encodeURIComponent(version.character_id) + '">去恢复这个角色 →</a>';
      rootEl.parentNode.insertBefore(link, rootEl.nextSibling);
      return;
    }

    applyWrap.hidden = false;

    applyBtn.addEventListener("click", function () {
      if (busy || !character) return;

      window.RpgForm.dialog({
        title: "应用这个版本",
        text: "当前内容会先存入旧档案，然后换成这个版本。",
        needOperator: true,
        confirmText: "确认应用"
      }).then(function (result) {
        if (!result) return;

        busy = true;
        applyBtn.disabled = true;
        applyBtn.textContent = "应用中…";
        setStatus("");

        window.RpgData.archiveVersion(character, "edit").then(function () {
          return window.RpgData.updateCharacter(character.id, version, result.operator);
        }).then(function () {
          return window.RpgData.markVersionApplied(version.version_id);
        }).then(function () {
          location.href = "edit-characters.html";
        }).catch(function (err) {
          busy = false;
          applyBtn.disabled = false;
          applyBtn.textContent = "应用这个版本";
          setStatus("应用失败：" + err.message);
        });
      });
    });
  }

  function load() {
    window.RpgData.getVersion(versionId).then(function (v) {
      if (!v) {
        fail("版本不存在", "链接无效，或该版本已被清理。");
        return;
      }
      version = v;
      backLink.href = "old-character.html?id=" + encodeURIComponent(v.character_id);
      backLink.textContent = "← 返回该角色的所有版本";

      render(v);

      window.RpgData.getCharacter(v.character_id).then(function (item) {
        character = item;
        var alive = !!item && !item.deleted;

        banner.hidden = false;
        bannerText.textContent = "这是「" + v.name + "」的一个历史版本，归档于 " +
          fmtTime(v.archived_at) + "（" + (v.reason === "delete" ? "删除前" : "修改前") + "）。";

        bindApply(alive);
      });
    }).catch(function (err) {
      fail("载入失败", err.message);
    });
  }

  if (!versionId) {
    fail("缺少参数", "这个页面需要 ?v=。");
    return;
  }

  window.GuiGate.require(gateMount, {
    cancelHref: "old-characters.html",
    failHref: "old-characters.html",
    onPass: function () {
      gateSection.hidden = true;
      versionSection.hidden = false;
      load();
    }
  });
})();

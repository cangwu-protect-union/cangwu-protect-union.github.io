/* ============================================================
   review.js —— 投稿审核
   ------------------------------------------------------------
   三个页签：待审 / 已通过 / 已驳回。
   通过 → 跳 edit-character.html?submission=<id>（预填编辑器）。
   驳回 → 选审核人 + 写备注，只改状态，不写审核评价。
   ============================================================ */
(function () {
  "use strict";

  var gateSection = document.getElementById("gateSection");
  var gateMount = document.getElementById("gateMount");
  var reviewSection = document.getElementById("reviewSection");
  var tabsEl = document.getElementById("reviewTabs");
  var listEl = document.getElementById("reviewList");
  var emptyEl = document.getElementById("reviewEmpty");
  var countEl = document.getElementById("reviewCount");

  var TAB_STATUS = {
    pending: ["pending"],
    approved: ["approved"],
    rejected: ["rejected"]
  };

  var EMPTY_TEXT = {
    pending: "没有待审的投稿。",
    approved: "还没有通过的投稿。",
    rejected: "还没有被驳回的投稿。"
  };

  var current = "pending";

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

  function occText(item) {
    var occ = String(item.occupation || "").trim();
    var side = String(item.side_job || "").trim();
    if (!occ && !side) return "";
    return "（" + occ + (side ? "/" + side : "") + "）";
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
    if (!list.length) return '<p class="muted">没有填写技能。</p>';

    return '<ol class="char-skill-list">' + list.map(function (s) {
      var cond = String(s.condition || "").trim();
      var note = String(s.note || "").trim();
      return '<li class="char-skill">' +
               '<p class="char-skill-head">' +
                 '<span class="char-skill-name">' + esc(s.name) + "</span>" +
                 (cond ? '<span class="char-skill-cond">（' + esc(cond) + "）</span>" : "") +
               "</p>" +
               (String(s.effect || "").trim()
                 ? '<p class="char-skill-effect">' + esc(s.effect) + "</p>" : "") +
               (note ? '<p class="char-skill-note">备注：' + esc(note) + "</p>" : "") +
             "</li>";
    }).join("") + "</ol>";
  }

  function imagesHtml(images) {
    var list = (images || []).filter(function (u) { return String(u).trim(); });
    if (!list.length) return "";
    return '<div class="image-list">' + list.map(function (u) {
      return '<figure class="image-item">' +
               '<a href="' + esc(u) + '" target="_blank" rel="noopener">' +
                 '<img src="' + esc(u) + '" alt="" loading="lazy">' +
               "</a></figure>";
    }).join("") + "</div>";
  }

  function pendingHtml(item) {
    var alias = (item.aliases || []).filter(function (a) { return String(a).trim(); })
      .map(function (a) { return "[" + esc(a) + "]"; }).join("");
    var meta = [];
    if (item.created_at) meta.push("提交于 " + fmtDate(item.created_at));
    if (String(item.author || "").trim()) meta.push("署名：" + esc(item.author));

    return '<article class="rpg-sub" data-id="' + esc(item.id) + '">' +
             '<h3 class="rpg-sub-title">' + alias + esc(item.name) +
               esc(occText(item)) +
               (String(item.rating || "").trim()
                 ? '<span class="rpg-rating">' + esc(item.rating) + "</span>" : "") +
             "</h3>" +
             (meta.length ? '<p class="muted rpg-sub-meta">' + meta.join(" · ") + "</p>" : "") +
             statsHtml(item) +
             skillsHtml(item.skills) +
             imagesHtml(item.images) +
             (String(item.note || "").trim()
               ? '<p class="rpg-sub-note">投稿备注：' + esc(item.note) + "</p>" : "") +
             '<div class="rpg-sub-actions">' +
               '<button type="button" class="btn" data-act="approve">通过</button>' +
               '<button type="button" class="btn btn-danger" data-act="reject">驳回</button>' +
             "</div>" +
           "</article>";
  }

  function doneHtml(item) {
    var meta = [];
    if (String(item.reviewer || "").trim()) meta.push("审核：" + esc(item.reviewer));
    if (item.reviewed_at) meta.push(fmtDate(item.reviewed_at));
    if (String(item.review_note || "").trim()) meta.push("备注：" + esc(item.review_note));

    var link = item.status === "approved" && item.approved_character_id
      ? '<p class="rpg-sub-link"><a href="character.html?id=' +
        encodeURIComponent(item.approved_character_id) + '">查看档案 →</a></p>'
      : "";

    return '<article class="rpg-sub is-done">' +
             '<h3 class="rpg-sub-title">' + esc(item.name) + esc(occText(item)) + "</h3>" +
             '<p class="muted rpg-sub-meta">' + (meta.join(" · ") || "没有记录审核信息") + "</p>" +
             link +
           "</article>";
  }

  function syncTabs() {
    Array.prototype.forEach.call(tabsEl.querySelectorAll("[data-status]"), function (b) {
      b.classList.toggle("is-on", b.getAttribute("data-status") === current);
    });
  }

  function syncEmpty() {
    var n = listEl.querySelectorAll(".rpg-sub").length;
    countEl.textContent = n ? "共 " + n + " 条" : "";
    emptyEl.querySelector("p").textContent = EMPTY_TEXT[current];
    emptyEl.hidden = n !== 0;
  }

  function load(status) {
    current = status;
    syncTabs();
    countEl.textContent = "正在载入…";
    listEl.innerHTML = "";
    emptyEl.hidden = true;

    window.RpgData.listSubmissions(TAB_STATUS[status]).then(function (items) {
      listEl.innerHTML = items.map(status === "pending" ? pendingHtml : doneHtml).join("");
      syncEmpty();
      if (!items.length && window.RpgData.isCloudDown()) {
        emptyEl.hidden = true;
        countEl.textContent = "云端暂不可用，读不到投稿。";
      }
    }).catch(function (err) {
      countEl.textContent = "载入失败：" + err.message;
    });
  }

  function showReview() {
    gateSection.hidden = true;
    reviewSection.hidden = false;
    load(current);
  }

  window.GuiGate.require(gateMount, {
    cancelHref: "edit-characters.html",
    failHref: "edit-characters.html",
    onPass: showReview
  });

  tabsEl.addEventListener("click", function (ev) {
    var btn = ev.target.closest ? ev.target.closest("[data-status]") : null;
    if (!btn) return;
    var s = btn.getAttribute("data-status");
    if (!s || s === current) return;
    load(s);
  });

  listEl.addEventListener("click", function (ev) {
    var btn = ev.target.closest ? ev.target.closest("[data-act]") : null;
    if (!btn || btn.disabled) return;

    var card = btn.closest(".rpg-sub");
    if (!card) return;
    var id = card.getAttribute("data-id");
    var act = btn.getAttribute("data-act");

    if (act === "approve") {
      location.href = "edit-character.html?submission=" + encodeURIComponent(id);
      return;
    }

    window.RpgForm.dialog({
      title: "驳回投稿",
      text: "驳回只记录审核人和备注，不写审核评价。投稿会留在「已驳回」里，不能删除。",
      needOperator: true,
      needNote: true,
      confirmText: "确认驳回",
      danger: true
    }).then(function (result) {
      if (!result) return;

      btn.disabled = true;
      btn.textContent = "处理中…";

      window.RpgData.rejectSubmission(id, result.operator, result.note).then(function () {
        card.parentNode.removeChild(card);
        syncEmpty();
      }).catch(function (err) {
        btn.disabled = false;
        btn.textContent = "驳回";
        countEl.textContent = "操作失败：" + err.message;

        if (/42501|row-level security|permission denied/i.test(String(err.message))) {
          window.GuiGate.clearVerified();
          setTimeout(function () { location.reload(); }, 1500);
        }
      });
    });
  });
})();

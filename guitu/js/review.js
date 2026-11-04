/* ============================================================
   review.js —— 投稿审核
   ------------------------------------------------------------
   进页面先过组织验证，通过后按状态分页签列出 gui_tips：
     pending → 待审（可操作）
     approved → 已通过（只读）
     rejected → 已驳回（只读）
   改状态走 PATCH，令牌由 gui-data.js 放进 Prefer 头，
   数据库策略 gui_tips_update 要求 gui_token_ok()。
   ============================================================ */
(function () {
  "use strict";

  var gateSection   = document.getElementById("gateSection");
  var gateMount     = document.getElementById("gateMount");
  var reviewSection = document.getElementById("reviewSection");
  var tabsEl        = document.getElementById("reviewTabs");
  var listEl        = document.getElementById("reviewList");
  var emptyEl       = document.getElementById("reviewEmpty");
  var countEl       = document.getElementById("reviewCount");

  var TAB_STATUS = {
    pending:  ["pending"],
    approved: ["approved", "adopted"],
    rejected: ["rejected"]
  };
  var STATUS_TEXT = {
    pending: "待审",
    approved: "已通过",
    adopted: "已采纳",
    rejected: "已驳回"
  };

  var current = "pending";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function paragraphs(body) {
    return String(body || "").split(/\n+/).filter(function (p) {
      return p.trim() !== "";
    }).map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("");
  }

  function itemHtml(t) {
    var thumb = window.guiThumbFor ? window.guiThumbFor(t) : (t.image || "");
    var imgCount = window.guiImagesFor ? window.guiImagesFor(t).length : 0;
    var tags = (t.tags || []).length ? " · " + esc((t.tags || []).join("、")) : "";
    var created = String(t.created_at || "").slice(0, 10);

    var actions;
    if (t.status === "pending") {
      actions =
        '<div class="review-actions">' +
          '<input class="review-note" type="text" placeholder="备注（可留空）" maxlength="200" aria-label="审核备注">' +
          '<button type="button" class="btn" data-act="approved">通过</button>' +
          '<button type="button" class="btn btn-danger" data-act="rejected">驳回</button>' +
        '</div>';
    } else {
      actions =
        '<p class="review-meta muted">' +
          esc(STATUS_TEXT[t.status] || t.status) +
          (t.reviewed_at ? " · " + esc(String(t.reviewed_at).slice(0, 10)) : "") +
          (t.review_note ? " · 备注：" + esc(t.review_note) : "") +
        "</p>";
    }

    return '<article class="review-item" data-id="' + esc(t.id) + '">' +
             (thumb ? '<div class="review-item-img"><img src="' + esc(thumb) + '" alt="" loading="lazy"></div>' : "") +
             '<div class="review-item-body">' +
               '<h3 class="review-item-title">' + esc(t.title) + "</h3>" +
               '<p class="review-item-meta muted">' +
                 (created || "无日期") + " · " + (imgCount ? imgCount + " 张图" : "无图") + tags +
               "</p>" +
               '<details class="review-details">' +
                 '<summary>展开正文</summary>' +
                 '<div class="review-body">' + paragraphs(t.body) + "</div>" +
               "</details>" +
               actions +
             "</div>" +
           "</article>";
  }

  function syncTabs() {
    Array.prototype.forEach.call(tabsEl.querySelectorAll("[data-status]"), function (b) {
      var on = b.getAttribute("data-status") === current;
      b.classList.toggle("is-on", on);
    });
  }

  function emptyText() {
    if (current === "pending") return "没有待审的情报。";
    if (current === "approved") return "还没有通过的情报。";
    return "还没有被驳回的情报。";
  }

  function syncEmpty() {
    var n = listEl.querySelectorAll(".review-item").length;
    countEl.textContent = n ? "共 " + n + " 条" : "";
    emptyEl.querySelector("p").textContent = emptyText();
    emptyEl.hidden = n !== 0;
  }

  function load(status) {
    current = status;
    syncTabs();
    countEl.textContent = "正在载入…";
    listEl.innerHTML = "";
    emptyEl.hidden = true;

    window.GuiData.listTips(TAB_STATUS[status]).then(function (tips) {
      listEl.innerHTML = tips.map(itemHtml).join("");
      syncEmpty();
    }).catch(function (err) {
      countEl.textContent = "载入失败：" + err.message;
    });
  }

  function showReview() {
    if (gateSection) gateSection.hidden = true;
    reviewSection.hidden = false;
    load(current);
  }

  /* ---------- 验证门 ---------- */
  window.GuiGate.require(gateMount, {
    cancelHref: "tips.html",
    failHref: "tips.html",
    onPass: showReview
  });

  /* ---------- 页签 ---------- */
  tabsEl.addEventListener("click", function (ev) {
    var btn = ev.target.closest ? ev.target.closest("[data-status]") : null;
    if (!btn) return;
    var s = btn.getAttribute("data-status");
    if (!s || s === current) return;
    load(s);
  });

  /* ---------- 通过 / 驳回 ---------- */
  listEl.addEventListener("click", function (ev) {
    var btn = ev.target.closest ? ev.target.closest("[data-act]") : null;
    if (!btn || btn.disabled) return;

    var row = btn.closest(".review-item");
    if (!row) return;

    var id = row.getAttribute("data-id");
    var nextStatus = btn.getAttribute("data-act");
    var noteEl = row.querySelector(".review-note");
    var note = noteEl ? noteEl.value.trim() : "";
    var label = btn.textContent;

    if (nextStatus === "rejected" && !window.confirm("确定驳回这条情报？")) return;

    var buttons = row.querySelectorAll("[data-act]");
    Array.prototype.forEach.call(buttons, function (b) { b.disabled = true; });
    btn.textContent = "处理中…";

    window.GuiData.setTipStatus(id, nextStatus, note).then(function () {
      row.parentNode.removeChild(row);
      syncEmpty();
    }).catch(function (err) {
      Array.prototype.forEach.call(buttons, function (b) { b.disabled = false; });
      btn.textContent = label;
      countEl.textContent = "操作失败：" + err.message;

      /* 令牌过期 / 没权限：清掉本地令牌，回到验证界面 */
      if (/42501|row-level security|permission denied/i.test(String(err.message))) {
        window.GuiGate.clearVerified();
        setTimeout(function () { location.reload(); }, 1500);
      }
    });
  });
})();

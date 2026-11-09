/* ============================================================
   suggest-review.js —— 站点建议审核
   ------------------------------------------------------------
   进页面先过组织验证（与图鉴共用同一套问答与令牌），
   通过后按时间倒序列出 site_suggestions，处理完直接删除。
   删除走 DELETE，数据库策略 site_suggestions_delete 要求令牌。
   ============================================================ */
(function () {
  "use strict";

  var D = window.SiteSuggest;

  var gateSection = document.getElementById("gateSection");
  var gateMount = document.getElementById("gateMount");
  var reviewSection = document.getElementById("reviewSection");
  var listEl = document.getElementById("reviewList");
  var emptyEl = document.getElementById("reviewEmpty");
  var countEl = document.getElementById("reviewCount");

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function paragraphs(body) {
    return String(body || "").split(/\n+/).filter(function (p) {
      return p.trim() !== "";
    }).map(function (p) { return "<p>" + esc(p.trim()) + "</p>"; }).join("");
  }

  function itemHtml(s) {
    var kind = D.KIND_LABELS[s.kind] || s.kind;
    var created = String(s.created_at || "").slice(0, 10);

    return '<article class="review-item" data-id="' + esc(s.id) + '">' +
             '<div class="review-item-body">' +
               '<h3 class="review-item-title">' + esc(s.title) + "</h3>" +
               '<p class="review-item-meta muted">' +
                 esc(kind) + " · " + esc(created || "无日期") +
               "</p>" +
               '<div class="review-body">' + paragraphs(s.body) + "</div>" +
               '<div class="review-actions">' +
                 '<button type="button" class="btn btn-danger" data-act="delete">删除</button>' +
               "</div>" +
             "</div>" +
           "</article>";
  }

  function syncEmpty() {
    var n = listEl.querySelectorAll(".review-item").length;
    countEl.textContent = n ? "共 " + n + " 条" : "";
    emptyEl.hidden = n !== 0;
  }

  function load() {
    countEl.textContent = "正在载入…";
    listEl.innerHTML = "";
    emptyEl.hidden = true;

    D.list().then(function (rows) {
      listEl.innerHTML = rows.map(itemHtml).join("");
      syncEmpty();
    }).catch(function (err) {
      countEl.textContent = "载入失败：" + err.message;

      if (/42501|row-level security|permission denied/i.test(String(err.message))) {
        window.GuiGate.clearVerified();
        setTimeout(function () { location.reload(); }, 1500);
      }
    });
  }

  function showReview() {
    if (gateSection) gateSection.hidden = true;
    reviewSection.hidden = false;
    load();
  }

  window.GuiGate.require(gateMount, {
    cancelHref: "projects.html",
    failHref: "projects.html",
    onPass: showReview
  });

  listEl.addEventListener("click", function (ev) {
    var btn = ev.target.closest ? ev.target.closest("[data-act='delete']") : null;
    if (!btn || btn.disabled) return;

    var row = btn.closest(".review-item");
    if (!row) return;

    if (!window.confirm("确定删除这条建议？删除后无法恢复。")) return;

    var id = row.getAttribute("data-id");
    btn.disabled = true;
    btn.textContent = "删除中…";

    D.remove(id).then(function () {
      row.parentNode.removeChild(row);
      syncEmpty();
    }).catch(function (err) {
      btn.disabled = false;
      btn.textContent = "删除";
      countEl.textContent = "删除失败：" + err.message;
    });
  });
})();

/* ============================================================
   pick-tips.js —— 勾选要引用的投稿（区域侧）
   ------------------------------------------------------------
   进入前由编辑页写 sessionStorage：quyu_tips_ctx { returnTo, selected }
   确认后写回 { selected, done: true } 并回到编辑页。
   卡片结构复用全站的 .pick-item 那套样式。
   ============================================================ */
(function () {
  "use strict";

  var CTX_KEY = "quyu_tips_ctx";

  var gateSection = document.getElementById("gateSection");
  var pickSection = document.getElementById("pickSection");
  var pickList = document.getElementById("pickList");
  var pickCount = document.getElementById("pickCount");
  var okBtn = document.getElementById("okBtn");

  var ctx = null;
  try { ctx = JSON.parse(sessionStorage.getItem(CTX_KEY) || "null"); } catch (e) { ctx = null; }
  ctx = ctx || {};
  var returnTo = ctx.returnTo || "add-zone.html";

  var chosen = {};
  (ctx.selected || []).forEach(function (id) { chosen[id] = true; });

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function thumb(t) {
    return (t.thumbs && t.thumbs[0]) || (t.images && t.images[0]) || (t.image || "");
  }

  function cardHtml(t) {
    var img = thumb(t);
    var on = !!chosen[t.id];
    return "" +
      '<li class="pick-item' + (on ? " is-on" : "") + '" data-id="' + esc(t.id) + '">' +
        (img
          ? '<div class="pick-item-img"><img src="' + esc(img) + '" alt="" loading="lazy"></div>'
          : "") +
        '<div class="pick-item-body">' +
          '<h3 class="pick-item-title">' + esc(t.title) + "</h3>" +
          '<p class="pick-item-intro">' + esc(t.intro || "") + "</p>" +
          '<p class="pick-item-meta">' + (t.date ? esc(t.date) : "") + "</p>" +
        "</div>" +
        '<div class="pick-item-check"><input type="checkbox" tabindex="-1" aria-label="选择这条投稿"' +
          (on ? " checked" : "") + "></div>" +
      "</li>";
  }

  function render(tips) {
    if (!tips.length) {
      pickCount.textContent = "没有待采纳的投稿。";
      pickList.innerHTML = "";
      return;
    }
    pickCount.textContent = "共 " + tips.length + " 条待采纳投稿，点卡片选中后点「确定引用」。";
    pickList.innerHTML = tips.map(cardHtml).join("");
  }

  window.GuiGate.require(document.getElementById("gateMount"), {
    cancelHref: returnTo,
    failHref: returnTo,
    onPass: function () {
      gateSection.hidden = true;
      pickSection.hidden = false;

      window.ZoneData.listTips({ pendingOnly: true }).then(render).catch(function (err) {
        pickCount.textContent = "读取投稿失败：" + (err.message || "请稍后重试");
      });
    }
  });

  pickList.addEventListener("click", function (ev) {
    var item = ev.target.closest(".pick-item");
    if (!item) return;

    var id = item.getAttribute("data-id");
    var box = item.querySelector("input[type=checkbox]");
    var on = item.classList.toggle("is-on");

    if (box) box.checked = on;
    if (on) chosen[id] = true; else delete chosen[id];

    var n = Object.keys(chosen).length;
    okBtn.textContent = n ? "确定引用（" + n + "）" : "确定引用";
  });

  document.getElementById("cancelBtn").addEventListener("click", function () {
    location.href = returnTo;
  });

  okBtn.addEventListener("click", function () {
    var selected = Object.keys(chosen);
    try {
      sessionStorage.setItem(CTX_KEY, JSON.stringify({ returnTo: returnTo, selected: selected, done: true }));
    } catch (e) {}
    location.href = returnTo;
  });
})();

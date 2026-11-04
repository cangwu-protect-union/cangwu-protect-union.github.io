/* ============================================================
   pick-tips.js —— 勾选要引用的投稿
   ------------------------------------------------------------
   结果写进 sessionStorage 的 quyu_picked_tips，随后回增加区域页。
   只列「还没被采纳」的投稿。
   卡片结构复用全站的 .pick-item 那套样式。
   ============================================================ */
(function () {
  "use strict";

  var PICK_KEY = "quyu_picked_tips";

  var gateSection = document.getElementById("gateSection");
  var pickSection = document.getElementById("pickSection");
  var pickList = document.getElementById("pickList");
  var pickCount = document.getElementById("pickCount");
  var okBtn = document.getElementById("okBtn");

  var chosen = {};    /* id → { id, title } */

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
          '<p class="pick-item-meta">' +
            (t.region ? esc(t.region) + " · " : "") +
            (t.date ? esc(t.date) : "") +
          "</p>" +
        "</div>" +
        '<div class="pick-item-check"><input type="checkbox" tabindex="-1"' + (on ? " checked" : "") +
          ' aria-label="选择这条投稿"></div>' +
      "</li>";
  }

  function render(tips) {
    if (!tips.length) {
      pickCount.textContent = "没有待采纳的投稿。";
      pickList.innerHTML = "";
      okBtn.disabled = true;
      return;
    }
    pickCount.textContent = "共 " + tips.length + " 条待采纳投稿，点卡片选中后点「确定引用」。";
    pickList.innerHTML = tips.map(cardHtml).join("");
  }

  function showPick() {
    gateSection.hidden = true;
    pickSection.hidden = false;

    window.ZoneData.listTips({ pendingOnly: true }).then(render).catch(function (err) {
      pickCount.textContent = "读取投稿失败：" + (err.message || "请稍后重试");
    });
  }

  window.GuiGate.require(document.getElementById("gateMount"), {
    cancelHref: "add-zone.html",
    failHref: "add-zone.html",
    onPass: showPick
  });

  pickList.addEventListener("click", function (ev) {
    var item = ev.target.closest(".pick-item");
    if (!item) return;

    var id = item.getAttribute("data-id");
    var box = item.querySelector("input[type=checkbox]");
    var titleEl = item.querySelector(".pick-item-title");
    var on = item.classList.toggle("is-on");

    if (box) box.checked = on;
    if (on) chosen[id] = { id: id, title: titleEl ? titleEl.textContent : id };
    else delete chosen[id];

    okBtn.textContent = Object.keys(chosen).length
      ? "确定引用（" + Object.keys(chosen).length + "）"
      : "确定引用";
  });

  document.getElementById("cancelBtn").addEventListener("click", function () {
    location.href = "add-zone.html";
  });

  okBtn.addEventListener("click", function () {
    var list = Object.keys(chosen).map(function (k) { return chosen[k]; });
    sessionStorage.setItem(PICK_KEY, JSON.stringify(list));
    location.href = "add-zone.html";
  });
})();

/* ============================================================
   pick-relation.js —— 勾选要关联的条目（鬼 / 区域两个页签）
   ------------------------------------------------------------
   进入时读 sessionStorage：已选中的、正在编辑的条目（要排除自身）。
   确认后把选中结果写回 sessionStorage 并回到来源页面。
   ============================================================ */
(function () {
  "use strict";

  var ctx = window.ZoneRelations.peekPick() || {};
  var selfType = ctx.selfType || "";
  var selfId = ctx.selfId || "";
  var returnTo = ctx.returnTo || "quyu.html";

  var tabs = document.getElementById("relTabs");
  var listEl = document.getElementById("relList");
  var countEl = document.getElementById("relCount");
  var searchEl = document.getElementById("relSearch");
  var okBtn = document.getElementById("okBtn");
  var cancelBtn = document.getElementById("cancelBtn");

  var chosen = {};
  (ctx.selected || []).forEach(function (s) { chosen[s] = true; });

  var state = { tab: "ghost", kw: "", data: { ghost: [], zone: [] } };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function render() {
    var list = state.data[state.tab].filter(function (it) {
      if (!state.kw) return true;
      return String(it.title || "").toLowerCase().indexOf(state.kw.toLowerCase()) !== -1;
    });

    if (!list.length) {
      listEl.innerHTML = "";
      countEl.textContent = state.kw ? "没有匹配的条目。" : "这一类还没有条目。";
      return;
    }

    countEl.textContent = "共 " + list.length + " 条，已选 " + Object.keys(chosen).length + " 条";
    listEl.innerHTML = list.map(function (it) {
      var key = it.type + ":" + it.id;
      var on = !!chosen[key];
      return "" +
        '<li class="pick-item' + (on ? " is-on" : "") + '" data-key="' + esc(key) + '">' +
          '<div class="pick-item-body">' +
            '<h3 class="pick-item-title">' + esc(it.title) + "</h3>" +
            '<p class="pick-item-meta">' + (it.type === "ghost" ? "鬼图鉴" : "异常区域") + "</p>" +
          "</div>" +
          '<div class="pick-item-check"><input type="checkbox" tabindex="-1"' + (on ? " checked" : "") + "></div>" +
        "</li>";
    }).join("");
  }

  function switchTab(tab) {
    state.tab = tab;
    Array.prototype.forEach.call(tabs.querySelectorAll("[data-tab]"), function (a) {
      a.classList.toggle("is-on", a.getAttribute("data-tab") === tab);
    });
    render();
  }

  listEl.addEventListener("click", function (ev) {
    var item = ev.target.closest(".pick-item");
    if (!item) return;
    var key = item.getAttribute("data-key");
    var on = item.classList.toggle("is-on");
    var box = item.querySelector("input[type=checkbox]");
    if (box) box.checked = on;
    if (on) chosen[key] = true; else delete chosen[key];
    render();
  });

  tabs.addEventListener("click", function (ev) {
    var a = ev.target.closest("[data-tab]");
    if (!a) return;
    ev.preventDefault();
    switchTab(a.getAttribute("data-tab"));
  });

  searchEl.addEventListener("input", function () {
    state.kw = searchEl.value.trim();
    render();
  });

  okBtn.addEventListener("click", function () {
    var selected = Object.keys(chosen);
    try {
      sessionStorage.setItem("quyu_relation_pick", JSON.stringify({
        selected: selected, selfType: selfType, selfId: selfId, returnTo: returnTo, done: true
      }));
    } catch (e) {}
    location.href = returnTo;
  });

  cancelBtn.addEventListener("click", function () {
    location.href = returnTo;
  });

  Promise.all([
    window.ZoneRelations.targets("ghost", selfType === "ghost" ? selfId : ""),
    window.ZoneRelations.targets("zone", selfType === "zone" ? selfId : "")
  ]).then(function (rs) {
    state.data.ghost = rs[0];
    state.data.zone = rs[1];
    render();
  }).catch(function (err) {
    countEl.textContent = "载入失败：" + (err.message || "请稍后重试");
  });
})();

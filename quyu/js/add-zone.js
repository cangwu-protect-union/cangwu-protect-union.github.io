/* ============================================================
   add-zone.js —— 增加区域（编辑区，需要组织验证）
   ------------------------------------------------------------
   「引用投稿」在 pick-tips.html 里勾选，结果放在 sessionStorage：
     quyu_picked_tips → [{ id, title }]
   保存成功后把每条投稿标记为已采纳，并写上本区域的 id。
   ============================================================ */
(function () {
  "use strict";

  var PICK_KEY = "quyu_picked_tips";

  var gateSection = document.getElementById("gateSection");
  var formSection = document.getElementById("formSection");
  var doneSection = document.getElementById("doneSection");
  var pickedBox = document.getElementById("pickedBox");
  var pickedList = document.getElementById("pickedList");
  var doneText = document.getElementById("doneText");
  var doneView = document.getElementById("doneView");
  var adoptError = document.getElementById("adoptError");
  var submitBtn = document.getElementById("submitBtn");
  var formEl = document.getElementById("zoneForm");

  var form = null;           /* 验证通过后才建表单 */
  var picked = [];           /* [{ id, title }] */

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function readPicked() {
    try {
      var v = JSON.parse(sessionStorage.getItem(PICK_KEY) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (_e) { return []; }
  }

  function renderPicked() {
    if (!picked.length) { pickedBox.hidden = true; pickedList.innerHTML = ""; return; }
    pickedBox.hidden = false;
    pickedList.innerHTML = picked.map(function (t) {
      return '<li><a href="tips-entry.html?id=' + encodeURIComponent(t.id) + '">' + esc(t.title) + "</a></li>";
    }).join("");
  }

  function showForm() {
    gateSection.hidden = true;
    formSection.hidden = false;

    picked = readPicked();
    form = window.ZoneForm.mount(document.getElementById("formMount"), { mode: "create" });
    renderPicked();

    /* 引用投稿时，把投稿的区域名/地区先填进去，省一次重打 */
    if (picked.length) {
      window.ZoneData.listTips().then(function (tips) {
        var hit = tips.filter(function (t) { return t.id === picked[0].id; })[0];
        if (!hit || !form) return;
        form.el.title.value = form.el.title.value || hit.title || "";
        form.el.region.value = form.el.region.value || hit.region || "";
        if (!form.el.body.value && hit.body) form.el.body.value = hit.body;
        if (hit.lng != null && form.el.lng.value === "") form.el.lng.value = hit.lng;
        if (hit.lat != null && form.el.lat.value === "") form.el.lat.value = hit.lat;
      });
    }

    form.el.title.focus();
  }

  window.GuiGate.require(document.getElementById("gateMount"), {
    cancelHref: "edit-zones.html",
    failHref: "edit-zones.html",
    onPass: showForm
  });

  document.getElementById("cancelBtn").addEventListener("click", function () {
    sessionStorage.removeItem(PICK_KEY);
    location.href = "edit-zones.html";
  });

  document.getElementById("pickTipsBtn").addEventListener("click", function () {
    location.href = "pick-tips.html";
  });

  formEl.addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (!form) return;

    var problems = form.validate();
    if (problems.length) { form.showError(problems.join("；")); return; }

    var values = form.collect();
    values.id = window.ZoneData.newId();

    form.showError("");
    submitBtn.disabled = true;
    submitBtn.textContent = "正在保存…";

    window.ZoneData.insertEntry(values).then(function () {
      var zoneId = values.id;

      formSection.hidden = true;
      doneSection.hidden = false;
      doneText.textContent = "「" + values.title + "」已写入档案。";
      doneView.href = "zone.html?id=" + encodeURIComponent(zoneId);

      /* 把引用过的投稿标记为已采纳；单条失败不影响区域本身 */
      if (!picked.length) { sessionStorage.removeItem(PICK_KEY); return; }

      return Promise.all(picked.map(function (t) {
        return window.ZoneData.markTipAdopted(t.id, zoneId).catch(function (err) {
          return { error: t.title + "：" + (err.message || "标记失败") };
        });
      })).then(function (results) {
        sessionStorage.removeItem(PICK_KEY);
        var fails = results.filter(function (r) { return r && r.error; });
        if (fails.length) {
          adoptError.hidden = false;
          adoptError.textContent = "区域已保存，但以下投稿没标上已采纳：" +
            fails.map(function (f) { return f.error; }).join("；");
        }
      });
    }).catch(function (err) {
      form.showError("保存失败：" + (err.message || "请稍后重试"));
      submitBtn.disabled = false;
      submitBtn.textContent = "确认";
    });
  });
})();

/* ============================================================
   add-zone.js —— 增加区域（编辑区，需要组织验证）
   ------------------------------------------------------------
   表单、关联条目、引用情报三块都由 ZoneEditor 负责，
   这里只管验证、按钮和成功后的跳转。
   ============================================================ */
(function () {
  "use strict";

  var gateSection = document.getElementById("gateSection");
  var formSection = document.getElementById("formSection");
  var doneSection = document.getElementById("doneSection");
  var doneText = document.getElementById("doneText");
  var doneView = document.getElementById("doneView");
  var submitBtn = document.getElementById("submitBtn");

  var editor = null;

  function showForm() {
    gateSection.hidden = true;
    formSection.hidden = false;

    editor = window.ZoneEditor.mount(document.getElementById("editorMount"), { mode: "create" });
    editor.form.el.title.focus();
  }

  window.GuiGate.require(document.getElementById("gateMount"), {
    cancelHref: "edit-zones.html",
    failHref: "edit-zones.html",
    onPass: showForm
  });

  document.getElementById("cancelBtn").addEventListener("click", function () {
    location.href = "edit-zones.html";
  });

  submitBtn.addEventListener("click", function () {
    if (!editor) return;

    submitBtn.disabled = true;
    submitBtn.textContent = "正在保存…";

    editor.save().then(function (zone) {
      formSection.hidden = true;
      doneSection.hidden = false;
      doneText.textContent = "「" + zone.title + "」已写入档案。";
      doneView.href = "zone.html?id=" + encodeURIComponent(zone.id);
      window.scrollTo(0, 0);
    }).catch(function (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = "确认";
      if (err && err.message && err.message !== "校验未通过") {
        editor.form.showError("保存失败：" + err.message);
      }
    });
  });
})();

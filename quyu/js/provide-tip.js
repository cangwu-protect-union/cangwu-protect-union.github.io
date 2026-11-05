/* ============================================================
   provide-tip.js —— 访客投稿：不需要组织验证
   ------------------------------------------------------------
   表单字段来自 ZoneData，写入 gui_zone_tips 表（开放写入）。
   失败时把内容留在页面上并提示原因，不清空输入。
   ============================================================ */
(function () {
  "use strict";

  var formSection = document.getElementById("formSection");
  var doneSection = document.getElementById("doneSection");
  var submitBtn = document.getElementById("submitBtn");
  var formEl = document.getElementById("tipForm");

  var form = window.ZoneForm.mount(document.getElementById("formMount"), { mode: "tip" });

  document.getElementById("cancelBtn").addEventListener("click", function () {
    location.href = "quyu.html";
  });

  formEl.addEventListener("submit", function (ev) {
    ev.preventDefault();

    var problems = form.validate();
    if (problems.length) { form.showError(problems.join("；")); return; }

    var values = form.collect();
    form.showError("");
    submitBtn.disabled = true;
    submitBtn.textContent = "正在提交…";

    window.ZoneData.addTip({
      id: "zt-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7),
      title: values.title,
      lng: values.lng,
      lat: values.lat,
      image: values.image,
      images: values.images,
      thumbs: values.thumbs,
      intro: values.intro,
      body: values.body,
      tags: values.tags,
      date: values.date
    }).then(function () {
      formSection.hidden = true;
      doneSection.hidden = false;
      window.scrollTo(0, 0);
    }).catch(function (err) {
      form.showError("提交失败：" + (err.message || "请稍后重试"));
      submitBtn.disabled = false;
      submitBtn.textContent = "提交";
    });
  });
})();

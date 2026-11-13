/* ============================================================
   provide-tip.js —— 投稿页
   ------------------------------------------------------------
   公开提交，不需要组织验证。图片在这里上传；图片上传没完成时
   不允许提交，避免存进半截数据。
   ============================================================ */
(function () {
  "use strict";

  var formRoot = document.getElementById("formRoot");
  var submitBtn = document.getElementById("submitBtn");
  var statusEl = document.getElementById("submitStatus");
  var formSection = document.getElementById("tipForm");
  var doneSection = document.getElementById("tipDone");
  var introSection = document.getElementById("tipIntro");
  var againBtn = document.getElementById("againBtn");

  var busy = false;

  function mount() {
    window.RpgForm.render(formRoot, {
      value: window.RpgData.emptyCharacter(),
      imagesEditable: true,
      showAuthor: true
    });
    window.RpgForm.showProblems(formRoot, []);
    statusEl.textContent = "";
    submitBtn.disabled = false;
    submitBtn.textContent = "提交投稿";
  }

  function fail(text) {
    statusEl.textContent = text;
    submitBtn.disabled = false;
    submitBtn.textContent = "提交投稿";
  }

  submitBtn.addEventListener("click", function () {
    if (busy) return;

    var value = window.RpgForm.read(formRoot);
    var problems = window.RpgData.validateCharacter(value, {});

    if (!problems.length && formRoot.__rpg && formRoot.__rpg.uploading) {
      window.RpgForm.showProblems(formRoot, []);
      statusEl.textContent = "图片还在上传，稍等一下再提交。";
      return;
    }

    if (problems.length) {
      window.RpgForm.showProblems(formRoot, problems);
      formRoot.scrollIntoView({ behavior: "smooth", block: "start" });
      statusEl.textContent = "还有 " + problems.length + " 处需要处理。";
      return;
    }

    window.RpgForm.showProblems(formRoot, []);

    busy = true;
    submitBtn.disabled = true;
    submitBtn.textContent = "提交中…";
    statusEl.textContent = "";

    window.RpgData.addSubmission(value).then(function () {
      busy = false;
      introSection.hidden = true;
      formSection.hidden = true;
      doneSection.hidden = false;
      window.scrollTo(0, 0);
    }).catch(function (err) {
      busy = false;
      fail("提交失败：" + err.message);
    });
  });

  againBtn.addEventListener("click", function () {
    doneSection.hidden = true;
    introSection.hidden = false;
    formSection.hidden = false;
    mount();
    window.scrollTo(0, 0);
  });

  mount();
})();

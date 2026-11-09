/* ============================================================
   suggest.js —— 访客提交站点建议
   ------------------------------------------------------------
   不需要组织验证，写入 site_suggestions 表。
   字数按字符计（Array.from），与数据库的 char_length 一致；
   浏览器的 maxlength 按 UTF-16 计，只会更严，不会放过超长。
   失败时内容留在页面上，不清空输入。
   ============================================================ */
(function () {
  "use strict";

  var D = window.SiteSuggest;

  var formSection = document.getElementById("formSection");
  var doneSection = document.getElementById("doneSection");
  var formEl = document.getElementById("suggestForm");
  var kindEl = document.getElementById("fKind");
  var titleEl = document.getElementById("fTitle");
  var bodyEl = document.getElementById("fBody");
  var trapEl = document.getElementById("fWebsite");
  var errorEl = document.getElementById("formError");
  var submitBtn = document.getElementById("submitBtn");
  var titleCount = document.getElementById("titleCount");
  var bodyCount = document.getElementById("bodyCount");

  function charLen(value) {
    return Array.from(String(value || "")).length;
  }

  function paintCounts() {
    titleCount.textContent = charLen(titleEl.value) + "/" + D.TITLE_MAX;
    bodyCount.textContent = charLen(bodyEl.value) + "/" + D.BODY_MAX;
  }

  function showError(text) {
    errorEl.textContent = text || "";
    errorEl.hidden = !text;
  }

  function validate() {
    var problems = [];

    if (D.KIND_ORDER.indexOf(kindEl.value) === -1) {
      problems.push("请选择类型");
    }

    var title = titleEl.value.trim();
    if (!title) {
      problems.push("请填写标题");
    } else if (charLen(title) > D.TITLE_MAX) {
      problems.push("标题不超过 " + D.TITLE_MAX + " 字");
    }

    var body = bodyEl.value.trim();
    if (!body) {
      problems.push("请填写正文");
    } else if (charLen(body) > D.BODY_MAX) {
      problems.push("正文不超过 " + D.BODY_MAX + " 字");
    }

    return problems;
  }

  function showDone() {
    formSection.hidden = true;
    doneSection.hidden = false;
    window.scrollTo(0, 0);
  }

  function resetForm() {
    formEl.reset();
    paintCounts();
    showError("");
    submitBtn.disabled = false;
    submitBtn.textContent = "提交建议";
    formSection.hidden = false;
    doneSection.hidden = true;
    window.scrollTo(0, 0);
  }

  function submitErrorMessage(err) {
    var msg = String((err && (err.body || err.message)) || "");

    if (/rate_limited/.test(msg)) return "提交太频繁，请稍后再试。";
    if (/超时/.test(msg)) return "网络超时，请检查网络后重试。";
    if (/42501|row-level security|violates/i.test(msg)) {
      return "提交失败，请检查字数与类型后重试。";
    }
    return "提交失败，请稍后再试。";
  }

  kindEl.addEventListener("change", function () { showError(""); });
  titleEl.addEventListener("input", paintCounts);
  bodyEl.addEventListener("input", paintCounts);

  formEl.addEventListener("submit", function (ev) {
    ev.preventDefault();

    /* 蜜罐：机器人会填、真人看不到。填了就当作成功，不写数据库。 */
    if (trapEl.value.trim() !== "") {
      showDone();
      return;
    }

    var problems = validate();
    if (problems.length) {
      showError(problems.join("；"));
      return;
    }

    showError("");
    submitBtn.disabled = true;
    submitBtn.textContent = "提交中…";

    D.add({
      id: D.newId(),
      kind: kindEl.value,
      title: titleEl.value.trim(),
      body: bodyEl.value.trim()
    }).then(function () {
      showDone();
    }).catch(function (err) {
      showError(submitErrorMessage(err));
      submitBtn.disabled = false;
      submitBtn.textContent = "提交建议";
    });
  });

  document.getElementById("cancelBtn").addEventListener("click", function () {
    location.href = "../projects.html";
  });

  document.getElementById("againBtn").addEventListener("click", resetForm);

  paintCounts();
})();

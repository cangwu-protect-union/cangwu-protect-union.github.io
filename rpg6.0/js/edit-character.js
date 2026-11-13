/* ============================================================
   edit-character.js —— 角色编辑器 / 审核转正表单
   ------------------------------------------------------------
   两种模式：
     ?id=<角色 id>        编辑已有角色（保存前先归档旧内容）
     ?submission=<投稿 id>  审核转正（保存 = 建角色 + 改投稿状态）

   图片在这两个模式里都是只读的：图片只能随投稿进入系统。
   ============================================================ */
(function () {
  "use strict";

  var params = new URLSearchParams(location.search);
  var characterId = params.get("id") || "";
  var submissionId = params.get("submission") || "";
  var mode = submissionId ? "review" : "edit";

  var gateSection = document.getElementById("gateSection");
  var gateMount = document.getElementById("gateMount");
  var editSection = document.getElementById("editSection");
  var formRoot = document.getElementById("formRoot");
  var pageTitle = document.getElementById("pageTitle");
  var pageLead = document.getElementById("pageLead");
  var backLink = document.getElementById("backLink");
  var editFooter = document.getElementById("editFooter");
  var reviewFooter = document.getElementById("reviewFooter");
  var operatorSel = document.getElementById("operatorSel");
  var saveBtn = document.getElementById("saveBtn");
  var deleteBtn = document.getElementById("deleteBtn");
  var reviewerSel = document.getElementById("reviewerSel");
  var markSel = document.getElementById("markSel");
  var reviewNote = document.getElementById("reviewNote");
  var approveBtn = document.getElementById("approveBtn");
  var statusEl = document.getElementById("editStatus");

  var original = null;
  var busy = false;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function setStatus(text) {
    statusEl.hidden = !text;
    statusEl.textContent = text || "";
  }

  function fail(title, text) {
    editSection.hidden = false;
    gateSection.hidden = true;
    pageTitle.textContent = title;
    pageLead.textContent = text || "";
    formRoot.innerHTML = "";
    editFooter.hidden = true;
    reviewFooter.hidden = true;
  }

  function fillOperators() {
    window.RpgForm.fillMembers(operatorSel, "请选择保存人");
  }

  function bindSave() {
    fillOperators();

    saveBtn.addEventListener("click", function () {
      if (busy || !original) return;

      var value = window.RpgForm.read(formRoot);
      var check = {};
      for (var k in value) check[k] = value[k];
      check.operator = operatorSel.value;

      var problems = window.RpgData.validateCharacter(check, { requireOperator: true });
      if (problems.length) {
        window.RpgForm.showProblems(formRoot, problems);
        formRoot.scrollIntoView({ behavior: "smooth", block: "start" });
        setStatus("还有 " + problems.length + " 处需要处理。");
        return;
      }

      window.RpgForm.showProblems(formRoot, []);
      busy = true;
      saveBtn.disabled = true;
      saveBtn.textContent = "保存中…";
      setStatus("");

      window.RpgData.archiveVersion(original, "edit").then(function () {
        return window.RpgData.updateCharacter(original.id, value, operatorSel.value);
      }).then(function () {
        location.href = "edit-characters.html";
      }).catch(function (err) {
        busy = false;
        saveBtn.disabled = false;
        saveBtn.textContent = "保存";
        setStatus("保存失败：" + err.message);
      });
    });
  }

  function bindDelete() {
    deleteBtn.hidden = false;
    deleteBtn.addEventListener("click", function () {
      if (busy || !original) return;

      window.RpgForm.dialog({
        title: "删除角色",
        text: "删除后这条档案从公开列表消失，同时把当前内容存入旧档案，可以恢复。",
        needOperator: true,
        confirmText: "确认删除",
        danger: true
      }).then(function (result) {
        if (!result) return;
        busy = true;
        setStatus("正在删除…");

        window.RpgData.archiveVersion(original, "delete").then(function () {
          return window.RpgData.softDelete(original.id, result.operator);
        }).then(function () {
          location.href = "edit-characters.html";
        }).catch(function (err) {
          busy = false;
          setStatus("删除失败：" + err.message);
        });
      });
    });
  }

  function bindApprove() {
    window.RpgForm.fillMembers(reviewerSel, "请选择审核人");
    window.RpgForm.fillMarks(markSel);

    approveBtn.addEventListener("click", function () {
      if (busy) return;

      var value = window.RpgForm.read(formRoot);
      var check = {};
      for (var k in value) check[k] = value[k];
      check.reviewer = reviewerSel.value;
      check.review_mark = markSel.value;
      check.review_note = reviewNote.value;

      var problems = window.RpgData.validateCharacter(check, { requireReview: true });
      if (problems.length) {
        window.RpgForm.showProblems(formRoot, problems);
        formRoot.scrollIntoView({ behavior: "smooth", block: "start" });
        setStatus("还有 " + problems.length + " 处需要处理。");
        return;
      }

      window.RpgForm.showProblems(formRoot, []);
      busy = true;
      approveBtn.disabled = true;
      approveBtn.textContent = "保存中…";
      setStatus("");

      window.RpgData.approveSubmission(
        submissionId, value, reviewerSel.value, markSel.value, reviewNote.value
      ).then(function (result) {
        location.href = "character.html?id=" + encodeURIComponent(result.id);
      }).catch(function (err) {
        busy = false;
        approveBtn.disabled = false;
        approveBtn.textContent = "保存并建立角色";

        if (err && err.partial) {
          setStatus("角色已建立（" + (err.characterId || "") + "），但投稿状态没有更新。" +
            "再点一次保存会跳过建角色，只补状态。");
        } else {
          setStatus("保存失败：" + err.message);
        }
      });
    });
  }

  function initEdit() {
    document.title = "编辑角色 · 回合制正传6.0 · CPU";
    pageTitle.textContent = "编辑角色";
    pageLead.textContent = "改完保存即可；保存前会把当前内容存入旧档案。图片只能随投稿提交，不能在这里修改。";

    window.RpgData.getCharacter(characterId).then(function (item) {
      if (!item) {
        fail("没有找到这条档案", "id=" + characterId);
        return;
      }
      original = item;

      window.RpgForm.render(formRoot, { value: item, imagesEditable: false });
      bindSave();
      bindDelete();
      editFooter.hidden = false;
    });
  }

  function initReview() {
    document.title = "审核转正 · 回合制正传6.0 · CPU";
    pageTitle.textContent = "审核转正";
    pageLead.textContent = "下面是投稿内容，可以直接修改。保存后会建立角色；修改不会写回投稿。";
    backLink.href = "review.html";
    backLink.textContent = "← 返回投稿审核";

    window.RpgData.getSubmission(submissionId).then(function (item) {
      if (!item) {
        fail("没有找到这条投稿", "它可能已被删除，或当前身份无权读取。");
        return;
      }
      if (item.status !== "pending") {
        fail("这条投稿已处理", "当前状态：" + (window.RpgData.STATUS_TEXT[item.status] || item.status));
        return;
      }
      original = item;

      window.RpgForm.render(formRoot, { value: item, imagesEditable: false });
      bindApprove();
      reviewFooter.hidden = false;
    }).catch(function (err) {
      fail("载入失败", err.message);
    });
  }

  if (!characterId && !submissionId) {
    gateSection.hidden = true;
    fail("缺少参数", "这个页面需要 ?id= 或 ?submission=。");
    return;
  }

  window.GuiGate.require(gateMount, {
    cancelHref: mode === "review" ? "review.html" : "edit-characters.html",
    failHref: mode === "review" ? "review.html" : "edit-characters.html",
    onPass: function () {
      gateSection.hidden = true;
      editSection.hidden = false;
      if (mode === "review") initReview();
      else initEdit();
    }
  });
})();

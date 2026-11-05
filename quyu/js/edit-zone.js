/* ============================================================
   edit-zone.js —— 编辑单个区域
   ------------------------------------------------------------
   保存顺序：先把当前内容归档进版本表，再写新内容。
   删除只打 deleted 标记，同时归档一份，随时能恢复。
   关联与引用在 ZoneEditor 里改，保存时一并写入。
   ============================================================ */
(function () {
  "use strict";

  var gateSection = document.getElementById("gateSection");
  var editSection = document.getElementById("editSection");
  var editTitle = document.getElementById("editTitle");
  var editSub = document.getElementById("editSub");
  var viewLink = document.getElementById("viewLink");
  var historyLink = document.getElementById("historyLink");
  var saveError = document.getElementById("saveError");
  var saveBtn = document.getElementById("saveBtn");
  var deleteBtn = document.getElementById("deleteBtn");
  var restoreBtn = document.getElementById("restoreBtn");

  var editor = null;
  var current = null;
  var zoneId = new URLSearchParams(location.search).get("id");

  function showError(text) {
    saveError.textContent = text || "";
    saveError.hidden = !text;
  }

  function render() {
    editSection.hidden = false;
    editTitle.textContent = current.title;
    editSub.textContent = current.deleted
      ? "这个区域已被删除，可以恢复。"
      : (current.date ? "记录日期 " + current.date : "");
    viewLink.href = "zone.html?id=" + encodeURIComponent(current.id);
    historyLink.href = "old-zone.html?id=" + encodeURIComponent(current.id);

    editor = window.ZoneEditor.mount(document.getElementById("editorMount"), {
      mode: "edit",
      zone: current
    });

    if (current.deleted) {
      Array.prototype.forEach.call(
        document.querySelectorAll("#editorMount input, #editorMount textarea, #editorMount button"),
        function (n) { n.disabled = true; }
      );
      saveBtn.hidden = true;
      deleteBtn.hidden = true;
      restoreBtn.hidden = false;
    }
  }

  function load() {
    if (!zoneId) {
      editSection.hidden = false;
      editTitle.textContent = "打不开这个区域";
      editSub.textContent = "链接里没有带区域编号。";
      return;
    }

    window.ZoneData.getEntryAny(zoneId).then(function (zone) {
      if (!zone) {
        editSection.hidden = false;
        editTitle.textContent = "打不开这个区域";
        editSub.textContent = "没有这个区域，可能已被彻底移除。";
        return;
      }
      current = zone;
      render();
    }).catch(function (err) {
      editSection.hidden = false;
      editTitle.textContent = "打不开这个区域";
      editSub.textContent = "读取失败：" + (err.message || "请稍后重试");
    });
  }

  window.GuiGate.require(document.getElementById("gateMount"), {
    cancelHref: "edit-zones.html",
    failHref: "edit-zones.html",
    onPass: function () {
      gateSection.hidden = true;
      load();
    }
  });

  document.getElementById("cancelBtn").addEventListener("click", function () {
    location.href = "edit-zones.html";
  });

  saveBtn.addEventListener("click", function () {
    if (!editor || !current) return;

    showError("");
    saveBtn.disabled = true;
    saveBtn.textContent = "正在保存…";

    editor.save().then(function (saved) {
      return window.ZoneData.getEntryAny(saved.id);
    }).then(function (fresh) {
      current = fresh || current;
      saveBtn.disabled = false;
      saveBtn.textContent = "保存";
      showError("");
      editSub.textContent = "已保存。" + (current.deleted ? "（已删除）" : "");
    }).catch(function (err) {
      saveBtn.disabled = false;
      saveBtn.textContent = "保存";
      if (err && err.message && err.message !== "校验未通过") {
        showError("保存失败：" + err.message);
      }
    });
  });

  deleteBtn.addEventListener("click", function () {
    if (!current) return;
    if (!confirm("删除「" + current.title + "」？\n\n删除只是打标记，内容和版本都会留在历史里，可以恢复。")) return;

    showError("");
    deleteBtn.disabled = true;

    window.ZoneData.archiveVersion(current, "delete").then(function () {
      return window.ZoneData.softDelete(current.id);
    }).then(function () {
      current.deleted = true;
      render();
    }).catch(function (err) {
      showError("删除失败：" + (err.message || "请稍后重试"));
      deleteBtn.disabled = false;
    });
  });

  restoreBtn.addEventListener("click", function () {
    if (!current) return;
    showError("");
    restoreBtn.disabled = true;

    window.ZoneData.restoreEntry(current.id).then(function () {
      return window.ZoneData.getEntryAny(current.id);
    }).then(function (fresh) {
      current = fresh || current;
      render();
    }).catch(function (err) {
      showError("恢复失败：" + (err.message || "请稍后重试"));
      restoreBtn.disabled = false;
    });
  });
})();

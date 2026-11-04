/* ============================================================
   edit-zone.js —— 编辑单个区域
   ------------------------------------------------------------
   保存顺序：先把当前内容归档进版本表，再写新内容。
   删除只打 deleted 标记，同时归档一份，随时能恢复。
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
  var formEl = document.getElementById("zoneForm");

  var form = null;
  var current = null;
  var zoneId = new URLSearchParams(location.search).get("id");

  function fail(msg) {
    editSection.hidden = false;
    formEl.hidden = true;
    editTitle.textContent = "打不开这个区域";
    editSub.textContent = msg;
  }

  function showError(text) {
    saveError.textContent = text || "";
    saveError.hidden = !text;
  }

  function render() {
    editSection.hidden = false;
    editTitle.textContent = current.title;
    editSub.textContent = current.deleted ? "这个区域已被删除，可以恢复。" : "编号 " + current.id;
    viewLink.href = "zone.html?id=" + encodeURIComponent(current.id);
    historyLink.href = "old-zone.html?id=" + encodeURIComponent(current.id);

    form = window.ZoneForm.mount(document.getElementById("formMount"), {
      mode: "edit",
      value: current
    });

    /* 已删除的区域不允许继续编辑内容，只留「恢复」 */
    var locked = !!current.deleted;
    formEl.querySelectorAll("input, textarea, select, button[type=button]").forEach(function (n) {
      if (n.id === "restoreBtn" || n.id === "cancelBtn") return;
      if (n.closest(".thumbs") || n.classList.contains("thumb-del")) return;
      n.disabled = locked;
    });
    saveBtn.hidden = locked;
    deleteBtn.hidden = locked;
    restoreBtn.hidden = !locked;

    if (locked) editSub.textContent += " 恢复后才能继续编辑。";
  }

  function load() {
    if (!zoneId) { fail("链接里没有带区域编号。"); return; }

    window.ZoneData.getEntryAny(zoneId).then(function (zone) {
      if (!zone) { fail("没有这个区域，可能编号写错了。"); return; }
      current = zone;
      render();
    }).catch(function (err) {
      fail("读取失败：" + (err.message || "请稍后重试"));
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

  formEl.addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (!form || !current) return;

    var problems = form.validate();
    if (problems.length) { showError(problems.join("；")); return; }

    var values = form.collect();
    showError("");
    saveBtn.disabled = true;
    saveBtn.textContent = "正在保存…";

    /* 先归档旧内容，再写新的 */
    window.ZoneData.archiveVersion(current, "edit").then(function () {
      values.id = current.id;
      return window.ZoneData.updateEntry(values);
    }).then(function () {
      saveBtn.textContent = "已保存";
      return window.ZoneData.getEntryAny(current.id);
    }).then(function (fresh) {
      current = fresh || current;
      form.setValue(current);
      saveBtn.disabled = false;
      saveBtn.textContent = "保存";
      editSub.textContent = "已保存。" + (current.deleted ? "（已删除）" : "");
    }).catch(function (err) {
      showError("保存失败：" + (err.message || "请稍后重试"));
      saveBtn.disabled = false;
      saveBtn.textContent = "保存";
    });
  });

  deleteBtn.addEventListener("click", function () {
    if (!current) return;
    if (!confirm("删除「" + current.title + "」？\n\n删除只是打标记，内容和版本都会留在旧档案里，可以恢复。")) return;

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
      current.deleted = false;
      render();
    }).catch(function (err) {
      showError("恢复失败：" + (err.message || "请稍后重试"));
      restoreBtn.disabled = false;
    });
  });
})();

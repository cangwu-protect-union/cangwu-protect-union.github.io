/* ============================================================
   edit-entry.js —— 编辑单个条目
   ------------------------------------------------------------
   能做的事：
     · 改标题 / 标签
     · 文段：逐段编辑、单独删除、追加新段
     · 图片：追加（上传）、单独移除
     · 删除整条条目（软删除，内容进旧图鉴）

   两个破坏性操作（确认 / 删除）都会先用 GuiGate.ask() 再次验证身份；
   验证不通过就退回项目界面，什么都不改。
   ============================================================ */
(function () {
  "use strict";

  var loadingEl  = document.getElementById("loading");
  var editArea   = document.getElementById("editArea");
  var notFoundEl = document.getElementById("notFound");
  var paraList   = document.getElementById("paraList");
  var imgList    = document.getElementById("imgList");
  var imgFile    = document.getElementById("imgFile");
  var imgStatus  = document.getElementById("imgStatus");
  var formError  = document.getElementById("formError");

  var entry = null;          /* 原始条目（用于存档旧版本） */
  var images = [];           /* 当前图片地址数组，编辑中 */
  var busy = false;

  var id = new URLSearchParams(location.search).get("id");

  /* ---------- 小工具 ---------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function fail(msg) {
    formError.textContent = msg;
    formError.hidden = false;
  }
  function clearFail() { formError.hidden = true; }

  /* ---------- 文段编辑区 ---------- */
  function addPara(value) {
    var row = document.createElement("div");
    row.className = "para-row";
    row.innerHTML =
      '<textarea rows="3" placeholder="这一段的内容…">' + esc(value || "") + "</textarea>" +
      '<button type="button" class="para-del" title="删除这一段">×</button>';
    row.querySelector(".para-del").addEventListener("click", function () {
      row.remove();
      renumber();
    });
    paraList.appendChild(row);
    renumber();
  }

  /* 空的时候提示一下，顺便保持顺序感 */
  function renumber() {
    var rows = paraList.querySelectorAll(".para-row");
    for (var i = 0; i < rows.length; i++) {
      var btn = rows[i].querySelector(".para-del");
      if (btn) btn.style.visibility = rows.length === 1 ? "hidden" : "visible";
    }
  }

  function collectParagraphs() {
    var out = [];
    var areas = paraList.querySelectorAll(".para-row textarea");
    for (var i = 0; i < areas.length; i++) {
      var v = areas[i].value.trim();
      if (v !== "") out.push(v);
    }
    return out;
  }

  /* ---------- 图片编辑区 ---------- */
  function renderImages() {
    if (!images.length) { imgList.innerHTML = ""; imgList.hidden = true; return; }
    imgList.hidden = false;
    imgList.innerHTML = images.map(function (u, i) {
      return '<div class="thumb thumb-done" data-i="' + i + '">' +
               '<img src="' + esc(u) + '" alt="">' +
               '<button type="button" class="thumb-del" data-del="' + i + '" title="移除">×</button>' +
             "</div>";
    }).join("");
  }

  imgList.addEventListener("click", function (e) {
    var d = e.target.getAttribute && e.target.getAttribute("data-del");
    if (d === null || d === undefined) return;
    var i = parseInt(d, 10);
    if (!isNaN(i)) { images.splice(i, 1); renderImages(); }
  });

  document.getElementById("addImgBtn").addEventListener("click", function () { imgFile.click(); });

  imgFile.addEventListener("change", function () {
    var files = Array.prototype.slice.call(imgFile.files || []);
    imgFile.value = "";
    if (!files.length) return;

    var pending = files.length;
    imgStatus.textContent = "正在上传 " + pending + " 张…";
    imgStatus.className = "img-status muted";

    files.forEach(function (f) {
      window.GuiUpload.uploadFile(f).then(function (url) {
        images.push(url);
        renderImages();
      }).catch(function (err) {
        imgStatus.textContent = "有图片上传失败：" + err.message;
        imgStatus.className = "img-status is-error";
      }).then(function () {
        pending--;
        if (pending === 0 && !/失败/.test(imgStatus.textContent)) {
          imgStatus.textContent = "已上传";
          imgStatus.className = "img-status is-done";
        }
      });
    });
  });

  /* ---------- 载入条目 ---------- */
  window.GuiData.listAll().then(function (rows) {
    entry = rows.filter(function (r) { return r.id === id; })[0];

    if (!entry) {
      loadingEl.hidden = true;
      notFoundEl.hidden = false;
      return;
    }
    if (entry.deleted) {
      loadingEl.hidden = true;
      notFoundEl.hidden = false;
      return;
    }

    document.getElementById("fTitle").value = entry.title || "";
    document.getElementById("fTags").value = (entry.tags || []).join(", ");
    images = window.guiImagesFor(entry).slice();
    renderImages();

    var paras = String(entry.body || "").split(/\n+/).filter(function (p) { return p.trim() !== ""; });
    if (!paras.length) paras = [""];
    paras.forEach(function (p) { addPara(p); });

    loadingEl.hidden = true;
    editArea.hidden = false;
  }).catch(function () {
    loadingEl.hidden = true;
    notFoundEl.hidden = false;
  });

  document.getElementById("addParaBtn").addEventListener("click", function () {
    addPara("");
    var areas = paraList.querySelectorAll("textarea");
    if (areas.length) areas[areas.length - 1].focus();
  });

  /* ---------- 取消：什么都不改 ---------- */
  document.getElementById("cancelBtn").addEventListener("click", function () {
    location.href = "edit-gui.html";
  });

  /* ---------- 确认：验证身份 → 存档旧版 → 保存 ---------- */
  document.getElementById("saveBtn").addEventListener("click", function () {
    if (busy) return;
    clearFail();

    var title = document.getElementById("fTitle").value.trim();
    if (!title) { fail("标题不能为空。"); return; }

    var paras = collectParagraphs();
    if (!paras.length) { fail("至少要有一段正文。"); return; }

    var tags = document.getElementById("fTags").value
      .split(/[,，]/).map(function (s) { return s.trim(); })
      .filter(function (s) { return s !== ""; });

    var body = paras.join("\n\n");
    var intro = body.replace(/\s+/g, " ").slice(0, 90);
    if (body.replace(/\s+/g, " ").length > 90) intro += "…";

    var updated = {
      id: entry.id,
      title: title,
      image: images[0] || "",
      images: images,
      intro: intro,
      body: body,
      tags: tags,
      date: entry.date
    };

    window.GuiGate.ask({
      message: "确认修改后，当前版本会存入「旧图鉴」，改后的内容替换展示。请再次验证身份。"
    }).then(function (ok) {
      if (!ok) { location.href = "projects.html"; return; }

      busy = true;
      var btn = document.getElementById("saveBtn");
      btn.disabled = true;
      btn.textContent = "保存中…";

      /* 先存档旧版本，再保存新内容 */
      window.GuiData.archiveVersion(entry, "edit").then(function () {
        return window.GuiData.updateEntry(updated);
      }).then(function () {
        location.href = "edit-gui.html";
      }).catch(function (err) {
        busy = false;
        btn.disabled = false;
        btn.textContent = "确认";
        fail("保存失败：" + err.message);
      });
    });
  });

  /* ---------- 删除条目：确认 → 验证 → 存档 → 软删除 ---------- */
  document.getElementById("deleteBtn").addEventListener("click", function () {
    if (busy) return;
    clearFail();

    if (!window.confirm("确定要删除条目「" + entry.title + "」吗？\n\n删除后它不再显示在图鉴里，但旧内容会存进「旧图鉴」，以后可以恢复。")) {
      return;   /* 取消：什么都不做 */
    }

    window.GuiGate.ask({
      message: "确认删除条目「" + entry.title + "」？内容会存入「旧图鉴」，之后可以恢复。请再次验证身份。"
    }).then(function (ok) {
      if (!ok) { location.href = "projects.html"; return; }

      busy = true;
      var btn = document.getElementById("deleteBtn");
      btn.disabled = true;
      btn.textContent = "删除中…";

      window.GuiData.archiveVersion(entry, "delete").then(function () {
        return window.GuiData.softDelete(entry.id);
      }).then(function () {
        location.href = "edit-gui.html";
      }).catch(function (err) {
        busy = false;
        btn.disabled = false;
        btn.textContent = "删除条目";
        fail("删除失败：" + err.message);
      });
    });
  });
})();
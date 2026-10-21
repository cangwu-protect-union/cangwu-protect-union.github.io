/* ============================================================
   add-gui.js —— 增加条目（表单 + 多图上传）
   ------------------------------------------------------------
   组织验证交给共享的 js/gui-gate.js 处理：
   本会话已验证过就直接进表单，没验证过才显示题目。
   ============================================================ */
(function () {
  "use strict";

  var gateSection = document.getElementById("gateSection");
  var gateMount   = document.getElementById("gateMount");
  var formSection = document.getElementById("formSection");
  var doneSection = document.getElementById("doneSection");
  var entryForm   = document.getElementById("entryForm");
  var formError   = document.getElementById("formError");

  /* ---------- 组织验证 ----------
     用共享的 GuiGate：如果本会话已经验证过（比如从编辑图鉴点进来），
     这里会直接放行，不会再问一遍。 */
  window.GuiGate.require(gateMount, {
    cancelHref: "edit-gui.html",
    failHref: "edit-gui.html",
    onPass: function () {
      gateSection.hidden = true;
      formSection.hidden = false;
      var t = document.getElementById("fTitle");
      if (t) t.focus();
    }
  });
  /* ---------- 取消 ---------- */
  document.getElementById("cancelBtn").addEventListener("click", function () {
    location.href = "edit-gui.html";
  });

  /* ---------- 提交新条目 ---------- */
  entryForm.addEventListener("submit", function (ev) {
    ev.preventDefault();
    formError.hidden = true;

    var title = document.getElementById("fTitle").value.trim();
    var body  = document.getElementById("fBody").value.trim();
    var media = collectedMedia();
    var images = media.images;
    var tags  = document.getElementById("fTags").value
      .split(/[,，]/).map(function (s) { return s.trim(); })
      .filter(function (s) { return s !== ""; });

    if (anyUploading()) {
      formError.textContent = "还有图片正在上传，请等全部完成后再点确认。";
      formError.hidden = false;
      return;
    }

    var failed = queue.filter(function (i) { return i.status === "error"; });
    if (failed.length) {
      formError.textContent = "有 " + failed.length + " 张图片上传失败，请重试或移除后再提交。";
      formError.hidden = false;
      return;
    }

    if (!title) {
      formError.textContent = "标题不能为空。";
      formError.hidden = false;
      return;
    }
    if (!body) {
      formError.textContent = "正文不能为空。";
      formError.hidden = false;
      return;
    }

    var intro = body.replace(/\s+/g, " ").slice(0, 90);
    if (body.replace(/\s+/g, " ").length > 90) intro += "…";

    var entry = {
      id: window.GuiData.newId(),
      title: title,
      image: images[0] || "",   /* 封面图：第一张，列表页用 */
      images: images,           /* 全部原图：详情页用 */
      thumbs: media.thumbs,     /* 对应缩略图：列表页用 */
      intro: intro,
      body: body,
      tags: tags,
      date: new Date().toISOString().slice(0, 10)
    };

    var submitBtn = entryForm.querySelector('button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "上传中…"; }

    window.GuiData.add(entry).then(function (result) {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "确认"; }

      formSection.hidden = true;
      doneSection.hidden = false;

      var failBox = document.getElementById("failBox");
      var doneText = document.getElementById("doneText");

      if (result.remoteSaved) {
        failBox.hidden = true;
        doneText.textContent = "条目「" + title + "」已上传到云端，所有设备都能看到，可以立即搜索。";
      } else {
        failBox.hidden = false;
        doneText.textContent = "条目「" + title + "」已保存在这台设备上。";
      }

      document.getElementById("doneView").href = "条目.html?id=" + encodeURIComponent(entry.id);
    });
  });

  /* ---------- 复制 JSON：生成完整的 entries.json 内容 ---------- */
  var copyBtn = document.getElementById("copyBtn");
  var copyState = document.getElementById("copyState");

  copyBtn.addEventListener("click", function () {
    copyState.hidden = true;
    Promise.resolve(window.GuiData.readLocal()).then(function (localEntries) {
      var text = JSON.stringify({ entries: localEntries }, null, 2);
      function done(msg, ok) {
        copyState.textContent = msg;
        copyState.hidden = false;
        copyState.className = ok ? "gate-error gate-ok" : "gate-error";
      }

      function fallback() {
        /* 剪贴板 API 不可用时（非 https 或权限被拒），显示一个可选中的文本框 */
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
        document.body.removeChild(ta);

        if (ok) { done("已复制到剪贴板。去 GitHub 粘贴即可。", true); return; }

        /* 真的复制不了：把完整内容放进页面，让用户自己全选复制 */
        var box = document.getElementById("copyManual");
        if (box) { box.value = text; box.hidden = false; box.focus(); box.select(); }
        done("浏览器不允许自动复制。完整内容已显示在下方，请点一下文本框按 Ctrl+A、Ctrl+C。", false);
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          done("已复制 " + text.length + " 个字符到剪贴板。去 GitHub 粘贴即可。", true);
        }).catch(fallback);
      } else {
        fallback();
      }
    }).catch(function (e) {
      copyState.textContent = "生成 JSON 失败：" + e.message;
      copyState.hidden = false;
    });
  });

  /* ============================================================
     多图上传队列
     - 支持多选 / 拖拽 / 粘贴
     - 并发 2 个上传，其余排队
     - 每张单独显示状态，失败可单独重试
     ============================================================ */
  var fileInput   = document.getElementById("fImageFile");
  var pickBtn     = document.getElementById("pickImageBtn");
  var dropzone    = document.getElementById("dropzone");
  var thumbsEl    = document.getElementById("thumbs");
  var imgUrlInput = document.getElementById("fImage");

  var queue = [];              /* { key, name, previewUrl, status, url, error } */
  var seq = 0;
  var running = 0;
  var MAX_CONCURRENT = 2;

  function anyUploading() {
    return queue.some(function (i) { return i.status === "uploading"; });
  }

  function renderThumbs() {
    if (!queue.length) { thumbsEl.innerHTML = ""; thumbsEl.hidden = true; return; }
    thumbsEl.hidden = false;

    thumbsEl.innerHTML = queue.map(function (it) {
      var badge = "";
      if (it.status === "uploading") badge = '<span class="thumb-badge">上传中</span>';
      else if (it.status === "error") badge = '<span class="thumb-badge is-err">失败</span>';

      var retry = it.status === "error"
        ? '<button type="button" class="thumb-retry" data-retry="' + it.key + '">重试</button>'
        : "";

      var src = it.previewUrl || it.url || "";
      return '<div class="thumb thumb-' + it.status + '" data-key="' + it.key + '">' +
               '<img src="' + escAttr(src) + '" alt="">' +
               badge + retry +
               '<button type="button" class="thumb-del" data-del="' + it.key + '" title="移除">×</button>' +
             '</div>';
    }).join("");
  }

  function escAttr(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* 启动队列中还没开始的条目 */
  function pump() {
    while (running < MAX_CONCURRENT) {
      var next = queue.filter(function (i) { return i.status === "waiting"; })[0];
      if (!next) break;
      startUpload(next);
    }
  }

  function startUpload(item) {
    item.status = "uploading";
    item.error = "";
    running++;
    renderThumbs();

    window.GuiUpload.uploadFile(item.file).then(function (res) {
      item.url = res.url;          /* 原图：详情页用 */
      item.thumb = res.thumb;      /* 缩略图：列表页用 */
      item.status = "done";
      /* 上传完成后把预览换成缩略图地址（小，不占内存） */
      if (item.previewUrl && item.previewUrl.indexOf("blob:") === 0) {
        URL.revokeObjectURL(item.previewUrl);
      }
      item.previewUrl = res.thumb || res.url;
    }).catch(function (err) {
      item.status = "error";
      item.error = err.message || "上传失败";
    }).then(function () {
      running--;
      renderThumbs();
      pump();
    });
  }

  function addFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    var added = 0;

    files.forEach(function (f) {
      if (!f) return;
      var isImage = /^image\//.test(f.type) || (window.GuiUpload && window.GuiUpload.looksHeic(f));
      if (!isImage) return;

      var item = {
        key: "img" + (++seq),
        name: f.name || "粘贴的图片",
        file: f,
        /* HEIC 浏览器多半解不了，先不留 blob 预览，等转码后用云端地址 */
        previewUrl: (window.GuiUpload && window.GuiUpload.looksHeic(f))
          ? "" : URL.createObjectURL(f),
        status: "waiting",
        url: "",
        thumb: "",
        error: ""
      };
      queue.push(item);
      added++;
    });

    if (added) {
      renderThumbs();
      pump();
    } else if (files.length) {
      formError.textContent = "选中的文件里没有图片。";
      formError.hidden = false;
      setTimeout(function () { formError.hidden = true; }, 4000);
    }
  }

  /* ---- 点击选择 ---- */
  pickBtn.addEventListener("click", function () { fileInput.click(); });
  fileInput.addEventListener("change", function () {
    addFiles(fileInput.files);
    fileInput.value = "";   /* 允许重复选同一个文件 */
  });

  /* ---- 拖拽 ---- */
  ["dragenter", "dragover"].forEach(function (ev) {
    dropzone.addEventListener(ev, function (e) {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add("is-drag");
    });
  });
  ["dragleave", "drop"].forEach(function (ev) {
    dropzone.addEventListener(ev, function (e) {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove("is-drag");
    });
  });
  dropzone.addEventListener("drop", function (e) {
    var dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length) addFiles(dt.files);
  });

  /* ---- 粘贴（Ctrl+V 直接贴截图） ---- */
  document.addEventListener("paste", function (e) {
    /* 如果焦点在文本框里，粘贴文本是正常操作，不拦截 */
    var el = e.target;
    var typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
    if (typing) {
      /* 但如果是图片，仍然要接管 */
      var items0 = (e.clipboardData && e.clipboardData.items) || [];
      var hasImg = Array.prototype.some.call(items0, function (i) { return /^image\//.test(i.type); });
      if (!hasImg) return;
    }
    if (formSection.hidden) return;   /* 还没通过验证，不响应 */

    var items = (e.clipboardData && e.clipboardData.items) || [];
    var files = [];
    for (var i = 0; i < items.length; i++) {
      if (/^image\//.test(items[i].type)) {
        var f = items[i].getAsFile();
        if (f) {
          /* 粘贴的截图没有文件名，补一个便于识别 */
          if (!f.name) { try { Object.defineProperty(f, "name", { value: "粘贴的截图.png" }); } catch (err) {} }
          files.push(f);
        }
      }
    }
    if (files.length) {
      e.preventDefault();
      addFiles(files);
    }
  });

  /* ---- 缩略图上的删除 / 重试（事件委托） ---- */
  thumbsEl.addEventListener("click", function (e) {
    var delKey = e.target.getAttribute && e.target.getAttribute("data-del");
    if (delKey) {
      queue = queue.filter(function (i) {
        if (i.key === delKey) {
          if (i.previewUrl && i.previewUrl.indexOf("blob:") === 0) URL.revokeObjectURL(i.previewUrl);
          return false;
        }
        return true;
      });
      renderThumbs();
      return;
    }

    var retryKey = e.target.getAttribute && e.target.getAttribute("data-retry");
    if (retryKey) {
      var it = queue.filter(function (i) { return i.key === retryKey; })[0];
      if (it) {
        it.status = "waiting";
        it.error = "";
        renderThumbs();
        pump();
      }
    }
  });

  /* 收集已上传成功的图片地址（按添加顺序）
     返回 { images: 原图数组, thumbs: 缩略图数组 }
     两个数组长度一致、顺序对应；手动粘贴的网址没有缩略图，用空串占位，
     显示时 guiThumbFor() 会自动回退到原图。 */
  function collectedMedia() {
    var done = queue.filter(function (i) { return i.status === "done" && i.url; });
    var images = done.map(function (i) { return i.url; });
    var thumbs = done.map(function (i) { return i.thumb || ""; });

    var manual = imgUrlInput.value.trim();
    if (manual) { images.push(manual); thumbs.push(""); }

    return { images: images, thumbs: thumbs };
  }
})();
/* 增加条目 · 多图上传队列分片
   只往 window.AddGuiPage 挂函数，在 add-gui.js 之前加载。 */
(function () {
  "use strict";
  var P = window.AddGuiPage || (window.AddGuiPage = {});


  P.anyUploading = function () {
    return P.queue.some(function (i) { return i.status === "uploading"; });
  }

  P.renderThumbs = function () {
    /* 图片队列变了就顺手存一次草稿（提供情报模式下才存） */
    P.saveDraft();

    if (!P.queue.length) { P.thumbsEl.innerHTML = ""; P.thumbsEl.hidden = true; return; }
    P.thumbsEl.hidden = false;

    P.thumbsEl.innerHTML = P.queue.map(function (it) {
      var badge = "";
      if (it.status === "uploading") badge = '<span class="thumb-badge">上传中</span>';
      else if (it.status === "error") badge = '<span class="thumb-badge is-err">失败</span>';

      var retry = it.status === "error"
        ? '<button type="button" class="thumb-retry" data-retry="' + it.key + '">重试</button>'
        : "";

      var src = it.previewUrl || it.url || "";
      return '<div class="thumb thumb-' + it.status + '" data-key="' + it.key + '">' +
               '<img src="' + P.escAttr(src) + '" alt="">' +
               badge + retry +
               '<button type="button" class="thumb-del" data-del="' + it.key + '" title="移除">×</button>' +
             '</div>';
    }).join("");
  }

  P.escAttr = function (s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  P.pump = function () {
    while (P.running < P.MAX_CONCURRENT) {
      var next = P.queue.filter(function (i) { return i.status === "waiting"; })[0];
      if (!next) break;
      P.startUpload(next);
    }
  }

  P.startUpload = function (item) {
    item.status = "uploading";
    item.error = "";
    P.running++;
    P.renderThumbs();

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
      P.running--;
      P.renderThumbs();
      P.pump();
    });
  }

  P.addFiles = function (fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    var added = 0;

    files.forEach(function (f) {
      if (!f) return;
      var isImage = /^image\//.test(f.type) || (window.GuiUpload && window.GuiUpload.looksHeic(f));
      if (!isImage) return;

      var item = {
        key: "img" + (++P.seq),
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
      P.queue.push(item);
      added++;
    });

    if (added) {
      P.renderThumbs();
      P.pump();
    } else if (files.length) {
      P.formError.textContent = "选中的文件里没有图片。";
      P.formError.hidden = false;
      setTimeout(function () { P.formError.hidden = true; }, 4000);
    }
  }

  P.collectedMedia = function () {
    var done = P.queue.filter(function (i) { return i.status === "done" && i.url; });
    var images = done.map(function (i) { return i.url; });
    var thumbs = done.map(function (i) { return i.thumb || ""; });

    var manual = P.imgUrlInput.value.trim();
    if (manual) { images.push(manual); thumbs.push(""); }

    return { images: images, thumbs: thumbs };
  }
})();

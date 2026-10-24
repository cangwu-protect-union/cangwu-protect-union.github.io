/* ============================================================
   add-gui.js —— 增加条目 / 提供情报（表单 + 多图上传）
   ------------------------------------------------------------
   同一个脚本服务两个页面，靠 <body data-mode="…"> 区分：
     data-mode="entry"（或不写）→ 增加条目，要组织验证，写入 gui_entries
     data-mode="tip"            → 提供情报，不验证，写入 gui_tips
   「引用情报」只在增加条目模式下可用。
   ============================================================ */
(function () {
  "use strict";

  /* 当前页面是「增加条目」还是「提供情报」 */
  var MODE = (document.body && document.body.getAttribute("data-mode")) || "entry";
  var IS_TIP = (MODE === "tip");

  /* 引用过的情报：[{id, title}]，随条目一起保存 */
  var pickedRefs = [];

  var gateSection = document.getElementById("gateSection");
  var gateMount   = document.getElementById("gateMount");
  var formSection = document.getElementById("formSection");
  var doneSection = document.getElementById("doneSection");
  var entryForm   = document.getElementById("entryForm");
  var formError   = document.getElementById("formError");

  function showForm() {
    if (gateSection) gateSection.hidden = true;
    formSection.hidden = false;
    var t = document.getElementById("fTitle");
    if (t) t.focus();
  }

  if (IS_TIP) {
    /* 投稿开放，不需要组织验证，直接进表单 */
    showForm();
  } else {
    /* 增加条目：用共享的 GuiGate 验证（本会话验过就直接放行） */
    window.GuiGate.require(gateMount, {
      cancelHref: "edit-gui.html",
      failHref: "edit-gui.html",
      onPass: showForm
    });
  }

  /* ---------- 取消 ---------- */
  document.getElementById("cancelBtn").addEventListener("click", function () {
    location.href = IS_TIP ? "projects.html" : "edit-gui.html";
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
      date: new Date().toISOString().slice(0, 10),
      refs: pickedRefs          /* 引用过的情报 [{id,title}]，仅增加条目模式会有 */
    };

    var submitBtn = entryForm.querySelector('button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "上传中…"; }

    /* 情报提交到 gui_tips，条目提交到 gui_entries */
    var savePromise;
    if (IS_TIP) {
      savePromise = window.GuiData.addTip(entry).then(function () {
        return { remoteSaved: true, error: null };
      }).catch(function (err) {
        return { remoteSaved: false, error: err.message };
      });
    } else {
      savePromise = window.GuiData.add(entry);
    }

    savePromise.then(function (result) {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "确认"; }

      formSection.hidden = true;
      doneSection.hidden = false;

      var failBox = document.getElementById("failBox");
      var doneText = document.getElementById("doneText");

      if (IS_TIP) {
        /* 情报没有本地兜底：上传失败就直接告诉用户重试 */
        if (result.remoteSaved) {
          clearDraft();   /* 提交成功，草稿没用了 */
          doneText.textContent = "情报「" + title + "」已提交。成员可以在「查看情报」里看到它。";
        } else {
          doneText.textContent = "提交失败：" + (result.error || "云端没有响应") + "。请稍后重试。";
        }
        document.getElementById("doneView").href = "tips-entry.html?id=" + encodeURIComponent(entry.id);
      } else {
        if (result.remoteSaved) {
          clearDraft();   /* 已经存进云端，草稿没用了 */
          if (failBox) failBox.hidden = true;
          doneText.textContent = "条目「" + title + "」已上传到云端，所有设备都能看到，可以立即搜索。";
        } else {
          if (failBox) failBox.hidden = false;
          doneText.textContent = "条目「" + title + "」已保存在这台设备上。";
        }
        document.getElementById("doneView").href = "条目.html?id=" + encodeURIComponent(entry.id);
      }
    });
  });

  /* ---------- 复制 JSON：生成完整的 entries.json 内容 ---------- */
  var copyBtn = document.getElementById("copyBtn");
  var copyState = document.getElementById("copyState");

  /* 提供情报页没有这段兜底（情报必须上云才有意义），所以要做存在性判断 */
  if (copyBtn) copyBtn.addEventListener("click", function () {
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
    /* 图片队列变了就顺手存一次草稿（提供情报模式下才存） */
    saveDraft();

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

  /* ============================================================
     引用情报
     ------------------------------------------------------------
     流程：
       1. 点「引用情报」→ 跳到 pick-tips.html 勾选
       2. pick-tips 把选中的情报写进 sessionStorage（gui_picked_tips）
       3. 回到本页时读取它，把正文 / 图片 / 标签追加到表单，
          并记下引用关系（refs），随条目一起保存
     ============================================================ */

  var PICK_KEY = "gui_picked_tips";

  var pickTipsBtn = document.getElementById("pickTipsBtn");
  if (pickTipsBtn) {
    pickTipsBtn.addEventListener("click", function () {
      location.href = "pick-tips.html?back=" + encodeURIComponent("add-gui.html");
    });
  }

  /* 把引用来的情报合并进表单 */
  function applyPickedTips() {
    var raw = null;
    try { raw = sessionStorage.getItem(PICK_KEY); } catch (e) { return; }
    if (!raw) return;

    /* 立刻清掉，避免下次再进来重复追加 */
    try { sessionStorage.removeItem(PICK_KEY); } catch (e) {}

    var picks;
    try { picks = JSON.parse(raw); } catch (e) { return; }
    if (!Array.isArray(picks) || !picks.length) return;

    pickedRefs = picks.map(function (p) { return { id: p.id, title: p.title }; });

    /* --- 正文：按情报顺序追加段落 --- */
    var bodyEl = document.getElementById("fBody");
    var extra = picks.map(function (p) { return (p.body || "").trim(); })
                     .filter(function (s) { return s !== ""; });
    if (extra.length && bodyEl) {
      var cur = bodyEl.value.trim();
      bodyEl.value = (cur ? cur + "\n\n" : "") + extra.join("\n\n");
    }

    /* --- 图片：直接放进队列，标记为已完成（它们本来就是云端地址） --- */
    picks.forEach(function (p) {
      var urls = p.images || [];
      var ths = p.thumbs || [];
      urls.forEach(function (u, i) {
        queue.push({
          key: "img" + (++seq),
          name: "引用的图片",
          file: null,
          previewUrl: (ths[i] || u),
          status: "done",
          url: u,
          thumb: ths[i] || "",
          error: ""
        });
      });
    });
    renderThumbs();

    /* --- 标签：去重后追加 --- */
    var tagEl = document.getElementById("fTags");
    if (tagEl) {
      var curTags = tagEl.value.split(/[,，]/).map(function (s) { return s.trim(); })
                            .filter(function (s) { return s !== ""; });
      picks.forEach(function (p) {
        (p.tags || []).forEach(function (tg) {
          if (curTags.indexOf(tg) < 0) curTags.push(tg);
        });
      });
      tagEl.value = curTags.join(", ");
    }

    /* 提示用户引用了哪些情报 */
    var hint = document.getElementById("refsHint");
    if (hint) {
      hint.className = "gate-error gate-ok";
      hint.textContent = "已引用 " + picks.length + " 条情报：" +
        picks.map(function (p) { return "「" + p.title + "」"; }).join("、");
      hint.hidden = false;
    }
  }

  /* 引用情报的调用挪到文件末尾：必须先恢复草稿，再合并引用，否则合并的内容会被覆盖 */

  /* ============================================================
     表单草稿（提供情报 / 增加条目 都生效）
     ------------------------------------------------------------
     问题：填到一半点了别的页面再退回来，页面会重新加载，写的内容全丢。
     办法：边填边把内容存进 sessionStorage，回到本页时自动恢复。
        · 图片只存已经上传成功的（它们本来就是云端地址，能直接复用）
        · 提交成功后清掉草稿（条目上传失败时保留，方便重试）
        · 超过 24 小时的草稿不再恢复，免得看到几天前的内容
     ============================================================ */

  /* 两个页面各用各的键，互不干扰 */
  function draftKey() {
    return IS_TIP ? "gui_tip_draft" : "gui_entry_draft";
  }

  var DRAFT_MAX_AGE = 24 * 60 * 60 * 1000;

  function draftEls() {
    return {
      title: document.getElementById("fTitle"),
      body:  document.getElementById("fBody"),
      tags:  document.getElementById("fTags"),
      imageUrl: document.getElementById("fImage")
    };
  }

  /* 存草稿 */
  function saveDraft() {
    var els = draftEls();
    if (!els.title || !els.body) return;

    /* 只收已经上传完成的图片 */
    var imgs = queue
      .filter(function (i) { return i.status === "done" && i.url; })
      .map(function (i) { return { url: i.url, thumb: i.thumb || "" }; });

    try {
      sessionStorage.setItem(draftKey(), JSON.stringify({
        savedAt: Date.now(),
        title: els.title.value,
        body: els.body.value,
        tags: els.tags ? els.tags.value : "",
        imageUrl: els.imageUrl ? els.imageUrl.value : "",
        images: imgs,
        refs: pickedRefs
      }));
    } catch (e) {}
  }

  function clearDraft() {
    try { sessionStorage.removeItem(draftKey()); } catch (e) {}
  }

  /* 把草稿填回表单 */
  function restoreDraft() {

    var raw = null;
    try { raw = sessionStorage.getItem(draftKey()); } catch (e) { return; }
    if (!raw) return;

    var d = null;
    try { d = JSON.parse(raw); } catch (e) { clearDraft(); return; }
    if (!d) { clearDraft(); return; }

    /* 太旧的草稿直接丢掉 */
    if (!d.savedAt || Date.now() - d.savedAt > DRAFT_MAX_AGE) { clearDraft(); return; }

    /* 完全空的草稿没什么可恢复的 */
    var hasText = (d.title || "").trim() || (d.body || "").trim() ||
                  (d.tags || "").trim() || (d.imageUrl || "").trim() ||
                  (d.images && d.images.length) || (d.refs && d.refs.length);
    if (!hasText) { clearDraft(); return; }

    var els = draftEls();
    if (els.title && d.title) els.title.value = d.title;
    if (els.body && d.body) els.body.value = d.body;
    if (els.tags && d.tags) els.tags.value = d.tags;
    if (els.imageUrl && d.imageUrl) els.imageUrl.value = d.imageUrl;
    if (d.refs && d.refs.length) pickedRefs = d.refs;

    /* 已上传的图片直接放回队列，标记为完成，不需要重传 */
    (d.images || []).forEach(function (im) {
      if (!im || !im.url) return;
      queue.push({
        key: "img" + (++seq),
        name: "已上传的图片",
        file: null,
        previewUrl: im.thumb || im.url,
        status: "done",
        url: im.url,
        thumb: im.thumb || "",
        error: ""
      });
    });
    renderThumbs();

    showDraftHint();
  }

  /* 恢复后给个提示，并提供一键清空，免得用户疑惑 */
  function showDraftHint() {
    var err = document.getElementById("formError");
    if (!err || !err.parentNode || document.getElementById("draftHint")) return;

    var p = document.createElement("p");
    p.className = "tip-draft-hint";
    p.id = "draftHint";
    p.innerHTML = "已恢复上次没提交完的内容。" +
                  '<button type="button" class="link-btn" id="clearDraftBtn">清空重填</button>';

    err.parentNode.insertBefore(p, err);

    document.getElementById("clearDraftBtn").addEventListener("click", function () {
      var els = draftEls();
      if (els.title) els.title.value = "";
      if (els.body) els.body.value = "";
      if (els.tags) els.tags.value = "";
      if (els.imageUrl) els.imageUrl.value = "";

      queue = [];
      renderThumbs();      /* 这一步会顺手存一次草稿，所以清空要放在它后面 */

      clearDraft();     /* 最后再删，确保真的删干净 */

      p.remove();
    });
  }

  /* 边填边存 */
  ["fTitle", "fBody", "fTags", "fImage"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("input", saveDraft);
  });

  /* 顺序很重要：
     1. 先把上次没提交完的草稿填回去
     2. 再把这次通过「引用情报」选中的内容合并进来
     反过来的话，恢复草稿会把刚合并的内容覆盖掉。 */
  restoreDraft();
  if (!IS_TIP) applyPickedTips();
})();
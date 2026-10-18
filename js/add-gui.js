/* ============================================================
   add-gui.js —— 增加条目：组织验证 + 表单提交
   ------------------------------------------------------------
   验证答案不存明文，只存 SHA-256 哈希。
   注意：这是纯前端验证，懂技术的人可以绕过——只用于挡普通访客。
   ============================================================ */
(function () {
  "use strict";

  /* --- 题目与答案哈希（答案先去除首尾空格、合并中间空格、转小写再哈希） --- */
  var QUESTIONS = [
    {
      key: "q1",
      label: "CPU远征行动指定前哨站",
      hash: "fa78f8e5d82ab0277026a636c5eaec7c9069005b7fbc90d60d78443c5ec4cad3"
    },
    {
      key: "q2",
      label: "CPU远征行动指定驱鬼补给",
      hash: "13c27adf93f04b70901c4c98a2d8698e8d77e34899d9ee930dad185bf6505bcb"
    }
  ];

  var gateSection = document.getElementById("gateSection");
  var formSection = document.getElementById("formSection");
  var doneSection = document.getElementById("doneSection");
  var gateForm    = document.getElementById("gateForm");
  var entryForm   = document.getElementById("entryForm");
  var gateError   = document.getElementById("gateError");
  var formError   = document.getElementById("formError");

  /* ---------- SHA-256 ---------- */
  function normalize(s) {
    return String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
  }

  function sha256Hex(text) {
    var data = new TextEncoder().encode(text);

    /* 优先用浏览器原生实现（https 和 localhost 下可用） */
    if (window.crypto && window.crypto.subtle) {
      return window.crypto.subtle.digest("SHA-256", data).then(function (buf) {
        var bytes = new Uint8Array(buf);
        var out = "";
        for (var i = 0; i < bytes.length; i++) {
          out += bytes[i].toString(16).padStart(2, "0");
        }
        return out;
      });
    }

    /* 兜底：直接打开 html 文件（file://）时没有 crypto.subtle，用纯 JS 实现。
       注意必须先转成 UTF-8 字节串，否则中文会被算成空哈希。 */
    return Promise.resolve(sha256Pure(toUtf8ByteString(text)));
  }

  /* 把字符串转成「每个字符代表一个字节」的字符串（UTF-8 编码） */
  function toUtf8ByteString(str) {
    var encoded = encodeURIComponent(str);
    return encoded.replace(/%([0-9A-Fa-f]{2})/g, function (_, hex) {
      return String.fromCharCode(parseInt(hex, 16));
    });
  }

  /* 纯 JS 的 SHA-256 兜底实现 */
  function sha256Pure(ascii) {
    function rightRotate(value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    }
    var maxWord = Math.pow(2, 32);
    var result = "";
    var words = [];
    var asciiBitLength = ascii.length * 8;

    var hash = sha256Pure.h = sha256Pure.h || [];
    var k = sha256Pure.k = sha256Pure.k || [];
    var primeCounter = k.length;

    for (var candidate = 2; primeCounter < 64; candidate++) {
      if (isPrime(candidate)) {
        if (primeCounter < 8) { hash[primeCounter] = (Math.pow(candidate, 0.5) * maxWord) | 0; }
        k[primeCounter] = (Math.pow(candidate, 1 / 3) * maxWord) | 0;
        primeCounter++;
      }
    }
    function isPrime(n) {
      for (var factor = 2; factor * factor <= n; factor++) { if (n % factor === 0) return false; }
      return true;
    }

    ascii += "\x80";
    while (ascii.length % 64 !== 56) ascii += "\x00";
    for (var i = 0; i < ascii.length; i++) {
      var j = ascii.charCodeAt(i);
      if (j >> 8) return ""; /* 只支持单字节，中文走不到这里 */
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words.length] = ((asciiBitLength / maxWord) | 0);
    words[words.length] = asciiBitLength;

    for (var j2 = 0; j2 < words.length; j2 += 16) {
      var w = words.slice(j2, j2 + 16);
      var oldHash = hash.slice(0, 8);
      for (var i2 = 0; i2 < 64; i2++) {
        var w15 = w[i2 - 15], w2 = w[i2 - 2];
        var a1 = hash[0], e1 = hash[4];
        var temp1 = hash[7] +
          (rightRotate(e1, 6) ^ rightRotate(e1, 11) ^ rightRotate(e1, 25)) +
          ((e1 & hash[5]) ^ ((~e1) & hash[6])) + k[i2] +
          (w[i2] = i2 < 16 ? w[i2] : (
            w[i2 - 16] +
            (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
            w[i2 - 7] +
            (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
          ) | 0);
        var temp2 = (rightRotate(a1, 2) ^ rightRotate(a1, 13) ^ rightRotate(a1, 22)) +
          ((a1 & hash[1]) ^ (a1 & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for (var i3 = 0; i3 < 8; i3++) { hash[i3] = (hash[i3] + oldHash[i3]) | 0; }
    }

    for (var i4 = 0; i4 < 8; i4++) {
      for (var j3 = 3; j3 + 1; j3--) {
        var b = (hash[i4] >> (j3 * 8)) & 255;
        result += ((b < 16) ? "0" : "") + b.toString(16);
      }
    }
    return result;
  }

  /* ---------- 验证 ---------- */
  gateForm.addEventListener("submit", function (ev) {
    ev.preventDefault();
    gateError.hidden = true;

    var answers = QUESTIONS.map(function (q) {
      return normalize(document.getElementById(q.key).value);
    });

    if (answers.some(function (a) { return a === ""; })) {
      gateError.textContent = "请回答全部问题。";
      gateError.hidden = false;
      return;
    }

    Promise.all(answers.map(sha256Hex)).then(function (hashes) {
      var ok = QUESTIONS.every(function (q, i) { return hashes[i] === q.hash; });
      if (ok) {
        gateSection.hidden = true;
        formSection.hidden = false;
        document.getElementById("fTitle").focus();
      } else {
        formSection.hidden = true;   /* 确保表单绝不显示 */
        gateError.textContent = "答案不正确。即将返回图鉴。";
        gateError.hidden = false;
        setTimeout(function () {
          location.href = "guitu.html";
        }, 1800);
      }
    }).catch(function () {
      gateError.textContent = "验证出错，请刷新页面重试。";
      gateError.hidden = false;
    });
  });

  /* ---------- 取消 ---------- */
  document.getElementById("cancelBtn").addEventListener("click", function () {
    location.href = "guitu.html";
  });

  /* ---------- 提交新条目 ---------- */
  entryForm.addEventListener("submit", function (ev) {
    ev.preventDefault();
    formError.hidden = true;

    var title = document.getElementById("fTitle").value.trim();
    var body  = document.getElementById("fBody").value.trim();
    var images = collectedImages();
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
      images: images,           /* 全部图片 */
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

    window.GuiUpload.uploadFile(item.file).then(function (url) {
      item.url = url;
      item.status = "done";
      /* 上传完成后把预览换成云端地址，避免一直占着内存 */
      if (item.previewUrl && item.previewUrl.indexOf("blob:") === 0) {
        URL.revokeObjectURL(item.previewUrl);
        item.previewUrl = url;
      }
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

  /* 收集已上传成功的图片地址（按添加顺序） */
  function collectedImages() {
    var urls = queue.filter(function (i) { return i.status === "done" && i.url; })
                    .map(function (i) { return i.url; });
    /* 手动粘贴的网址排在最后 */
    var manual = imgUrlInput.value.trim();
    if (manual) urls.push(manual);
    return urls;
  }
})();
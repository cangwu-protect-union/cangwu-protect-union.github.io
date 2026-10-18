/* ============================================================
   gui-upload.js —— 条目图片上传
   ------------------------------------------------------------
   流程：选择文件 →（必要时先转码 HEIC）→ 压缩 → 上传云存储 → 返回公开 URL

   支持的源格式：
     JPEG / PNG / WebP / GIF / AVIF / BMP / SVG …… 浏览器能解码的都行
     HEIC / HEIF（iPhone 默认格式）→ 自动用 heic2any 转成 JPEG

   为什么 HEIC 要特殊处理：
     除了 Safari，Chrome / Edge / 安卓浏览器都**无法解码 HEIC**。
     不转换的话，图片存进去也显示不出来（会变成裂图）。
     heic2any 体积约 1.3MB，所以只在真的选中 HEIC 时才动态加载，
     普通图片上传完全不受影响。

   为什么先压缩：
     手机拍的图动辄 3~5MB，压到最长边 1280px、JPEG 质量 0.82 后
     通常只有 100~250KB，上传快、加载也快。
   ============================================================ */
(function () {
  "use strict";

  var MAX_EDGE = 1280;      /* 压缩后的最长边（像素） */
  var QUALITY = 0.82;       /* JPEG 质量 */
  var BUCKET = "gui-images";
  var HEIC_LIB = "js/lib/heic2any.min.js";

  function cfg() {
    var c = window.GUI_CLOUDBASE || {};
    if (!c.envId || !c.publishableKey) return null;
    return {
      base: "https://" + String(c.envId).trim() + ".api.tcloudbasegateway.com",
      key: String(c.publishableKey).trim()
    };
  }

  function isConfigured() { return cfg() !== null; }

  /* ---------------- HEIC 判断与转码 ---------------- */

  function looksHeic(file) {
    var type = (file.type || "").toLowerCase();
    var name = (file.name || "").toLowerCase();
    return type === "image/heic" || type === "image/heif" ||
           /\.(heic|heif)$/.test(name);
  }

  /* 动态加载 heic2any（只在需要时加载一次） */
  var heicLoading = null;
  function loadHeicLib() {
    if (window.heic2any) return Promise.resolve(window.heic2any);
    if (heicLoading) return heicLoading;

    heicLoading = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = HEIC_LIB;
      s.onload = function () {
        if (window.heic2any) resolve(window.heic2any);
        else reject(new Error("HEIC 转换器加载后未就绪"));
      };
      s.onerror = function () { reject(new Error("HEIC 转换器下载失败")); };
      document.head.appendChild(s);
    });

    return heicLoading;
  }

  /* 把 HEIC 转成 JPEG Blob */
  function convertHeic(file) {
    return loadHeicLib().then(function (heic2any) {
      return heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: 0.92          /* 先用高质量，后面还会再压一次 */
      });
    }).then(function (out) {
      var blob = Array.isArray(out) ? out[0] : out;
      if (!blob) throw new Error("HEIC 转换没有返回结果");
      return blob;
    });
  }

  /* ---------------- 解码：Blob/File → Image ---------------- */

  function decodeToImage(blob) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () { resolve({ img: img, url: url }); };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("decode-failed"));
      };
      img.src = url;
    });
  }

  /* ---------------- 缩放到画布并导出 JPEG ---------------- */

  function drawAndExport(img) {
    var w = img.naturalWidth;
    var h = img.naturalHeight;
    if (!w || !h) throw new Error("图片尺寸无效");

    var scale = Math.min(1, MAX_EDGE / Math.max(w, h));
    var tw = Math.round(w * scale);
    var th = Math.round(h * scale);

    var canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    var ctx = canvas.getContext("2d");

    /* 先铺白底：JPEG 不支持透明通道，不铺底的话透明区域会变成黑色。
       带透明背景的 PNG / 抠图贴纸会变成黑块，很难看。 */
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, tw, th);
    ctx.drawImage(img, 0, 0, tw, th);

    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (!blob) { reject(new Error("图片处理失败")); return; }
        resolve({ blob: blob, width: tw, height: th });
      }, "image/jpeg", QUALITY);
    });
  }

  /* ---------------- 压缩主流程 ---------------- */

  /* onStep(text) 用于给界面反馈进度 */
  function compress(file, onStep) {
    var step = onStep || function () {};

    if (!/^image\//.test(file.type) && !looksHeic(file)) {
      return Promise.reject(new Error("这不是图片文件"));
    }

    step("正在读取图片…");

    return decodeToImage(file).then(function (r) {
      var p = drawAndExport(r.img);
      URL.revokeObjectURL(r.url);
      return p;
    }).catch(function (err) {
      /* 浏览器解不了 → 如果是 HEIC，用 heic2any 转一次再试 */
      if (!looksHeic(file)) throw err;

      step("检测到 HEIC 格式，正在加载转换器（首次约 1.3MB）…");

      return loadHeicLib().then(function () {
        step("正在转换 HEIC…");
        return convertHeic(file);
      }).then(function (jpegBlob) {
        step("正在压缩…");
        return decodeToImage(jpegBlob).then(function (r2) {
          var p = drawAndExport(r2.img);
          URL.revokeObjectURL(r2.url);
          return p;
        });
      });
    });
  }

  /* ---------------- 上传 ---------------- */

  function makeName() {
    var d = new Date();
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    var stamp = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
                "-" + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
    var rand = Math.random().toString(36).slice(2, 8);
    return "gui/" + stamp + "-" + rand + ".jpg";
  }

  function upload(blob) {
    var c = cfg();
    if (!c) return Promise.reject(new Error("云存储未配置"));

    var name = makeName();
    var url = c.base + "/v1/storages/object/" + BUCKET + "/" + name;

    return fetch(url, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + c.key,
        "Content-Type": "image/jpeg"
      },
      body: blob
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error("上传失败 HTTP " + res.status + " " + t.slice(0, 200));
        });
      }
      return c.base + "/v1/storages/object/" + BUCKET + "/" + name;
    });
  }

  /* ---------------- 对外接口 ---------------- */

  window.GuiUpload = {
    isConfigured: isConfigured,
    compress: compress,
    upload: upload,
    looksHeic: looksHeic,
    /* 一步到位：文件 → 公开 URL */
    uploadFile: function (file, onStep) {
      return compress(file, onStep).then(function (r) {
        return upload(r.blob);
      });
    }
  };
})();
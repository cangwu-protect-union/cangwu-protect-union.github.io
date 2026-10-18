/* ============================================================
   gui-upload.js —— 条目图片上传
   ------------------------------------------------------------
   流程：选择文件 → 浏览器端压缩（缩到最长边 1280px）→ 上传到
        CloudBase 云存储 → 返回公开 URL，存进条目的 image 字段。

   为什么先压缩：
     手机拍的照片动辄 3-5MB，直接上传又慢又费流量。
     压到最长边 1280px、JPEG 质量 0.82，通常只有 100~250KB，
     在列表和详情页显示已经足够清晰。
   ============================================================ */
(function () {
  "use strict";

  var MAX_EDGE = 1280;      /* 压缩后的最长边（像素） */
  var QUALITY = 0.82;       /* JPEG 质量 */
  var BUCKET = "gui-images";

  function cfg() {
    var c = window.GUI_CLOUDBASE || {};
    if (!c.envId || !c.publishableKey) return null;
    return {
      base: "https://" + String(c.envId).trim() + ".api.tcloudbasegateway.com",
      key: String(c.publishableKey).trim()
    };
  }

  function isConfigured() { return cfg() !== null; }

  /* ---------- 压缩：读文件 → canvas 缩放 → Blob ---------- */
  function compress(file) {
    return new Promise(function (resolve, reject) {
      if (!/^image\//.test(file.type)) {
        reject(new Error("不是图片文件"));
        return;
      }

      var url = URL.createObjectURL(file);
      var img = new Image();

      img.onload = function () {
        try {
          var w = img.naturalWidth;
          var h = img.naturalHeight;
          var scale = Math.min(1, MAX_EDGE / Math.max(w, h));
          var tw = Math.round(w * scale);
          var th = Math.round(h * scale);

          var canvas = document.createElement("canvas");
          canvas.width = tw;
          canvas.height = th;
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, tw, th);

          canvas.toBlob(function (blob) {
            URL.revokeObjectURL(url);
            if (!blob) { reject(new Error("图片处理失败")); return; }
            resolve({ blob: blob, width: tw, height: th });
          }, "image/jpeg", QUALITY);
        } catch (e) {
          URL.revokeObjectURL(url);
          reject(e);
        }
      };

      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("无法读取这张图片"));
      };

      img.src = url;
    });
  }

  /* ---------- 生成不会重名的对象名 ---------- */
  function makeName() {
    var d = new Date();
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    var stamp = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
                "-" + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
    var rand = Math.random().toString(36).slice(2, 8);
    return "gui/" + stamp + "-" + rand + ".jpg";
  }

  /* ---------- 上传：POST /v1/storages/object/{bucket}/{name} ---------- */
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
      /* 公开访问地址 */
      return c.base + "/v1/storages/object/" + BUCKET + "/" + name;
    });
  }

  /* ---------- 对外接口 ---------- */
  window.GuiUpload = {
    isConfigured: isConfigured,
    compress: compress,
    upload: upload,
    /* 一步到位：文件 → 公开 URL */
    uploadFile: function (file) {
      return compress(file).then(function (r) { return upload(r.blob); });
    }
  };
})();
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
    var image = document.getElementById("fImage").value.trim();
    var tags  = document.getElementById("fTags").value
      .split(/[,，]/).map(function (s) { return s.trim(); })
      .filter(function (s) { return s !== ""; });

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
      image: image || "",   /* 留空即可，显示时会自动生成占位图 */
      intro: intro,
      body: body,
      tags: tags,
      date: new Date().toISOString().slice(0, 10)
    };

    window.GuiData.add(entry).then(function () {
      formSection.hidden = true;
      doneSection.hidden = false;

      document.getElementById("doneText").textContent =
        "条目「" + title + "」已保存在这台设备上，现在就能在图鉴里搜索和查看。";
      document.getElementById("doneView").href = "条目.html?id=" + encodeURIComponent(entry.id);
    });
  });

  /* ---------- 复制 JSON：生成完整的 entries.json 内容 ---------- */
  var copyBtn = document.getElementById("copyBtn");
  var copyState = document.getElementById("copyState");

  copyBtn.addEventListener("click", function () {
    copyState.hidden = true;
    window.GuiData.buildRepoFile().then(function (text) {
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
})();
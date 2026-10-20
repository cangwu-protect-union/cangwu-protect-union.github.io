/* ============================================================
   gui-gate.js —— 组织问答验证（共享模块）
   ------------------------------------------------------------
   所有需要「成员身份」的地方都调用这里，避免每个页面各写一遍：

     GuiGate.mount(el, { onPass })   在指定容器里渲染验证表单
     GuiGate.ask()                   弹出模态框，要求再答一次（返回 Promise<boolean>）
     GuiGate.require(onPass)         便捷入口

   安全说明：
     答案不存明文，只存 SHA-256 哈希。但这终究是**纯前端**验证，
     懂技术的人可以直接调 API 绕过。真正保护数据的是数据库那边：
     删除只是打标记、版本表只增不删，所以最坏情况也能恢复。
   ============================================================ */
(function () {
  "use strict";

  /* ---------- 题目与答案哈希 ----------
     加新题：在数组里加一项，hash 用答案的 SHA-256
     （答案先 trim、合并空格、转小写再哈希） */
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

  /* ---------- 输入规范化 ---------- */
  function normalize(s) {
    return String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
  }

  /* ---------- SHA-256（优先用浏览器原生，file:// 下退回纯 JS） ---------- */
  function sha256Hex(text) {
    var data = new TextEncoder().encode(text);

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

    return Promise.resolve(sha256Pure(toUtf8ByteString(text)));
  }

  /* 把字符串转成「每个字符代表一个字节」的字符串（UTF-8 编码） */
  function toUtf8ByteString(str) {
    return encodeURIComponent(str).replace(/%([0-9A-Fa-f]{2})/g, function (_, hex) {
      return String.fromCharCode(parseInt(hex, 16));
    });
  }

  /* 纯 JS 的 SHA-256 兜底实现（只在没有 crypto.subtle 时用到） */
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
      if (j >> 8) return "";
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

  /* ---------- 校验一组答案 ---------- */
  function verifyValues(values) {
    return Promise.all(values.map(function (v) { return sha256Hex(normalize(v)); }))
      .then(function (hashes) {
        return QUESTIONS.every(function (q, i) { return hashes[i] === q.hash; });
      });
  }

  /* ---------- 渲染题目输入框 ---------- */
  function buildFields(idPrefix) {
    return QUESTIONS.map(function (q, i) {
      var id = idPrefix + "-q" + (i + 1);
      return '<div class="field">' +
               '<label for="' + id + '">' + (i === 0 ? "问题一：" : "问题二：") + q.label + '</label>' +
               '<input id="' + id + '" type="text" placeholder="请输入答案" autocomplete="off">' +
             '</div>';
    }).join("");
  }

  function readFields(root, idPrefix) {
    return QUESTIONS.map(function (q, i) {
      var el = root.querySelector("#" + idPrefix + "-q" + (i + 1));
      return el ? el.value : "";
    });
  }

  /* ---------- 页面内嵌验证 ----------
     用法：GuiGate.mount(containerEl, { onPass: fn })
     验证通过后调用 onPass；不通过显示错误并倒计时跳转 */
  function mount(container, opts) {
    opts = opts || {};
    var idPrefix = "gate" + Math.floor(Math.random() * 1e6);

    container.innerHTML =
      '<form class="gate-form" autocomplete="off">' +
        buildFields(idPrefix) +
        '<p class="gate-error" hidden></p>' +
        '<div class="gate-actions">' +
          '<button type="submit" class="btn">验证</button>' +
          (opts.cancelHref ? '<a class="btn btn-ghost" href="' + opts.cancelHref + '">取消</a>' : '') +
        '</div>' +
      '</form>';

    var form = container.querySelector(".gate-form");
    var errEl = container.querySelector(".gate-error");

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      errEl.hidden = true;

      var values = readFields(container, idPrefix);
      if (values.some(function (v) { return normalize(v) === ""; })) {
        errEl.textContent = "请回答全部问题。";
        errEl.hidden = false;
        return;
      }

      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;

      verifyValues(values).then(function (ok) {
        btn.disabled = false;
        if (ok) {
          if (opts.onPass) opts.onPass();
        } else {
          errEl.textContent = "答案不正确。" + (opts.failHref ? "即将返回…" : "");
          errEl.hidden = false;
          if (opts.onFail) opts.onFail();
          if (opts.failHref) {
            setTimeout(function () { location.href = opts.failHref; }, 1600);
          }
        }
      }).catch(function () {
        btn.disabled = false;
        errEl.textContent = "验证出错，请刷新页面重试。";
        errEl.hidden = false;
      });
    });
  }

  /* ---------- 模态框再验证 ----------
     用法：GuiGate.ask().then(ok => { ... })  ok 为 true 表示验证通过
     用于「确认修改」「删除条目」「应用旧版」「恢复」等破坏性操作 */
  var modalEl = null;

  function ensureModal() {
    if (modalEl) return modalEl;
    modalEl = document.createElement("div");
    modalEl.className = "gate-modal";
    modalEl.hidden = true;
    modalEl.innerHTML =
      '<div class="gate-modal-box" role="dialog" aria-modal="true">' +
        '<h3 class="gate-modal-title">再次验证身份</h3>' +
        '<p class="gate-modal-desc" id="gateModalDesc"></p>' +
        '<form class="gate-modal-form" autocomplete="off"></form>' +
        '<p class="gate-error" hidden></p>' +
        '<div class="gate-actions">' +
          '<button type="button" class="btn btn-ghost" data-act="cancel">取消</button>' +
          '<button type="button" class="btn" data-act="ok">验证并继续</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modalEl);
    return modalEl;
  }

  function ask(opts) {
    opts = opts || {};
    var el = ensureModal();
    var form = el.querySelector(".gate-modal-form");
    var desc = el.querySelector("#gateModalDesc");
    var errEl = el.querySelector(".gate-error");
    var idPrefix = "m" + Math.floor(Math.random() * 1e6);

    desc.textContent = opts.message || "这个操作会改动图鉴，请重新回答验证问题。";
    form.innerHTML = buildFields(idPrefix);
    errEl.hidden = true;
    el.hidden = false;

    /* 自动聚焦第一个输入框 */
    var first = form.querySelector("input");
    if (first) setTimeout(function () { first.focus(); }, 50);

    return new Promise(function (resolve) {
      function close(result) {
        el.hidden = true;
        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
        el.removeEventListener("keydown", onKey);
        resolve(result);
      }
      function onOk() {
        errEl.hidden = true;
        var values = readFields(form, idPrefix);
        if (values.some(function (v) { return normalize(v) === ""; })) {
          errEl.textContent = "请回答全部问题。";
          errEl.hidden = false;
          return;
        }
        okBtn.disabled = true;
        verifyValues(values).then(function (ok) {
          okBtn.disabled = false;
          if (ok) {
            close(true);
          } else {
            errEl.textContent = "答案不正确，操作已取消。";
            errEl.hidden = false;
            setTimeout(function () { close(false); }, 1400);
          }
        }).catch(function () {
          okBtn.disabled = false;
          errEl.textContent = "验证出错，请重试。";
          errEl.hidden = false;
        });
      }
      function onCancel() { close(false); }
      function onKey(e) { if (e.key === "Escape") close(false); }

      var okBtn = el.querySelector('[data-act="ok"]');
      var cancelBtn = el.querySelector('[data-act="cancel"]');
      okBtn.addEventListener("click", onOk);
      cancelBtn.addEventListener("click", onCancel);
      el.addEventListener("keydown", onKey);
    });
  }

  /* ---------- 对外接口 ---------- */
  window.GuiGate = {
    questions: QUESTIONS,
    mount: mount,
    ask: ask,
    verifyValues: verifyValues,
    normalize: normalize
  };
})();
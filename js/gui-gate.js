/* ============================================================
   gui-gate.js —— 组织问答验证（共享模块）
   ------------------------------------------------------------
   所有需要「成员身份」的地方都调用这里，避免每个页面各写一遍：

     GuiGate.require(el, { onPass })   ★推荐：验证一次，整个会话内都记住
     GuiGate.mount(el, { onPass })     只在这一个页面验证（不记状态）
     GuiGate.ask()                     弹模态框再验证一次（保留备用）

   ★「只验证一次」的机制：
     验证通过后，数据库会签发一个令牌（2 小时有效），存在 sessionStorage。
     之后再进编辑区的任何页面都直接放行，不再重复问题目。
     关闭标签页后自动失效。

   ★★ 安全模型（重要）：
     答案的哈希**不在这个文件里**，而是存在数据库的 gui_secrets 表，
     网页读不到。验证由数据库函数 gui_verify() 完成，通过后签发令牌。
     所有写入操作必须带令牌，数据库的 RLS 策略会检查。
     所以：看源码拿不到密码，也没法绕过网页直接调 API 写数据。
   ============================================================ */
(function () {
  "use strict";

  /* ---------- 题目（这里只有题干，没有答案） ----------
     加新题：数组里加一项，再到数据库 gui_secrets 表里加对应哈希。
     客户端只负责「算哈希 → 提交给数据库函数比对」，拿不到正确答案。 */
  var QUESTIONS = [
    { key: "q1", label: "CPU远征行动指定前哨站" },
    { key: "q2", label: "CPU远征行动指定驱鬼补给" }
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

  /* ---------- 访问令牌 ----------
     验证通过后数据库会签发一个令牌，写入数据时必须带上。
     存在 sessionStorage 里：同一标签页内有效，关掉就没了。 */
  var TOKEN_KEY = "gui_token";
  var TOKEN_EXP_KEY = "gui_token_exp";

  /* 云服务地址（和 data/config.js 里一致） */
  function apiBase() {
    var cfg = window.GUI_CLOUDBASE;
    if (!cfg || !cfg.envId) return "";
    return "https://" + cfg.envId + ".api.tcloudbasegateway.com/v1/rdb/rest";
  }
  function apiKey() {
    var cfg = window.GUI_CLOUDBASE;
    return (cfg && cfg.publishableKey) ? cfg.publishableKey : "";
  }

  function saveToken(tok, exp) {
    try {
      sessionStorage.setItem(TOKEN_KEY, tok);
      sessionStorage.setItem(TOKEN_EXP_KEY, String(exp || ""));
    } catch (e) {}
  }

  /* 取当前令牌；已过期就顺手清掉并返回空串 */
  function token() {
    try {
      var t = sessionStorage.getItem(TOKEN_KEY);
      if (!t) return "";
      var exp = sessionStorage.getItem(TOKEN_EXP_KEY);
      if (exp) {
        var when = Date.parse(exp);
        if (!isNaN(when) && Date.now() >= when) { clearVerified(); return ""; }
      }
      return t;
    } catch (e) {
      return "";
    }
  }

  function isVerified() { return !!token(); }

  /* 兼容旧接口：令牌由 verifyValues 保存，这里不需要额外动作 */
  function markVerified() {}

  function clearVerified() {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_EXP_KEY);
    } catch (e) {}
  }
  /* ---------- 校验一组答案（交给数据库判断） ----------
     流程：本地算出两个答案的 SHA-256 → 提交给数据库函数 gui_verify()
           → 数据库拿 gui_secrets 里的哈希比对 → 正确则签发令牌
     网页自始至终拿不到「正确答案」，只知道自己算出的哈希。 */
  function verifyValues(values) {
    var base = apiBase();
    if (!base) return Promise.reject(new Error("云服务未配置"));

    return Promise.all(values.map(function (v) { return sha256Hex(normalize(v)); }))
      .then(function (hashes) {
        return fetch(base + "/rpc/gui_verify", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + apiKey(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ p_hash1: hashes[0], p_hash2: hashes[1] })
        });
      })
      .then(function (res) {
        if (!res.ok) {
          return res.text().then(function (txt) {
            throw new Error("验证服务返回 " + res.status + " " + txt.slice(0, 120));
          });
        }
        return res.json();
      })
      .then(function (data) {
        if (data && data.ok && data.token) {
          saveToken(data.token, data.expires_at);
          return true;
        }
        return false;
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

  /* ---------- 页面级验证（会话内只问一次） ----------
     用法：GuiGate.require(容器元素, { onPass, cancelHref, failHref })
     · 之前已经验证过 → 立刻调用 onPass，界面上什么都不显示
     · 没验证过       → 在容器里渲染验证表单，通过后标记会话并调用 onPass */
  function require_(container, opts) {
    opts = opts || {};

    if (isVerified()) {
      if (container) container.innerHTML = "";
      if (opts.onPass) opts.onPass();
      return;
    }

    mount(container, {
      cancelHref: opts.cancelHref,
      failHref: opts.failHref,
      onPass: function () {
        /* 令牌已在 verifyValues 里存好了，这里只需继续流程 */
        if (opts.onPass) opts.onPass();
      }
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

    /* 页面级验证：整个会话只需一次 */
    require: require_,

    /* 其他用法 */
    mount: mount,
    ask: ask,

    /* 令牌：写入数据时由 gui-data.js 带在请求头里 */
    token: token,

    /* 会话状态（退出编辑区时可以主动清掉） */
    isVerified: isVerified,
    markVerified: markVerified,
    clearVerified: clearVerified,

    verifyValues: verifyValues,
    normalize: normalize
  };
})();
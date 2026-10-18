/* ============================================================
   gui-data.js —— 鬼图鉴的数据访问层
   ------------------------------------------------------------
   所有「读条目 / 存条目」都走这里，页面本身不关心数据存在哪。

   数据来源有三层，按顺序合并：
     1. 种子数据（data/gui-entries.js 里的示例条目）
     2. 云数据库（Supabase，需在 data/config.js 里填配置）
     3. 浏览器本地存储（云端没配置时的兜底，也用于缓存当次新增）

   云端没配置时，一切照常工作，只是条目只存在这台设备上。
   ============================================================ */
(function () {
  "use strict";

  var LOCAL_KEY = "gui_extra_entries";
  var TIMEOUT_MS = 5000;

  /* 熔断：云端连不上时 5 分钟内不再重试，避免每次打开页面都卡住 */
  var BREAK_MS = 5 * 60 * 1000;
  var downUntil = 0;
  function isDown() { return Date.now() < downUntil; }
  function markDown() { downUntil = Date.now() + BREAK_MS; }

  /* ---------------- 云端配置 ---------------- */
  function cfg() {
    var c = window.GUI_SUPABASE || {};
    if (!c.url || !c.anonKey) return null;

    /* 容错：只保留 https://xxx.supabase.co 这一部分。
       用户可能把 API 页面上的完整地址（带 /rest/v1/）整段复制过来，
       而下面拼接请求时会自动加上 /rest/v1，所以要先把尾巴去掉。 */
    var base = String(c.url).trim().replace(/\/+$/, "");   // 去掉尾部斜杠
    base = base.replace(/\/rest\/v1$/, "");                // 去掉 /rest/v1
    base = base.replace(/\/+$/, "");

    return {
      url: base,
      anonKey: c.anonKey,
      table: c.table || "gui_entries"
    };
  }

  function remoteEnabled() { return cfg() !== null; }

  function headers(c) {
    return {
      "apikey": c.anonKey,
      "Authorization": "Bearer " + c.anonKey,
      "Content-Type": "application/json"
    };
  }

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise(function (_, reject) {
        setTimeout(function () { reject(new Error("请求超时")); }, ms);
      })
    ]);
  }

  /* ---------------- 本地存储 ---------------- */
  function readLocal() {
    try {
      var v = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (err) { return []; }
  }

  function writeLocal(list) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list)); } catch (err) { /* 忽略配额错误 */ }
  }

  /* ---------------- 读取 ---------------- */
  /* 返回 Promise<Array>：种子 + 云端 + 本地，按 id 去重 */
  function list() {
    var seed = window.GUI_SEED_ENTRIES || [];
    var local = readLocal();
    var c = cfg();

    if (!c || isDown()) {
      return Promise.resolve(seed.concat(local));
    }

    var url = c.url + "/rest/v1/" + c.table + "?select=*&order=created_at.desc&limit=1000";

    return withTimeout(
      fetch(url, { headers: headers(c) }).then(function (res) {
        if (!res.ok) throw new Error("云端返回 " + res.status);
        return res.json();
      }),
      TIMEOUT_MS
    ).then(function (rows) {
      var remote = (Array.isArray(rows) ? rows : []).map(function (r) {
        return {
          id: r.id, title: r.title, image: r.image, intro: r.intro,
          body: r.body, tags: r.tags || [], date: r.date
        };
      });
      return merge(seed, remote, local);
    }).catch(function (err) {
      /* 云端挂了也不能让页面空白：退回本地数据 */
      markDown();
      console.warn("[鬼图鉴] 云端读取失败，已切换为本地数据（5 分钟内不再重试）：", err.message);
      return seed.concat(local);
    });
  }

  /* 按 id 去重合并：后面出现的覆盖前面的 */
  function merge() {
    var out = [];
    var index = {};
    for (var i = 0; i < arguments.length; i++) {
      var arr = arguments[i] || [];
      for (var j = 0; j < arr.length; j++) {
        var e = arr[j];
        if (!e || !e.id) continue;
        if (index[e.id] === undefined) {
          index[e.id] = out.length;
          out.push(e);
        } else {
          out[index[e.id]] = e;
        }
      }
    }
    return out;
  }

  /* ---------------- 新增 ---------------- */
  /* 返回 Promise<{entry, remoteSaved, error}> */
  function add(entry) {
    var c = cfg();

    if (!c || isDown()) {
      var local = readLocal();
      local.push(entry);
      writeLocal(local);
      return Promise.resolve({ entry: entry, remoteSaved: false, error: null });
    }

    var url = c.url + "/rest/v1/" + c.table;
    var payload = {
      id: entry.id, title: entry.title, image: entry.image,
      intro: entry.intro, body: entry.body,
      tags: entry.tags || [], date: entry.date
    };

    return withTimeout(
      fetch(url, {
        method: "POST",
        headers: Object.assign({ "Prefer": "return=minimal" }, headers(c)),
        body: JSON.stringify(payload)
      }),
      TIMEOUT_MS
    ).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (txt) {
          throw new Error("云端保存失败 " + res.status + " " + txt.slice(0, 200));
        });
      }
      /* 云端成功后也在本地留一份缓存，断网时仍能看到 */
      var local = readLocal();
      local.push(entry);
      writeLocal(local);
      return { entry: entry, remoteSaved: true, error: null };
    }).catch(function (err) {
      /* 云端失败：退回本地，保证用户的心血不丢 */
      markDown();
      var local = readLocal();
      local.push(entry);
      writeLocal(local);
      return { entry: entry, remoteSaved: false, error: err.message };
    });
  }

  function newId() {
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  window.GuiData = {
    list: list,
    add: add,
    newId: newId,
    remoteEnabled: remoteEnabled
  };
})();
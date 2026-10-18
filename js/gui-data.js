/* ============================================================
   gui-data.js —— 鬼图鉴的数据访问层
   ------------------------------------------------------------
   数据来源三层，按顺序合并：
     1. 种子数据（data/gui-entries.js 里的示例条目）
     2. 云数据库（腾讯云 CloudBase PostgreSQL，需在 data/config.js 配置）
     3. 浏览器本地存储（云端没配置或连不上时的兜底）

   云端接口：CloudBase 的 PostgreSQL Data API（PostgREST 协议）
     GET  https://{envId}.api.tcloudbasegateway.com/v1/rdb/rest/gui_entries
     POST 同上
   认证：Authorization: Bearer <Publishable Key>
   ============================================================ */
(function () {
  "use strict";

  var LOCAL_KEY = "gui_extra_entries";
  var TIMEOUT_MS = 6000;

  /* 熔断：云端连不上时 5 分钟内不再重试，避免每次打开页面都卡住 */
  var BREAK_MS = 5 * 60 * 1000;
  var downUntil = 0;
  function isDown() { return Date.now() < downUntil; }
  function markDown() { downUntil = Date.now() + BREAK_MS; }

  /* ---------------- 云端配置 ---------------- */
  function cfg() {
    var c = window.GUI_CLOUDBASE || {};
    if (!c.envId || !c.publishableKey) return null;
    return {
      base: "https://" + String(c.envId).trim() + ".api.tcloudbasegateway.com/v1/rdb/rest/",
      key: String(c.publishableKey).trim(),
      table: c.table || "gui_entries"
    };
  }

  function remoteEnabled() { return cfg() !== null; }

  function headers(c, extra) {
    var h = {
      "Authorization": "Bearer " + c.key,
      "Content-Type": "application/json"
    };
    if (extra) { for (var k in extra) { h[k] = extra[k]; } }
    return h;
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
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list)); } catch (err) { /* 配额满时忽略 */ }
  }

  /* ---------------- 读取 ---------------- */
  function list() {
    var seed = window.GUI_SEED_ENTRIES || [];
    var local = readLocal();
    var c = cfg();

    if (!c || isDown()) {
      return Promise.resolve(seed.concat(local));
    }

    var url = c.base + c.table + "?select=*&order=created_at.desc&limit=1000";

    return withTimeout(
      fetch(url, { headers: headers(c) }).then(function (res) {
        if (!res.ok) {
          return res.text().then(function (t) {
            throw new Error("云端返回 " + res.status + " " + t.slice(0, 160));
          });
        }
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
      markDown();
      console.warn("[鬼图鉴] 云端读取失败，已切换为本地数据（5 分钟内不再重试）：", err.message);
      return seed.concat(local);
    });
  }

  function merge() {
    var out = [], index = {};
    for (var i = 0; i < arguments.length; i++) {
      var arr = arguments[i] || [];
      for (var j = 0; j < arr.length; j++) {
        var e = arr[j];
        if (!e || !e.id) continue;
        if (index[e.id] === undefined) { index[e.id] = out.length; out.push(e); }
        else { out[index[e.id]] = e; }
      }
    }
    return out;
  }

  /* ---------------- 新增 ---------------- */
  function add(entry) {
    var c = cfg();

    if (!c || isDown()) {
      var local0 = readLocal();
      local0.push(entry);
      writeLocal(local0);
      return Promise.resolve({ entry: entry, remoteSaved: false, error: null });
    }

    var url = c.base + c.table;
    var payload = {
      id: entry.id,
      title: entry.title,
      image: entry.image,
      intro: entry.intro,
      body: entry.body,
      tags: entry.tags || [],
      date: entry.date
    };

    return withTimeout(
      fetch(url, {
        method: "POST",
        headers: headers(c, { "Prefer": "return=minimal" }),
        body: JSON.stringify(payload)
      }),
      TIMEOUT_MS
    ).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error("云端保存失败 " + res.status + " " + t.slice(0, 200));
        });
      }
      var local = readLocal();
      local.push(entry);
      writeLocal(local);
      return { entry: entry, remoteSaved: true, error: null };
    }).catch(function (err) {
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
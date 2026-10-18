/* ============================================================
   gui-data.js —— 鬼图鉴的数据访问层
   ------------------------------------------------------------
   数据来源三层，按顺序合并（后面的覆盖前面的同 id 条目）：
     1. 种子数据（data/gui-entries.js 里的示例条目）
     2. 仓库数据（data/entries.json，成员新增的正式条目）
     3. 浏览器本地存储（表单刚提交、还没提交到仓库的条目）

   为什么用静态 JSON 而不是云数据库：
     静态文件与网页同源（都是 cangwu-protect-union.github.io），
     浏览器的跨域限制完全不生效，也不需要任何服务器或账号。
   ============================================================ */
(function () {
  "use strict";

  var LOCAL_KEY = "gui_pending_entries";   /* 还没提交到仓库的条目 */
  var REMOTE_FILE = "data/entries.json";

  /* ---------------- 本地待提交条目 ---------------- */
  function readLocal() {
    try {
      var v = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (err) { return []; }
  }

  function writeLocal(list) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list)); } catch (err) { /* 配额满时忽略 */ }
  }

  /* ---------------- 读取仓库里的正式条目 ---------------- */
  function fetchRepoEntries() {
    return fetch(REMOTE_FILE + "?t=" + Date.now(), { cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        var list = (data && data.entries) || (Array.isArray(data) ? data : []);
        return Array.isArray(list) ? list : [];
      })
      .catch(function (err) {
        console.warn("[鬼图鉴] 读取 data/entries.json 失败，仅使用种子数据：", err.message);
        return [];
      });
  }

  /* ---------------- 合并去重 ---------------- */
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

  /* ---------------- 对外：读 ---------------- */
  function list() {
    var seed = window.GUI_SEED_ENTRIES || [];
    var local = readLocal();
    return fetchRepoEntries().then(function (repo) {
      return merge(seed, repo, local);
    });
  }

  /* ---------------- 对外：新增 ---------------- */
  /* 存到浏览器本地（立刻可见），并返回提交到仓库所需的 JSON */
  function add(entry) {
    var local = readLocal();
    local.push(entry);
    writeLocal(local);
    return Promise.resolve({ entry: entry, savedLocally: true });
  }

  /* 生成「完整的新 entries.json 内容」，供用户复制提交 */
  function buildRepoFile() {
    var seed = window.GUI_SEED_ENTRIES || [];
    return fetchRepoEntries().then(function (repo) {
      var local = readLocal();
      /* 只把「不在种子数据里、也不在仓库里」的本地条目视为待提交 */
      var seedIds = {};
      var repoIds = {};
      seed.forEach(function (e) { seedIds[e.id] = 1; });
      repo.forEach(function (e) { repoIds[e.id] = 1; });

      var pending = local.filter(function (e) {
        return !seedIds[e.id] && !repoIds[e.id];
      });

      var all = repo.concat(pending);
      return JSON.stringify({ entries: all }, null, 2);
    });
  }

  /* 清空本地待提交缓冲（用户提交到仓库后调用） */
  function clearPending() {
    try { localStorage.removeItem(LOCAL_KEY); } catch (err) { /* ignore */ }
  }

  function newId() {
    return "gu-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  window.GuiData = {
    list: list,
    add: add,
    buildRepoFile: buildRepoFile,
    clearPending: clearPending,
    readLocal: readLocal,
    newId: newId
  };
})();
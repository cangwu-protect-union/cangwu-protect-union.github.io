/* ============================================================
   gui-data.js —— 鬼图鉴的数据访问层
   ------------------------------------------------------------
   数据来源四层，按顺序合并（同 id 后面的覆盖前面的）：
     1. 种子数据     data/gui-entries.js 里的示例条目
     2. 仓库静态文件  data/entries.json（云端故障时的兜底）
     3. 云数据库    腾讯云 CloudBase PostgreSQL（正式数据）
     4. 本地待提交   localStorage（刚提交、云端还没确认的条目）

   云端接口（CloudBase PostgreSQL Data API / PostgREST）：
     GET  https://{envId}.api.tcloudbasegateway.com/v1/rdb/rest/gui_entries
     POST 同上
   认证：Authorization: Bearer <Publishable Key>（匿名角色 anon，可公开）
   ============================================================ */
(function () {
  "use strict";

  var LOCAL_KEY = "gui_pending_entries";
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
    if (extra) for (var k in extra) h[k] = extra[k];
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

  /* ---------------- 本地 ---------------- */
  function readLocal() {
    try {
      var v = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (err) { return []; }
  }

  function writeLocal(list) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list)); } catch (err) { /* 配额满时忽略 */ }
  }

  function removeLocal(id) {
    writeLocal(readLocal().filter(function (e) { return e.id !== id; }));
  }

  /* ---------------- 仓库静态文件（兜底） ---------------- */
  function fetchRepoEntries() {
    var file = (window.GUI_APP && window.GUI_APP.entriesFile) || "data/entries.json";
    return fetch(file + "?t=" + Date.now(), { cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        var list = (data && data.entries) || (Array.isArray(data) ? data : []);
        return Array.isArray(list) ? list : [];
      })
      .catch(function () { return []; });
  }

  /* ---------------- 云数据库 ---------------- */
  function fetchCloud(c) {
    /* 正常情况：只取未删除的条目。
       如果数据库还没执行 version-setup.sql（没有 deleted 字段），
       自动退回「不带过滤」的老查询，保证公开图鉴页不会因此报错。 */
    var baseUrl = c.base + c.table + "?select=*";
    var withFilter = baseUrl + "&deleted=eq.false&order=created_at.desc&limit=1000";
    var withoutFilter = baseUrl + "&order=created_at.desc&limit=1000";

    function attempt(url) {
      return withTimeout(
        fetch(url, { headers: headers(c) }).then(function (res) {
          if (!res.ok) {
            return res.text().then(function (t) {
              var err = new Error("云端返回 " + res.status + " " + t.slice(0, 160));
              err.status = res.status;
              err.body = t;
              throw err;
            });
          }
          return res.json();
        }),
        TIMEOUT_MS
      );
    }

    return attempt(withFilter).catch(function (err) {
      /* 缺字段（400 + PGRST204/42703）时降级重试一次 */
      if (err.status === 400 && /deleted|PGRST204|42703/.test(err.body || err.message || "")) {
        return attempt(withoutFilter);
      }
      throw err;
    }).then(function (rows) {
      return (Array.isArray(rows) ? rows : []).map(function (r) {
        return {
          id: r.id, title: r.title, image: r.image, images: r.images || [],
          intro: r.intro, body: r.body, tags: r.tags || [], date: r.date,
          deleted: !!r.deleted, updated_at: r.updated_at
        };
      });
    });
  }

  /* ---------------- 合并 ---------------- */
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
    var c = cfg();

    var repoTask = fetchRepoEntries();

    if (!c || isDown()) {
      return repoTask.then(function (repo) {
        return merge(seed, repo, local);
      });
    }

    return Promise.all([
      repoTask,
      fetchCloud(c).catch(function (err) {
        markDown();
        console.warn("[鬼图鉴] 云端读取失败，改用仓库+本地数据（5 分钟内不再重试）：", err.message);
        return [];
      })
    ]).then(function (parts) {
      return merge(seed, parts[0], parts[1], local);
    });
  }

  /* ---------------- 对外：新增 ---------------- */
  function add(entry) {
    var c = cfg();

    /* 先写本地：保证即使云端失败，用户的内容也不会丢 */
    var local = readLocal();
    local.push(entry);
    writeLocal(local);

    if (!c || isDown()) {
      return Promise.resolve({ entry: entry, remoteSaved: false, error: null });
    }

    var url = c.base + c.table;
    var basePayload = {
      id: entry.id,
      title: entry.title,
      image: entry.image,
      intro: entry.intro,
      body: entry.body,
      tags: entry.tags || [],
      date: entry.date
    };

    function post(body) {
      return withTimeout(
        fetch(url, {
          method: "POST",
          headers: headers(c, { "Prefer": "return=minimal" }),
          body: JSON.stringify(body)
        }),
        TIMEOUT_MS
      );
    }

    /* 注意：必须浅拷贝。直接 payload = basePayload 会让两者指向同一个对象，
       后面加上 images 会把 basePayload 也污染，导致降级重试仍然失败。 */
    var payload = {};
    for (var k in basePayload) payload[k] = basePayload[k];
    if (entry.images && entry.images.length) payload.images = entry.images;

    return post(payload).then(function (res) {
      /* 如果数据库还没执行多图迁移（缺 images 字段），自动降级为单图重试一次 */
      if (res.status === 400 || res.status === 404) {
        return res.text().then(function (t) {
          if (/images|PGRST204|42703/.test(t)) {
            return post(basePayload).then(function (res2) {
              if (!res2.ok) {
                return res2.text().then(function (t2) {
                  throw new Error("云端保存失败 " + res2.status + " " + t2.slice(0, 200));
                });
              }
              return { degraded: true };
            });
          }
          throw new Error("云端保存失败 " + res.status + " " + t.slice(0, 200));
        });
      }
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error("云端保存失败 " + res.status + " " + t.slice(0, 200));
        });
      }
      return { degraded: false };
    }).then(function (r) {
      /* 云端已保存，本地副本可以清掉（避免重复显示） */
      removeLocal(entry.id);
      return { entry: entry, remoteSaved: true, error: null, degraded: r.degraded };
    }).catch(function (err) {
      markDown();
      return { entry: entry, remoteSaved: false, error: err.message };
    });
  }

  /* ============================================================
     编辑 / 版本相关（需要数据库执行过 version-setup.sql）
     ============================================================ */

  /* 把条目内容整理成一行记录（版本表和条目表共用这些字段） */
  function toRow(e) {
    return {
      title: e.title,
      image: e.image || "",
      images: e.images || [],
      intro: e.intro || "",
      body: e.body || "",
      tags: e.tags || [],
      date: e.date || ""
    };
  }

  /* 读全部条目（含已删除的），编辑界面和旧图鉴用 */
  function listAll() {
    var c = cfg();
    if (!c || isDown()) return Promise.resolve([]);

    var url = c.base + c.table + "?select=*&order=created_at.desc&limit=1000";
    return withTimeout(
      fetch(url, { headers: headers(c) }).then(function (res) {
        if (!res.ok) throw new Error("读取失败 HTTP " + res.status);
        return res.json();
      }),
      TIMEOUT_MS
    ).then(function (rows) {
      return (Array.isArray(rows) ? rows : []).map(function (r) {
        return {
          id: r.id, title: r.title, image: r.image, images: r.images || [],
          intro: r.intro, body: r.body, tags: r.tags || [], date: r.date,
          deleted: !!r.deleted, updated_at: r.updated_at, created_at: r.created_at
        };
      });
    }).catch(function (err) {
      markDown();
      console.warn("[鬼图鉴] 读取全部条目失败：", err.message);
      return [];
    });
  }

  /* 把一条条目的当前内容存进版本表 */
  function archiveVersion(entry, reason) {
    var c = cfg();
    if (!c) return Promise.reject(new Error("云数据库未配置"));

    var row = toRow(entry);
    row.version_id = "v-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
    row.entry_id = entry.id;
    row.reason = reason || "edit";

    return withTimeout(
      fetch(c.base + "gui_entry_versions", {
        method: "POST",
        headers: headers(c, { "Prefer": "return=minimal" }),
        body: JSON.stringify(row)
      }),
      TIMEOUT_MS
    ).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error("归档失败 HTTP " + res.status + " " + t.slice(0, 160));
        });
      }
      return row.version_id;
    });
  }

  /* 读所有版本（旧图鉴列表用） */
  function listVersions() {
    var c = cfg();
    if (!c || isDown()) return Promise.resolve([]);

    var url = c.base + "gui_entry_versions?select=*&order=archived_at.desc&limit=2000";
    return withTimeout(
      fetch(url, { headers: headers(c) }).then(function (res) {
        if (!res.ok) throw new Error("读取版本失败 HTTP " + res.status);
        return res.json();
      }),
      TIMEOUT_MS
    ).then(function (rows) {
      return Array.isArray(rows) ? rows : [];
    }).catch(function (err) {
      markDown();
      console.warn("[鬼图鉴] 读取版本失败：", err.message);
      return [];
    });
  }

  /* 改一个已有条目（PATCH），返回 Promise<void> */
  function updateEntry(entry) {
    var c = cfg();
    if (!c) return Promise.reject(new Error("云数据库未配置"));

    var row = toRow(entry);
    row.updated_at = new Date().toISOString();

    var url = c.base + c.table + "?id=eq." + encodeURIComponent(entry.id);
    return withTimeout(
      fetch(url, {
        method: "PATCH",
        headers: headers(c, { "Prefer": "return=minimal" }),
        body: JSON.stringify(row)
      }),
      TIMEOUT_MS
    ).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error("保存失败 HTTP " + res.status + " " + t.slice(0, 160));
        });
      }
    });
  }

  /* 软删除：只把 deleted 置为 true，数据库里不删行 */
  function softDelete(entryId) {
    var c = cfg();
    if (!c) return Promise.reject(new Error("云数据库未配置"));

    var url = c.base + c.table + "?id=eq." + encodeURIComponent(entryId);
    return withTimeout(
      fetch(url, {
        method: "PATCH",
        headers: headers(c, { "Prefer": "return=minimal" }),
        body: JSON.stringify({ deleted: true, updated_at: new Date().toISOString() })
      }),
      TIMEOUT_MS
    ).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error("删除失败 HTTP " + res.status + " " + t.slice(0, 160));
        });
      }
    });
  }

  /* 恢复：把某条目重新设为可见，并写入指定的内容（不传则用它的最新版本） */
  function restoreEntry(entryId, content) {
    var c = cfg();
    if (!c) return Promise.reject(new Error("云数据库未配置"));

    var row = content ? toRow(content) : {};
    row.deleted = false;
    row.updated_at = new Date().toISOString();

    var url = c.base + c.table + "?id=eq." + encodeURIComponent(entryId);
    return withTimeout(
      fetch(url, {
        method: "PATCH",
        headers: headers(c, { "Prefer": "return=minimal" }),
        body: JSON.stringify(row)
      }),
      TIMEOUT_MS
    ).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error("恢复失败 HTTP " + res.status + " " + t.slice(0, 160));
        });
      }
    });
  }

  /* 新增一个条目（编辑界面用，走和 add 相同的逻辑但不写本地缓冲） */
  function insertEntry(entry) {
    var c = cfg();
    if (!c) return Promise.reject(new Error("云数据库未配置"));

    var row = toRow(entry);
    row.id = entry.id;

    return withTimeout(
      fetch(c.base + c.table, {
        method: "POST",
        headers: headers(c, { "Prefer": "return=minimal" }),
        body: JSON.stringify(row)
      }),
      TIMEOUT_MS
    ).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error("新增失败 HTTP " + res.status + " " + t.slice(0, 160));
        });
      }
    });
  }
  function newId() {
    return "gu-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  window.GuiData = {
    /* 读 */
    list: list,                     /* 公开列表：只含未删除的 */
    listAll: listAll,               /* 全部条目：含已删除的 */
    listVersions: listVersions,     /* 所有历史版本 */

    /* 写 */
    add: add,                       /* 新增（带本地缓冲，增加条目页用） */
    insertEntry: insertEntry,       /* 新增（编辑界面用） */
    updateEntry: updateEntry,       /* 修改 */
    softDelete: softDelete,         /* 软删除：只标记不删行 */
    restoreEntry: restoreEntry,     /* 恢复 */
    archiveVersion: archiveVersion, /* 归档旧版本 */

    /* 工具 */
    newId: newId,
    remoteEnabled: remoteEnabled,
    readLocal: readLocal
  };
})();
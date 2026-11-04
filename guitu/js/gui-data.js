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

  /* 取组织验证签发的访问令牌（由 js/gui-gate.js 保存） */
  function accessToken() {
    if (window.GuiGate && typeof window.GuiGate.token === "function") {
      return window.GuiGate.token();
    }
    return "";
  }

  function headers(c, extra) {
    var h = {
      "Authorization": "Bearer " + c.key,
      "Content-Type": "application/json"
    };

    if (extra) for (var k in extra) h[k] = extra[k];

    /* 令牌放进 Prefer 头里传。
       为什么不用自定义头：CloudBase 网关的 CORS 允许头是固定白名单，
       不在名单里的头（比如 x-gui-token）会被浏览器预检拦掉；
       而名单里的 X-Client-Info 之类又会被网关吞掉，到不了数据库。
       只有 Prefer 既在白名单里、又会被转发给 PostgREST，
       而且 PostgREST 会忽略它不认识的指令，所以借它捎带令牌。 */
    var tok = accessToken();
    if (tok) {
      h["Prefer"] = (h["Prefer"] ? h["Prefer"] + ", " : "") + "gui-token=" + tok;
    }

    return h;
  }

  /* 判断某个错误是不是「没令牌 / 令牌过期」导致的，
     是的话清掉本地令牌，让用户重新验证一次。 */
  function isAuthError(err) {
    var msg = String((err && (err.body || err.message)) || "");
    return /42501|row-level security|JWT|permission denied/i.test(msg);
  }

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise(function (_, reject) {
        setTimeout(function () { reject(new Error("请求超时")); }, ms);
      })
    ]);
  }

  /* 读请求超时后重试一次。
     为什么需要：从没访问过本站的浏览器第一次连 CloudBase 网关，TLS 握手实测
     要十几秒，会先撞上 6 秒超时；一旦超时就会被当成「云端挂了」，触发 5 分钟
     熔断，首屏只能显示种子数据。第一次请求把连接握热之后重试通常几十毫秒就回来。
     只包读请求——写请求重试可能造成重复提交。 */
  function retryOnceOnTimeout(fn) {
    return fn().catch(function (err) {
      if (!/超时/.test(String(err && err.message))) throw err;
      return fn();
    });
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

  /* 数据库行 → 前端条目对象（列表、详情、检索共用同一套映射） */
  function mapRow(r) {
    return {
      id: r.id, title: r.title, image: r.image, images: r.images || [],
      thumbs: r.thumbs || [],
      refs: r.refs || [],
      intro: r.intro, body: r.body, tags: r.tags || [], date: r.date,
      deleted: !!r.deleted, updated_at: r.updated_at
    };
  }

  function mapRows(rows) {
    return (Array.isArray(rows) ? rows : []).map(mapRow);
  }

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
    }).then(mapRows);
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
    var c = cfg();

    /* 云端不可用时的兜底：代码里的种子条目 + 仓库文件 + 本机未同步条目。
       只在这条路径上才会用到代码内嵌的数据。 */
    function fallback() {
      return fetchRepoEntries().then(function (repo) {
        return merge(window.GUI_SEED_ENTRIES || [], repo, readLocal());
      });
    }

    /* 没配置云端，或者刚失败过（5 分钟冷却）：直接走兜底 */
    if (!c || isDown()) return fallback();

    /* 数据库是唯一数据源。
       读成功就只用数据库内容，不再合并 data/gui-entries.js 里的种子，
       否则种子和数据库里的同名条目会重复显示。 */
    return retryOnceOnTimeout(function () {
      return fetchCloud(c);
    }).then(function (rows) {
      return merge(rows, readLocal());
    }).catch(function (err) {
      markDown();
      console.warn("[鬼图鉴] 云端读取失败，改用种子数据兜底（5 分钟内不再重试）：", err.message);
      return fallback();
    });
  }

  /* ============================================================
     分页检索
     ------------------------------------------------------------
     列表页不再整表拉下来在浏览器里 filter，改成让数据库分页：
       ?deleted=eq.false&or=(title.ilike.*词*,intro.ilike.*词*,body.ilike.*词*)
       &order=created_at.desc,id.desc&limit=12&offset=0
     总数靠 Prefer: count=exact，从响应的 Content-Range（0-11/57）尾段取。
     ============================================================ */

  var PAGE_SIZE = 12;

  /* 关键词会拼进 PostgREST 的 or=(...) 表达式，
     逗号、括号、星号是表达式语法字符，实测出现即 400，先在客户端剔掉。 */
  function safeKeyword(q) {
    return String(q == null ? "" : q)
      .replace(/[,()*%"\\\u0000-\u001f]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /* Content-Range: 0-11/57 → 57；取不到就返回 -1 由调用方兜底 */
  function parseTotal(res) {
    var cr = res.headers && typeof res.headers.get === "function" ? res.headers.get("Content-Range") : "";
    var m = /\/(\d+)\s*$/.exec(cr || "");
    return m ? parseInt(m[1], 10) : -1;
  }

  function searchCloud(c, kw, page, pageSize) {
    var tail = "&order=created_at.desc,id.desc&limit=" + pageSize +
               "&offset=" + ((page - 1) * pageSize);
    var or = kw
      ? "&or=(title.ilike.*" + encodeURIComponent(kw) + "*" +
        ",intro.ilike.*" + encodeURIComponent(kw) + "*" +
        ",body.ilike.*" + encodeURIComponent(kw) + "*)"
      : "";
    var withDeleted = c.base + c.table + "?select=*&deleted=eq.false" + or + tail;
    var withoutDeleted = c.base + c.table + "?select=*" + or + tail;

    function attempt(url) {
      return withTimeout(
        fetch(url, { headers: headers(c, { "Prefer": "count=exact" }) }),
        TIMEOUT_MS
      ).then(function (res) {
        if (!res.ok) {
          return res.text().then(function (txt) {
            var err = new Error("检索失败 HTTP " + res.status + " " + txt.slice(0, 160));
            err.status = res.status;
            err.body = txt;
            throw err;
          });
        }
        var total = parseTotal(res);
        return res.json().then(function (rows) {
          return { items: mapRows(rows), total: total };
        });
      });
    }

    return attempt(withDeleted).catch(function (err) {
      /* 还没跑 version-setup.sql 时没有 deleted 字段，退回不带过滤的查询 */
      if (err.status === 400 && /deleted|PGRST204|42703/.test(err.body || err.message || "")) {
        return attempt(withoutDeleted);
      }
      throw err;
    }).then(function (r) {
      return { items: r.items, total: r.total >= 0 ? r.total : r.items.length, cloud: true };
    });
  }

  /* 兜底用的全量本地列表：种子 + 仓库文件 + 本机未同步 */
  function localAll() {
    return fetchRepoEntries().then(function (repo) {
      return merge(window.GUI_SEED_ENTRIES || [], repo, readLocal());
    });
  }

  function searchLocal(list, kw, page, pageSize) {
    var low = kw.toLowerCase();
    var shown = list.filter(function (e) {
      if (!e || !e.id || e.deleted) return false;
      if (!low) return true;
      var hay = [e.title, e.intro, e.body].join("\n").toLowerCase();
      return hay.indexOf(low) !== -1;
    });
    var start = (page - 1) * pageSize;
    return {
      items: shown.slice(start, start + pageSize),
      total: shown.length,
      cloud: false
    };
  }

  /* 分页检索。返回 { items, total, cloud } */
  function search(opts) {
    opts = opts || {};
    var kw = safeKeyword(opts.q);
    var page = Math.max(1, parseInt(opts.page, 10) || 1);
    var pageSize = Math.max(1, parseInt(opts.pageSize, 10) || PAGE_SIZE);
    var c = cfg();

    function fallback() {
      return localAll().then(function (all) {
        return searchLocal(all, kw, page, pageSize);
      });
    }

    if (!c || isDown()) return fallback();

    return retryOnceOnTimeout(function () {
      return searchCloud(c, kw, page, pageSize);
    }).catch(function (err) {
      markDown();
      console.warn("[鬼图鉴] 云端检索失败，改用本地兜底（5 分钟内不再重试）：", err.message);
      return fallback();
    });
  }

  /* 按 id 取单条。详情页原先走 list() 全表拉取，换成这个。 */
  function getEntry(id) {
    if (!id) return Promise.resolve(null);
    var c = cfg();

    /* 本机还没同步出去的条目优先，否则刚提交的内容详情页会 404 */
    var pending = readLocal().filter(function (e) { return e.id === id; })[0];
    if (pending) return Promise.resolve(pending);

    function fallback() {
      return localAll().then(function (all) {
        var hit = all.filter(function (e) { return e.id === id && !e.deleted; })[0];
        return hit || null;
      });
    }

    if (!c || isDown()) return fallback();

    var url = c.base + c.table + "?select=*&id=eq." + encodeURIComponent(id) + "&limit=1";
    return retryOnceOnTimeout(function () {
      return withTimeout(fetch(url, { headers: headers(c) }), TIMEOUT_MS);
    })
      .then(function (res) {
        if (!res.ok) throw new Error("读取失败 HTTP " + res.status);
        return res.json();
      })
      .then(function (rows) {
        var row = (Array.isArray(rows) ? rows : [])[0];
        if (!row || row.deleted) return null;
        return mapRow(row);
      })
      .catch(function (err) {
        console.warn("[鬼图鉴] 读取单条失败，改用本地兜底：", err.message);
        return fallback();
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

    /* 组装完整记录（含图片与缩略图）。
       数据库若还没迁移到对应字段，sendWithColumnFallback 会自动去掉再重试，
       所以「先发代码后跑 SQL」的中间状态也不会保存失败。 */
    var payload = {
      id: entry.id,
      title: entry.title,
      image: entry.image,
      images: entry.images || [],
      thumbs: entry.thumbs || [],
      intro: entry.intro,
      body: entry.body,
      tags: entry.tags || [],
      date: entry.date
    };

    return sendWithColumnFallback(url, "POST", payload, c).then(function () {
      /* 云端已保存，本地副本可以清掉（避免重复显示） */
      removeLocal(entry.id);
      return { entry: entry, remoteSaved: true, error: null };
    }).catch(function (err) {
      markDown();
      return { entry: entry, remoteSaved: false, error: err.message };
    });
  }
  /* ============================================================
     编辑 / 版本相关（需要数据库执行过 version-setup.sql）
     ============================================================ */

  /* ------------------------------------------------------------
     通用写入：先按原样发；如果数据库缺某个字段（PGRST204 / 42703），
     自动把那个字段去掉再重试，最多重试 3 次。
     这样在「缩略图字段还没迁移」的阶段，保存也不会失败。
     ------------------------------------------------------------ */
  function sendWithColumnFallback(url, method, payload, c) {
    var body = {};
    for (var k in payload) body[k] = payload[k];

    function attempt(left) {
      return withTimeout(
        fetch(url, {
          method: method,
          headers: headers(c, { "Prefer": "return=minimal" }),
          body: JSON.stringify(body)
        }),
        TIMEOUT_MS
      ).then(function (res) {
        if (res.ok) return res;

        return res.text().then(function (txt) {
          if ((res.status === 400 || res.status === 404) &&
              /PGRST204|42703/.test(txt) && left > 0) {
            /* 从错误信息里挖出缺的字段名，例如：
               Could not find the 'thumbs' column of 'gui_entries'
               column gui_entries.thumbs does not exist */
            var m = txt.match(/'([a-zA-Z_][a-zA-Z0-9_]*)' column/) ||
                    txt.match(/column [a-zA-Z_0-9]+\.([a-zA-Z_][a-zA-Z0-9_]*) does not exist/);
            var col = m && m[1];
            if (col && Object.prototype.hasOwnProperty.call(body, col)) {
              delete body[col];
              return attempt(left - 1);
            }
          }
          var err = new Error("保存失败 HTTP " + res.status + " " + txt.slice(0, 160));
          err.status = res.status;
          err.body = txt;

          /* 被 RLS 挡下 = 没令牌或令牌过期 → 清掉本地令牌，
             让用户重新验证一次（页面会跳回验证界面） */
          if (isAuthError(err)) {
            if (window.GuiGate && window.GuiGate.clearVerified) window.GuiGate.clearVerified();
            err.message = "验证已失效，请重新验证后再试。";
          }
          throw err;
        });
      });
    }

    return attempt(3).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (txt) {
          throw new Error("保存失败 HTTP " + res.status + " " + txt.slice(0, 160));
        });
      }
    });
  }
  /* 把条目内容整理成一行记录（版本表和条目表共用这些字段） */
  function toRow(e) {
    return {
      title: e.title,
      image: e.image || "",
      images: e.images || [],
      thumbs: e.thumbs || [],
      refs: e.refs || [],
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
    return retryOnceOnTimeout(function () {
      return withTimeout(
        fetch(url, { headers: headers(c) }).then(function (res) {
          if (!res.ok) throw new Error("读取失败 HTTP " + res.status);
          return res.json();
        }),
        TIMEOUT_MS
      );
    }).then(function (rows) {
      return (Array.isArray(rows) ? rows : []).map(function (r) {
        return {
          id: r.id, title: r.title, image: r.image, images: r.images || [],
          thumbs: r.thumbs || [],
          refs: r.refs || [],
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

    return sendWithColumnFallback(c.base + "gui_entry_versions", "POST", row, c)
      .then(function () { return row.version_id; });
  }

  /* 读所有版本（旧图鉴列表用） */
  function listVersions() {
    var c = cfg();
    if (!c || isDown()) return Promise.resolve([]);

    var url = c.base + "gui_entry_versions?select=*&applied=eq.false&order=archived_at.desc&limit=2000";
    return retryOnceOnTimeout(function () {
      return withTimeout(
        fetch(url, { headers: headers(c) }).then(function (res) {
          if (!res.ok) throw new Error("读取版本失败 HTTP " + res.status);
          return res.json();
        }),
        TIMEOUT_MS
      );
    }).then(function (rows) {
      return Array.isArray(rows) ? rows : [];
    }).catch(function (err) {
      markDown();
      console.warn("[鬼图鉴] 读取版本失败：", err.message);
      return [];
    });
  }

  /* 把一个版本标记为「已应用」——它已经变成当前内容，不该再出现在旧图鉴里。
     只写 applied 一个字段（数据库的列级授权也只允许改这一列）。 */
  function markVersionApplied(versionId) {
    var c = cfg();
    if (!c) return Promise.resolve();

    var url = c.base + "gui_entry_versions?version_id=eq." + encodeURIComponent(versionId);
    return sendWithColumnFallback(url, "PATCH", { applied: true }, c);
  }
  /* 改一个已有条目（PATCH），返回 Promise<void> */
  function updateEntry(entry) {
    var c = cfg();
    if (!c) return Promise.reject(new Error("云数据库未配置"));

    var row = toRow(entry);
    row.updated_at = new Date().toISOString();

    var url = c.base + c.table + "?id=eq." + encodeURIComponent(entry.id);
    return sendWithColumnFallback(url, "PATCH", row, c);
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

    return sendWithColumnFallback(c.base + c.table, "POST", row, c);
  }
  function newId() {
    return "gu-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  /* ============================================================
     情报（投稿）—— 独立的 gui_tips 表
     ------------------------------------------------------------
     和图鉴彻底分开：图鉴的查询永远不碰这张表，反之亦然。
     投稿不需要组织验证（开放），所以这里不带令牌也能写。
     ============================================================ */

  var TIPS_TABLE = "gui_tips";

  function mapTip(r) {
    return {
      id: r.id,
      title: r.title,
      image: r.image,
      images: r.images || [],
      thumbs: r.thumbs || [],
      intro: r.intro,
      body: r.body,
      tags: r.tags || [],
      date: r.date,
      created_at: r.created_at,
      status: r.status || "pending",
      reviewed_at: r.reviewed_at || null,
      review_note: r.review_note || ""
    };
  }

  /* 读取情报。
     statuses 不传 → 取当前身份能看到的全部（公开身份只拿得到已通过的，
     数据库策略 gui_tips_read 负责过滤）。
     传 ["pending"] → 审核用，只有带有效令牌才拿得到。 */
  function listTips(statuses) {
    var c = cfg();
    if (!c) return Promise.resolve([]);

    var url = c.base + TIPS_TABLE + "?select=*&order=created_at.desc&limit=1000";
    if (statuses && statuses.length) {
      url += "&status=in.(" + statuses.map(encodeURIComponent).join(",") + ")";
    }

    return retryOnceOnTimeout(function () {
      return withTimeout(fetch(url, { headers: headers(c) }), TIMEOUT_MS);
    })
      .then(function (res) {
        if (!res.ok) {
          return res.text().then(function (txt) {
            throw new Error("读取情报失败 HTTP " + res.status + " " + txt.slice(0, 140));
          });
        }
        return res.json();
      })
      .then(function (rows) { return (rows || []).map(mapTip); });
  }

  /* 改一条情报的审核状态。需要组织验证令牌，没有会被 RLS 挡掉。
     刻意不用 Prefer: return=representation：带行数据返回时数据库会拿 SELECT
     策略去筛返回行，而「待审 / 已驳回」对匿名不可见，连写入都会被判成违反
     策略（实测 42501）。所以改成：先 PATCH（minimal），再带令牌读回来比对。
     这样「RLS 静默影响 0 行」也能被发现。 */
  function setTipStatus(id, status, note) {
    var c = cfg();
    if (!c) return Promise.reject(new Error("云服务未配置"));
    if (!accessToken()) return Promise.reject(new Error("需要先通过组织验证"));

    var url = c.base + TIPS_TABLE + "?id=eq." + encodeURIComponent(id);
    var row = { status: status, reviewed_at: new Date().toISOString(), review_note: note || "" };

    return withTimeout(
      fetch(url, {
        method: "PATCH",
        headers: headers(c, { "Prefer": "return=minimal" }),
        body: JSON.stringify(row)
      }),
      TIMEOUT_MS
    ).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (txt) {
          var err = new Error("审核失败 HTTP " + res.status + " " + txt.slice(0, 140));
          err.status = res.status;
          err.body = txt;
          throw err;
        });
      }
      return withTimeout(
        fetch(url + "&select=*&limit=1", { headers: headers(c) }),
        TIMEOUT_MS
      );
    }).then(function (res) {
      if (!res.ok) throw new Error("审核后校验失败 HTTP " + res.status);
      return res.json();
    }).then(function (rows) {
      var got = (Array.isArray(rows) ? rows : [])[0];
      if (!got) throw new Error("没有权限修改这条情报，或它已不存在。");
      if (got.status !== status) throw new Error("状态没改成，可能是验证已失效。");
      return mapTip(got);
    });
  }

  /* 查重：拿标题去数据库比相似度，返回 [{kind,id,title,score}]。
     查重只是提示，失败一律返回空数组，不阻塞提交。 */
  function dupCheck(title) {
    var c = cfg();
    if (!c) return Promise.resolve([]);

    return withTimeout(
      fetch(c.base + "rpc/gui_dup_check", {
        method: "POST",
        headers: headers(c),
        body: JSON.stringify({ p_text: String(title || "") })
      }),
      TIMEOUT_MS
    ).then(function (res) {
      if (!res.ok) throw new Error("查重失败 HTTP " + res.status);
      return res.json();
    }).then(function (data) {
      return Array.isArray(data) ? data : [];
    }).catch(function (err) {
      console.warn("[鬼图鉴] 查重失败，跳过：", err.message);
      return [];
    });
  }

  /* 提交一条情报 */
  function addTip(tip) {
    var c = cfg();
    if (!c) return Promise.reject(new Error("云服务未配置"));

    var row = {
      id: tip.id,
      title: tip.title,
      image: tip.image || "",
      images: tip.images || [],
      thumbs: tip.thumbs || [],
      intro: tip.intro || "",
      body: tip.body,
      tags: tip.tags || [],
      date: tip.date || ""
    };
    return sendWithColumnFallback(c.base + TIPS_TABLE, "POST", row, c);
  }
  window.GuiData = {
    /* 读 */
    list: list,                     /* 公开列表：只含未删除的（保留兼容，新代码用 search） */
    search: search,                 /* 分页 + 全文检索：{ q, page, pageSize } */
    getEntry: getEntry,             /* 按 id 取单条 */
    PAGE_SIZE: PAGE_SIZE,
    listAll: listAll,               /* 全部条目：含已删除的 */
    listVersions: listVersions,     /* 所有历史版本 */

    /* 写 */
    add: add,                       /* 新增（带本地缓冲，增加条目页用） */
    insertEntry: insertEntry,       /* 新增（编辑界面用） */
    updateEntry: updateEntry,       /* 修改 */
    softDelete: softDelete,         /* 软删除：只标记不删行 */
    restoreEntry: restoreEntry,     /* 恢复 */
    archiveVersion: archiveVersion, /* 归档旧版本 */
    markVersionApplied: markVersionApplied, /* 标记版本已应用（从旧图鉴隐藏） */

    /* 情报（投稿） */
    listTips: listTips,
    addTip: addTip,
    setTipStatus: setTipStatus,     /* 审核：改状态，需令牌 */
    dupCheck: dupCheck,             /* 投稿前查重（标题相似度） */

    /* 工具 */
    newId: newId,
    remoteEnabled: remoteEnabled,
    readLocal: readLocal
  };
})();
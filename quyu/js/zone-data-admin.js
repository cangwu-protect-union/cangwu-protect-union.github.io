/* 异常区域档案 · 数据访问层 · 写入、检索与版本分片
   只往 window.ZoneData 挂函数，在 zone-data.js 之前加载。 */
(function () {
  "use strict";
  var P = window.ZoneData || (window.ZoneData = {});


  P.searchCloud = function (c, kw, page, pageSize) {
    var tail = "&order=created_at.desc,id.desc&limit=" + pageSize +
               "&offset=" + ((page - 1) * pageSize);
    var or = kw
      ? "&or=(title.ilike.*" + encodeURIComponent(kw) + "*" +
        ",intro.ilike.*" + encodeURIComponent(kw) + "*" +
        ",body.ilike.*" + encodeURIComponent(kw) + "*" +
        ",tags.cs." + encodeURIComponent("{" + kw + "}") + ")"
      : "";
    var withDeleted = c.base + c.table + "?select=*&deleted=eq.false" + or + tail;
    var withoutDeleted = c.base + c.table + "?select=*" + or + tail;

    function attempt(url) {
      return P.withTimeout(
        fetch(url, { headers: P.headers(c, { "Prefer": "count=exact" }) }),
        P.TIMEOUT_MS
      ).then(function (res) {
        if (!res.ok) {
          return res.text().then(function (txt) {
            var err = new Error("检索失败 HTTP " + res.status + " " + txt.slice(0, 160));
            err.status = res.status;
            err.body = txt;
            throw err;
          });
        }
        var total = P.parseTotal(res);
        return res.json().then(function (rows) {
          return { items: P.mapRows(rows), total: total };
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

  P.localAll = function () {
    return P.fetchRepoEntries().then(function (repo) {
      return P.merge(window.ZONE_SEED_ZONES || [], repo, P.readLocal());
    });
  }

  P.searchLocal = function (localList, kw, page, pageSize) {
    var low = kw.toLowerCase();
    var shown = localList.filter(function (e) {
      if (!e || !e.id || e.deleted) return false;
      if (!low) return true;
      var hay = [e.title, e.intro, e.body].concat(e.tags || []).join("\n").toLowerCase();
      return hay.indexOf(low) !== -1;
    });
    var start = (page - 1) * pageSize;
    return {
      items: shown.slice(start, start + pageSize),
      total: shown.length,
      cloud: false
    };
  }

  P.search = function (opts) {
    opts = opts || {};
    var kw = P.safeKeyword(opts.q);
    var page = Math.max(1, parseInt(opts.page, 10) || 1);
    var pageSize = Math.max(1, parseInt(opts.pageSize, 10) || P.PAGE_SIZE);
    var c = P.cfg();

    function fallback() {
      return P.localAll().then(function (all) {
        return P.searchLocal(all, kw, page, pageSize);
      });
    }

    if (!c || P.isDown()) return fallback();

    return P.retryOnceOnTimeout(function () {
      return P.searchCloud(c, kw, page, pageSize);
    }).catch(function (err) {
      P.markDown();
      console.warn("[异常区域档案] 云端检索失败，改用本地兜底（5 分钟内不再重试）：", err.message);
      return fallback();
    });
  }

  P.getEntryAny = function (id) {
    if (!id) return Promise.resolve(null);
    var c = P.cfg();
    if (!c) return Promise.resolve(null);

    var url = c.base + c.table + "?select=*&id=eq." + encodeURIComponent(id) + "&limit=1";
    return P.retryOnceOnTimeout(function () {
      return P.withTimeout(fetch(url, { headers: P.headers(c) }), P.TIMEOUT_MS);
    })
      .then(function (res) {
        if (!res.ok) throw new Error("读取失败 HTTP " + res.status);
        return res.json();
      })
      .then(function (rows) {
        var row = (Array.isArray(rows) ? rows : [])[0];
        return row ? P.mapRow(row) : null;
      });
  }

  P.getEntry = function (id) {
    if (!id) return Promise.resolve(null);
    var c = P.cfg();

    /* 本机还没同步出去的条目优先，否则刚提交的内容详情页会 404 */
    var pending = P.readLocal().filter(function (e) { return e.id === id; })[0];
    if (pending) return Promise.resolve(pending);

    function fallback() {
      return P.localAll().then(function (all) {
        var hit = all.filter(function (e) { return e.id === id && !e.deleted; })[0];
        return hit || null;
      });
    }

    if (!c || P.isDown()) return fallback();

    var url = c.base + c.table + "?select=*&id=eq." + encodeURIComponent(id) + "&limit=1";
    return P.retryOnceOnTimeout(function () {
      return P.withTimeout(fetch(url, { headers: P.headers(c) }), P.TIMEOUT_MS);
    })
      .then(function (res) {
        if (!res.ok) throw new Error("读取失败 HTTP " + res.status);
        return res.json();
      })
      .then(function (rows) {
        var row = (Array.isArray(rows) ? rows : [])[0];
        if (!row || row.deleted) return null;
        return P.mapRow(row);
      })
      .catch(function (err) {
        console.warn("[异常区域档案] 读取单条失败，改用本地兜底：", err.message);
        return fallback();
      });
  }

  P.add = function (entry) {
    var c = P.cfg();

    /* 先写本地：保证即使云端失败，用户的内容也不会丢 */
    var local = P.readLocal();
    local.push(entry);
    P.writeLocal(local);

    if (!c || P.isDown()) {
      return Promise.resolve({ entry: entry, remoteSaved: false, error: null });
    }

    var url = c.base + c.table;

    /* 组装完整记录（含图片与缩略图）。
       数据库若还没迁移到对应字段，sendWithColumnFallback 会自动去掉再重试，
       所以「先发代码后跑 SQL」的中间状态也不会保存失败。 */
    var payload = {
      id: entry.id,
      title: entry.title,
      lng: entry.lng,
      lat: entry.lat,
      image: entry.image,
      images: entry.images || [],
      thumbs: entry.thumbs || [],
      related: entry.related || [],
      refs: entry.refs || [],
      intro: entry.intro,
      body: entry.body,
      tags: entry.tags || [],
      date: entry.date
    };

    return P.sendWithColumnFallback(url, "POST", payload, c).then(function () {
      /* 云端已保存，本地副本可以清掉（避免重复显示） */
      P.removeLocal(entry.id);
      return { entry: entry, remoteSaved: true, error: null };
    }).catch(function (err) {
      P.markDown();
      return { entry: entry, remoteSaved: false, error: err.message };
    });
  }

  P.sendWithColumnFallback = function (url, method, payload, c) {
    var body = {};
    for (var k in payload) body[k] = payload[k];

    function attempt(left) {
      return P.withTimeout(
        fetch(url, {
          method: method,
          headers: P.headers(c, { "Prefer": "return=minimal" }),
          body: JSON.stringify(body)
        }),
        P.TIMEOUT_MS
      ).then(function (res) {
        if (res.ok) return res;

        return res.text().then(function (txt) {
          if ((res.status === 400 || res.status === 404) &&
              /PGRST204|42703/.test(txt) && left > 0) {
            /* 从错误信息里挖出缺的字段名，例如：
               Could not find the 'thumbs' column of 'gui_zones'
               column gui_zones.thumbs does not exist */
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
          if (P.isAuthError(err)) {
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

  P.toRow = function (e) {
    return {
      title: e.title,
      lng: e.lng == null ? null : Number(e.lng),
      lat: e.lat == null ? null : Number(e.lat),
      image: e.image || "",
      images: e.images || [],
      thumbs: e.thumbs || [],
      related: e.related || [],
      refs: e.refs || [],
      intro: e.intro || "",
      body: e.body || "",
      tags: e.tags || [],
      date: e.date || ""
    };
  }

  P.listAll = function () {
    var c = P.cfg();
    if (!c || P.isDown()) return Promise.resolve([]);

    var url = c.base + c.table + "?select=*&order=created_at.desc&limit=1000";
    return P.retryOnceOnTimeout(function () {
      return P.withTimeout(
        fetch(url, { headers: P.headers(c) }).then(function (res) {
          if (!res.ok) throw new Error("读取失败 HTTP " + res.status);
          return res.json();
        }),
        P.TIMEOUT_MS
      );
    }).then(function (rows) {
      return (Array.isArray(rows) ? rows : []).map(function (r) {
        return {
          id: r.id, title: r.title,
          lng: P.numOrNull(r.lng), lat: P.numOrNull(r.lat),
          image: r.image, images: r.images || [],
          thumbs: r.thumbs || [],
          related: r.related || [],
          refs: r.refs || [],
          intro: r.intro, body: r.body, tags: r.tags || [], date: r.date,
          deleted: !!r.deleted, updated_at: r.updated_at, created_at: r.created_at,
          editor: r.editor || "CPU", edited_at: r.edited_at || null
        };
      });
    }).catch(function (err) {
      P.markDown();
      console.warn("[异常区域档案] 读取全部条目失败：", err.message);
      return [];
    });
  }

  P.archiveVersion = function (entry, reason) {
    var c = P.cfg();
    if (!c) return Promise.reject(new Error("云数据库未配置"));

    var row = P.toRow(entry);
    row.version_id = "v-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
    row.zone_id = entry.id;
    row.reason = reason || "edit";

    return P.sendWithColumnFallback(c.base + "gui_zone_versions", "POST", row, c)
      .then(function () { return row.version_id; });
  }

  P.listVersions = function () {
    var c = P.cfg();
    if (!c || P.isDown()) return Promise.resolve([]);

    var url = c.base + "gui_zone_versions?select=*&applied=eq.false&order=archived_at.desc&limit=2000";
    return P.retryOnceOnTimeout(function () {
      return P.withTimeout(
        fetch(url, { headers: P.headers(c) }).then(function (res) {
          if (!res.ok) throw new Error("读取版本失败 HTTP " + res.status);
          return res.json();
        }),
        P.TIMEOUT_MS
      );
    }).then(function (rows) {
      return Array.isArray(rows) ? rows : [];
    }).catch(function (err) {
      P.markDown();
      console.warn("[异常区域档案] 读取版本失败：", err.message);
      return [];
    });
  }

  P.markVersionApplied = function (versionId) {
    var c = P.cfg();
    if (!c) return Promise.resolve();

    var url = c.base + "gui_zone_versions?version_id=eq." + encodeURIComponent(versionId);
    return P.sendWithColumnFallback(url, "PATCH", { applied: true }, c);
  }

  P.listVersionsForZone = function (zoneId) {
    var c = P.cfg();
    if (!c || P.isDown() || !zoneId) return Promise.resolve([]);

    var url = c.base + "gui_zone_versions?select=*&zone_id=eq." +
              encodeURIComponent(zoneId) + "&order=archived_at.desc&limit=500";

    return P.retryOnceOnTimeout(function () {
      return P.withTimeout(fetch(url, { headers: P.headers(c) }), P.TIMEOUT_MS);
    })
      .then(function (res) {
        if (!res.ok) throw new Error("读取版本失败 HTTP " + res.status);
        return res.json();
      })
      .then(function (rows) { return Array.isArray(rows) ? rows : []; })
      .catch(function (err) {
        P.markDown();
        console.warn("[异常区域档案] 读取区域版本失败：", err.message);
        return [];
      });
  }

  P.getVersion = function (versionId) {
    var c = P.cfg();
    if (!c || !versionId) return Promise.resolve(null);

    var url = c.base + "gui_zone_versions?select=*&version_id=eq." +
              encodeURIComponent(versionId) + "&limit=1";

    return P.withTimeout(fetch(url, { headers: P.headers(c) }), P.TIMEOUT_MS)
      .then(function (res) {
        if (!res.ok) throw new Error("读取版本失败 HTTP " + res.status);
        return res.json();
      })
      .then(function (rows) { return (Array.isArray(rows) ? rows : [])[0] || null; })
      .catch(function () { return null; });
  }

  P.updateEntry = function (entry) {
    var c = P.cfg();
    if (!c) return Promise.reject(new Error("云数据库未配置"));

    var row = P.toRow(entry);
    row.updated_at = new Date().toISOString();
    row.editor = entry.editor || "CPU";
    row.edited_at = row.updated_at;

    var url = c.base + c.table + "?id=eq." + encodeURIComponent(entry.id);
    return P.sendWithColumnFallback(url, "PATCH", row, c);
  }

  P.softDelete = function (entryId, member) {
    var c = P.cfg();
    if (!c) return Promise.reject(new Error("云数据库未配置"));

    var now = new Date().toISOString();
    var url = c.base + c.table + "?id=eq." + encodeURIComponent(entryId);
    return P.sendWithColumnFallback(url, "PATCH",
      { deleted: true, updated_at: now, edited_at: now, editor: member || "CPU" }, c);
  }

  P.restoreEntry = function (entryId, content, member) {
    var c = P.cfg();
    if (!c) return Promise.reject(new Error("云数据库未配置"));

    var row = content ? P.toRow(content) : {};
    row.deleted = false;
    row.updated_at = new Date().toISOString();
    row.edited_at = row.updated_at;
    row.editor = member || "CPU";

    var url = c.base + c.table + "?id=eq." + encodeURIComponent(entryId);
    return P.sendWithColumnFallback(url, "PATCH", row, c);
  }

  P.insertEntry = function (entry) {
    var c = P.cfg();
    if (!c) return Promise.reject(new Error("云数据库未配置"));

    var row = P.toRow(entry);
    row.id = entry.id;
    row.editor = entry.editor || "CPU";
    row.edited_at = new Date().toISOString();

    return P.sendWithColumnFallback(c.base + c.table, "POST", row, c);
  }

  P.newId = function () {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (ch) {
      var r = Math.random() * 16 | 0;
      var v = ch === "x" ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
})();

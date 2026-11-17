/* 鬼图鉴 · 数据访问层 · 写入、检索与情报分片
   只往 window.GuiData 挂函数，在 gui-data.js 之前加载。 */
(function () {
  "use strict";
  var P = window.GuiData || (window.GuiData = {});


  P.searchCloud = function (c, kw, page, pageSize) {
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
      return P.merge(window.GUI_SEED_ENTRIES || [], repo, P.readLocal());
    });
  }

  P.searchLocal = function (localList, kw, page, pageSize) {
    var low = kw.toLowerCase();
    var shown = localList.filter(function (e) {
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
      console.warn("[鬼图鉴] 云端检索失败，改用本地兜底（5 分钟内不再重试）：", err.message);
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
      image: entry.image,
      images: entry.images || [],
      thumbs: entry.thumbs || [],
      related: entry.related || [],
      refs: entry.refs || [],
      intro: entry.intro,
      body: entry.body,
      tags: entry.tags || [],
      date: entry.date,
      editor: entry.editor || "CPU",
      edited_at: new Date().toISOString()
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
      image: e.image || "",
      images: e.images || [],
      thumbs: e.thumbs || [],
      refs: e.refs || [],
      related: e.related || [],
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
          id: r.id, title: r.title, image: r.image, images: r.images || [],
          thumbs: r.thumbs || [],
          refs: r.refs || [],
          related: r.related || [],
          intro: r.intro, body: r.body, tags: r.tags || [], date: r.date,
          deleted: !!r.deleted, updated_at: r.updated_at, created_at: r.created_at,
          editor: r.editor || "CPU", edited_at: r.edited_at || null
        };
      });
    }).catch(function (err) {
      P.markDown();
      console.warn("[鬼图鉴] 读取全部条目失败：", err.message);
      return [];
    });
  }

  P.archiveVersion = function (entry, reason) {
    var c = P.cfg();
    if (!c) return Promise.reject(new Error("云数据库未配置"));

    var row = P.toRow(entry);
    row.version_id = "v-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
    row.entry_id = entry.id;
    row.reason = reason || "edit";

    return P.sendWithColumnFallback(c.base + "gui_entry_versions", "POST", row, c)
      .then(function () { return row.version_id; });
  }

  P.listVersions = function () {
    var c = P.cfg();
    if (!c || P.isDown()) return Promise.resolve([]);

    var url = c.base + "gui_entry_versions?select=*&applied=eq.false&order=archived_at.desc&limit=2000";
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
      console.warn("[鬼图鉴] 读取版本失败：", err.message);
      return [];
    });
  }

  P.markVersionApplied = function (versionId) {
    var c = P.cfg();
    if (!c) return Promise.resolve();

    var url = c.base + "gui_entry_versions?version_id=eq." + encodeURIComponent(versionId);
    return P.sendWithColumnFallback(url, "PATCH", { applied: true }, c);
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
    return "gu-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  P.mapTip = function (r) {
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

  P.listTips = function (statuses) {
    var c = P.cfg();
    if (!c) return Promise.resolve([]);

    var url = c.base + P.TIPS_TABLE + "?select=*&order=created_at.desc&limit=1000";
    if (statuses && statuses.length) {
      url += "&status=in.(" + statuses.map(encodeURIComponent).join(",") + ")";
    }

    return P.retryOnceOnTimeout(function () {
      return P.withTimeout(fetch(url, { headers: P.headers(c) }), P.TIMEOUT_MS);
    })
      .then(function (res) {
        if (!res.ok) {
          return res.text().then(function (txt) {
            throw new Error("读取情报失败 HTTP " + res.status + " " + txt.slice(0, 140));
          });
        }
        return res.json();
      })
      .then(function (rows) { return (rows || []).map(P.mapTip); });
  }

  P.setTipStatus = function (id, status, note) {
    var c = P.cfg();
    if (!c) return Promise.reject(new Error("云服务未配置"));
    if (!P.accessToken()) return Promise.reject(new Error("需要先通过组织验证"));

    var url = c.base + P.TIPS_TABLE + "?id=eq." + encodeURIComponent(id);
    var row = { status: status, reviewed_at: new Date().toISOString(), review_note: note || "" };

    return P.withTimeout(
      fetch(url, {
        method: "PATCH",
        headers: P.headers(c, { "Prefer": "return=minimal" }),
        body: JSON.stringify(row)
      }),
      P.TIMEOUT_MS
    ).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (txt) {
          var err = new Error("审核失败 HTTP " + res.status + " " + txt.slice(0, 140));
          err.status = res.status;
          err.body = txt;
          throw err;
        });
      }
      return P.withTimeout(
        fetch(url + "&select=*&limit=1", { headers: P.headers(c) }),
        P.TIMEOUT_MS
      );
    }).then(function (res) {
      if (!res.ok) throw new Error("审核后校验失败 HTTP " + res.status);
      return res.json();
    }).then(function (rows) {
      var got = (Array.isArray(rows) ? rows : [])[0];
      if (!got) throw new Error("没有权限修改这条情报，或它已不存在。");
      if (got.status !== status) throw new Error("状态没改成，可能是验证已失效。");
      return P.mapTip(got);
    });
  }

  P.dupCheck = function (title) {
    var c = P.cfg();
    if (!c) return Promise.resolve([]);

    return P.withTimeout(
      fetch(c.base + "rpc/gui_dup_check", {
        method: "POST",
        headers: P.headers(c),
        body: JSON.stringify({ p_text: String(title || "") })
      }),
      P.TIMEOUT_MS
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

  P.addTip = function (tip) {
    var c = P.cfg();
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
    return P.sendWithColumnFallback(c.base + P.TIPS_TABLE, "POST", row, c);
  }
})();

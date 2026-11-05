/* ============================================================
   relation-utils.js —— 关联条目（鬼 ↔ 区域）的共用逻辑
   ------------------------------------------------------------
   存法：条目上有一个 related 字符串数组，元素形如
     "ghost:gu-gushan"        鬼图鉴条目
     "zone:8f3c2a1e-…"        异常区域
   单向存储、双向显示：A 引用 B 只写进 A 的 related；
   要在 B 的页面看到 A，就反查「谁的 related 里含 zone:<B>」。

   改关联等于编辑条目，所以「删掉别人的关联」要先把对方归档成旧版本，
   再改它的 related。归档字段走 sendWithColumnFallback，缺列自动去掉。
   ============================================================ */
(function () {
  "use strict";

  var TIMEOUT_MS = 6000;

  var TABLES = {
    ghost: {
      entry: "gui_entries",
      versions: "gui_entry_versions",
      versionKey: "entry_id"
    },
    zone: {
      entry: "gui_zones",
      versions: "gui_zone_versions",
      versionKey: "zone_id"
    }
  };

  /* 归档时从条目行里带过去的字段；版本表没有的列会在发送时被自动去掉 */
  var SNAPSHOT_FIELDS = ["title", "image", "images", "thumbs", "intro", "body",
                         "tags", "date", "refs", "related"];

  function cfg() {
    var c = window.GUI_CLOUDBASE || {};
    if (!c.envId || !c.publishableKey) return null;
    return {
      base: "https://" + String(c.envId).trim() + ".api.tcloudbasegateway.com/v1/rdb/rest/",
      key: String(c.publishableKey).trim()
    };
  }

  function token() {
    return (window.GuiGate && typeof window.GuiGate.token === "function") ? window.GuiGate.token() : "";
  }

  function headers(extra) {
    var c = cfg();
    var h = { Authorization: "Bearer " + c.key, "Content-Type": "application/json" };
    var t = token();
    if (t) h.Prefer = "gui-token=" + t;
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }

  function withTimeout(p, ms) {
    return Promise.race([p, new Promise(function (_, rej) {
      setTimeout(function () { rej(new Error("请求超时")); }, ms);
    })]);
  }

  function get(path) {
    var c = cfg();
    if (!c) return Promise.resolve([]);
    return withTimeout(fetch(c.base + path, { headers: headers() }), TIMEOUT_MS)
      .then(function (r) {
        if (!r.ok) throw new Error("读取失败 HTTP " + r.status);
        return r.json();
      })
      .then(function (rows) { return Array.isArray(rows) ? rows : []; });
  }

  /* ---------------- 编码 ---------------- */

  function enc(type, id) {
    return String(type) + ":" + String(id);
  }

  function dec(s) {
    var str = String(s || "");
    var i = str.indexOf(":");
    if (i <= 0) return null;
    var type = str.slice(0, i);
    var id = str.slice(i + 1);
    if (!id) return null;
    if (type !== "ghost" && type !== "zone") return null;
    return { type: type, id: id };
  }

  function parse(list) {
    var out = [], seen = {};
    (list || []).forEach(function (s) {
      var d = dec(s);
      if (!d) return;
      var k = d.type + ":" + d.id;
      if (seen[k]) return;
      seen[k] = 1;
      out.push(d);
    });
    return out;
  }

  function encode(parts) {
    var out = [], seen = {};
    (parts || []).forEach(function (p) {
      if (!p || !p.type || !p.id) return;
      var k = enc(p.type, p.id);
      if (seen[k]) return;
      seen[k] = 1;
      out.push(k);
    });
    return out;
  }

  /* ---------------- 取标题 ---------------- */

  function titlesFor(parts) {
    var ghosts = parts.filter(function (p) { return p.type === "ghost"; }).map(function (p) { return p.id; });
    var zones = parts.filter(function (p) { return p.type === "zone"; }).map(function (p) { return p.id; });

    function fetchIds(table, ids) {
      if (!ids.length) return Promise.resolve([]);
      var q = ids.map(function (x) { return encodeURIComponent(x); }).join(",");
      return get(table + "?select=id,title&limit=300&id=in.(" + q + ")").catch(function () { return []; });
    }

    return Promise.all([fetchIds("gui_entries", ghosts), fetchIds("gui_zones", zones)])
      .then(function (rs) {
        var map = {};
        rs.forEach(function (rows) {
          rows.forEach(function (r) { map[r.id] = r.title; });
        });
        return parts.map(function (p) {
          return { type: p.type, id: p.id, title: map[p.id] || p.id };
        });
      });
  }

  /* ---------------- 读 ---------------- */

  function fetchEntry(type, id) {
    var t = TABLES[type];
    if (!t || !id) return Promise.resolve(null);
    return get(t.entry + "?select=*&id=eq." + encodeURIComponent(id) + "&limit=1")
      .then(function (rows) { return rows[0] || null; });
  }

  /* 反向：谁的 related 里含这个 token */
  function reverseOwners(type, id) {
    var needle = enc(type, id);
    var q = encodeURIComponent("{" + needle + "}");

    function scan(ownerType) {
      var t = TABLES[ownerType];
      return get(t.entry + "?select=id,title,related&deleted=eq.false&limit=200&related=cs." + q)
        .catch(function () { return []; })
        .then(function (rows) {
          return rows.map(function (r) {
            return { ownerType: ownerType, ownerId: r.id, title: r.title };
          });
        });
    }

    return Promise.all([scan("ghost"), scan("zone")]).then(function (rs) {
      var all = rs[0].concat(rs[1]);
      /* 自己的记录不算反向 */
      return all.filter(function (o) { return !(o.ownerType === type && o.ownerId === id); });
    });
  }

  /**
   * 某个条目看到的全部关联（正向 + 反向），带标题。
   * 返回 [{ type, id, title, ownerType, ownerId, own }]
   *   own = true 表示这条关系存在「我自己」的 related 里，可以随保存一起改
   */
  function listFor(type, id) {
    return fetchEntry(type, id).then(function (row) {
      var forward = parse(row && row.related);
      return Promise.all([
        titlesFor(forward),
        reverseOwners(type, id)
      ]).then(function (rs) {
        var items = rs[0].map(function (f) {
          return { type: f.type, id: f.id, title: f.title, ownerType: type, ownerId: id, own: true };
        });

        var owners = rs[1];
        if (!owners.length) return items;

        return Promise.all(owners.map(function (o) {
          return fetchEntry(o.ownerType, o.ownerId).then(function (r) {
            return { owner: o, related: parse(r && r.related) };
          });
        })).then(function (pairs) {
          var extra = [];
          pairs.forEach(function (p) {
            var has = p.related.some(function (x) { return x.type === type && x.id === id; });
            if (!has) return;
            extra.push({
              type: p.owner.ownerType, id: p.owner.ownerId, title: p.owner.title,
              ownerType: p.owner.ownerType, ownerId: p.owner.ownerId, own: false
            });
          });
          return items.concat(extra);
        });
      });
    });
  }

  /* ---------------- 写 ---------------- */

  function sendWithColumnFallback(url, method, payload, left) {
    var body = {};
    for (var k in payload) body[k] = payload[k];

    return fetch(url, { method: method, headers: headers({ Prefer: "return=minimal" }), body: JSON.stringify(body) })
      .then(function (res) {
        if (res.ok) return res;
        return res.text().then(function (txt) {
          if ((res.status === 400 || res.status === 404) && /PGRST204|42703/.test(txt) && (left | 0) > 0) {
            var m = txt.match(/'([a-zA-Z_][a-zA-Z0-9_]*)' column/) ||
                    txt.match(/column [a-zA-Z_0-9]+\.([a-zA-Z_][a-zA-Z0-9_]*) does not exist/);
            var col = m && m[1];
            if (col && Object.prototype.hasOwnProperty.call(body, col)) {
              delete body[col];
              return sendWithColumnFallback(url, method, body, (left | 0) - 1);
            }
          }
          var err = new Error("保存失败 HTTP " + res.status + " " + txt.slice(0, 160));
          err.status = res.status;
          err.body = txt;
          throw err;
        });
      });
  }

  /* 把一行条目归档进版本表 */
  function archive(type, row) {
    var t = TABLES[type];
    var payload = { version_id: "v-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7) };
    payload[t.versionKey] = row.id;
    payload.reason = "edit";
    SNAPSHOT_FIELDS.forEach(function (f) {
      if (row[f] !== undefined && row[f] !== null) payload[f] = row[f];
    });

    var c = cfg();
    return sendWithColumnFallback(c.base + t.versions, "POST", payload, 3);
  }

  /**
   * 从某个条目里删掉若干 token（用于删反向关联）。
   * 会先归档该条目，再改它的 related。
   */
  function removeFrom(ownerType, ownerId, tokens) {
    var t = TABLES[ownerType];
    var c = cfg();
    if (!c) return Promise.reject(new Error("云服务未配置"));

    var del = {};
    (tokens || []).forEach(function (x) { del[x] = 1; });

    return fetchEntry(ownerType, ownerId).then(function (row) {
      if (!row) throw new Error("找不到这条条目");
      var kept = (row.related || []).filter(function (x) { return !del[x]; });

      return archive(ownerType, row).then(function () {
        return withTimeout(fetch(
          c.base + t.entry + "?id=eq." + encodeURIComponent(ownerId),
          {
            method: "PATCH",
            headers: headers({ Prefer: "return=minimal" }),
            body: JSON.stringify({ related: kept, updated_at: new Date().toISOString() })
          }
        ), TIMEOUT_MS).then(function (res) {
          if (!res.ok) {
            return res.text().then(function (txt) { throw new Error("删除关联失败 HTTP " + res.status + " " + txt.slice(0, 120)); });
          }
          return kept;
        });
      });
    });
  }

  /* ---------------- 选择器用：可关联的条目 ---------------- */

  function targets(type, excludeId) {
    var table = type === "ghost" ? "gui_entries" : "gui_zones";
    return get(table + "?select=id,title&deleted=eq.false&order=created_at.desc&limit=300")
      .catch(function () { return []; })
      .then(function (rows) {
        return rows
          .filter(function (r) { return r.id !== excludeId; })
          .map(function (r) { return { type: type, id: r.id, title: r.title }; });
      });
  }

  /* ---------------- 选择器的临时数据 ---------------- */

  var PICK_KEY = "quyu_relation_pick";

  function openPicker(url, opts) {
    opts = opts || {};
    var payload = {
      selected: opts.selected || [],
      selfType: opts.selfType || "",
      selfId: opts.selfId || "",
      returnTo: opts.returnTo || (location.pathname + location.search)
    };
    try { sessionStorage.setItem(PICK_KEY, JSON.stringify(payload)); } catch (e) {}
    location.href = url;
  }

  function peekPick() {
    try {
      var v = JSON.parse(sessionStorage.getItem(PICK_KEY) || "null");
      return v && typeof v === "object" ? v : null;
    } catch (e) { return null; }
  }

  function takePicked() {
    var v = peekPick();
    try { sessionStorage.removeItem(PICK_KEY); } catch (e) {}
    return v;
  }

  window.ZoneRelations = {
    enc: enc,
    dec: dec,
    parse: parse,
    encode: encode,
    titlesFor: titlesFor,
    fetchEntry: fetchEntry,
    listFor: listFor,
    removeFrom: removeFrom,
    targets: targets,
    openPicker: openPicker,
    peekPick: peekPick,
    takePicked: takePicked
  };
})();

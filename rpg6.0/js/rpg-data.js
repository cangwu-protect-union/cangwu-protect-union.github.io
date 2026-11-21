/* 回合制正传 6.0 · 角色档案的数据访问层
   数据库是唯一数据源；云端不可用时退回 data/seeds/characters.js 的内置副本。
   rpg-data-write.js 与 rpg-data-battles.js 先挂到 window.RpgData，
   本文件再补核心函数并组装对外对象；页面只 import 本文件。 */
import "./rpg-data-write.js";
import "./rpg-data-battles.js";

(function () {
  "use strict";
  var P = window.RpgData = window.RpgData || {};

  P.TIMEOUT_MS = 6000;
  P.BREAK_MS = 5 * 60 * 1000;
  P.downUntil = 0;

  P.PAGE_SIZE = 12;
  /* 相邻角色一次取 100 位（rpg_search 的上限），最多 50 页 */
  P.SIBLING_PAGE_SIZE = 100;
  P.SIBLING_MAX_PAGES = 50;

  /* 成员名单的唯一定义在 js/members.js；页面没加载它时退回这份副本 */
  P.MEMBERS = (window.CPU_MEMBERS && window.CPU_MEMBERS.length)
    ? window.CPU_MEMBERS.slice()
    : ["Forever", "苏橘AA", "全能天鬼", "漪珩BV1fy4y1L7Rq"];
  P.MARKS = ["√", "O", "X"];
  P.STAT_KEYS = ["atk", "def", "mres", "hp", "mp", "spd"];
  P.STAT_LABELS = {
    atk: "攻击", def: "防御", mres: "法抗",
    hp: "血量", mp: "蓝上限", spd: "速度"
  };
  P.RATING_SUGGESTIONS = ["E", "D", "C", "B", "A", "S", "SS", "SSS", "SB"];

  P.STATUS_TEXT = {
    pending: "待审",
    approved: "已通过",
    rejected: "已驳回"
  };

  P.isDown = function () { return Date.now() < P.downUntil; }
  P.markDown = function () { P.downUntil = Date.now() + P.BREAK_MS; }

  P.cfg = function () {
    var base = window.GUI_CLOUDBASE || {};
    var app = window.RPG_APP || {};
    if (!base.envId || !base.publishableKey) return null;
    var tables = app.tables || {};
    return {
      rest: "https://" + String(base.envId).trim() + ".api.tcloudbasegateway.com/v1/rdb/rest/",
      key: String(base.publishableKey).trim(),
      characters: tables.characters || "rpg_characters",
      versions: tables.versions || "rpg_character_versions",
      submissions: tables.submissions || "rpg_submissions",
      battles: tables.battles || "rpg_battles"
    };
  }

  P.accessToken = function () {
    if (window.GuiGate && typeof window.GuiGate.token === "function") {
      return window.GuiGate.token();
    }
    return "";
  }

  P.headers = function (c, extra) {
    var h = {
      "Authorization": "Bearer " + c.key,
      "Content-Type": "application/json"
    };
    if (extra) for (var k in extra) h[k] = extra[k];

    var tok = P.accessToken();
    if (tok) {
      h["Prefer"] = (h["Prefer"] ? h["Prefer"] + ", " : "") + "gui-token=" + tok;
    }
    return h;
  }

  P.isAuthError = function (err) {
    var msg = String((err && (err.body || err.message)) || "");
    return /42501|row-level security|JWT|permission denied/i.test(msg);
  }

  P.withTimeout = function (promise, ms) {
    return Promise.race([
      promise,
      new Promise(function (_, reject) {
        setTimeout(function () { reject(new Error("请求超时")); }, ms);
      })
    ]);
  }

  P.retryOnceOnTimeout = function (fn) {
    return fn().catch(function (err) {
      if (!/超时/.test(String(err && err.message))) throw err;
      return fn();
    });
  }

  P.nowIso = function () { return new Date().toISOString(); }

  P.newId = function (prefix) {
    return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  P.trim = function (v) { return String(v == null ? "" : v).trim(); }

  /* 写一条编辑日志给统计页；页面没加载 js/edit-log.js 时静默跳过 */
  P.logEdit = function (ev) {
    if (window.EditLog && typeof window.EditLog.log === "function") {
      return window.EditLog.log(ev);
    }
    return Promise.resolve(false);
  }

  /* ---------------- 请求 ---------------- */

  P.readJson = function (res) {
    if (res.ok) return res.json();
    return res.text().then(function (txt) {
      var err = new Error("云端返回 " + res.status + " " + txt.slice(0, 160));
      err.status = res.status;
      err.body = txt;
      throw err;
    });
  }

  P.get = function (c, path) {
    return P.withTimeout(fetch(c.rest + path, { headers: P.headers(c) }), P.TIMEOUT_MS)
      .then(P.readJson);
  }

  /* 写：缺列时自动去掉该列重试，保证「先发代码、后跑 SQL」不会整页失败 */
  P.send = function (c, url, method, payload) {
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
          if (P.isAuthError(err)) {
            if (window.GuiGate && window.GuiGate.clearVerified) window.GuiGate.clearVerified();
            err.message = "验证已失效，请重新验证后再试。";
          }
          throw err;
        });
      });
    }

    return attempt(3).then(function (res) {
      if (res.ok) return null;
      return res.text().then(function (txt) {
        throw new Error("保存失败 HTTP " + res.status + " " + txt.slice(0, 160));
      });
    });
  }

  /* ---------------- 行 → 对象 ---------------- */

  P.asArray = function (v) { return Array.isArray(v) ? v.slice() : []; }

  P.mapCharacter = function (r) {
    if (!r) return null;
    return {
      id: r.id,
      seq: r.seq,
      name: r.name || "",
      aliases: P.asArray(r.aliases),
      occupation: r.occupation || "",
      side_job: r.side_job || "",
      rating: r.rating || "",
      gender: r.gender || "",
      review_mark: r.review_mark || "",
      atk: r.atk || "",
      def: r.def || "",
      mres: r.mres || "",
      hp: r.hp || "",
      mp: r.mp || "",
      spd: r.spd || "",
      skills: P.asArray(r.skills),
      raw_head: r.raw_head || "",
      raw_skills: r.raw_skills || "",
      images: P.asArray(r.images),
      reviewer: r.reviewer || "",
      reviewed_at: r.reviewed_at || null,
      review_note: r.review_note || "",
      editor: r.editor || "",
      edited_at: r.edited_at || null,
      deleter: r.deleter || "",
      deleted_at: r.deleted_at || null,
      source_submission_id: r.source_submission_id || "",
      deleted: !!r.deleted,
      created_at: r.created_at,
      updated_at: r.updated_at
    };
  }

  P.mapVersion = function (r) {
    var v = P.mapCharacter(r);
    if (!v) return null;
    v.version_id = r.version_id;
    v.character_id = r.character_id;
    v.reason = r.reason || "edit";
    v.applied = !!r.applied;
    v.archived_at = r.archived_at;
    return v;
  }

  P.mapSubmission = function (r) {
    if (!r) return null;
    var s = P.mapCharacter(r);
    s.author = r.author || "";
    s.note = r.note || "";
    s.status = r.status || "pending";
    s.created_at = r.created_at;
    s.approved_character_id = r.approved_character_id || "";
    return s;
  }

  /* ---------------- 写 payload ---------------- */

  P.toRow = function (obj) {
    return {
      name: P.trim(obj.name),
      aliases: P.asArray(obj.aliases),
      occupation: P.trim(obj.occupation),
      side_job: P.trim(obj.side_job),
      rating: P.trim(obj.rating),
      gender: P.trim(obj.gender),
      review_mark: P.trim(obj.review_mark),
      atk: P.trim(obj.atk),
      def: P.trim(obj.def),
      mres: P.trim(obj.mres),
      hp: P.trim(obj.hp),
      mp: P.trim(obj.mp),
      spd: P.trim(obj.spd),
      skills: P.asArray(obj.skills).map(function (s) {
        return {
          name: P.trim(s.name),
          condition: P.trim(s.condition),
          effect: P.trim(s.effect),
          note: P.trim(s.note)
        };
      }),
      images: P.asArray(obj.images),
      raw_head: P.trim(obj.raw_head),
      raw_skills: String(obj.raw_skills == null ? "" : obj.raw_skills)
    };
  }

  /* ---------------- 兜底：内置 33 条 ---------------- */

  P.seedAll = function () {
    var list = window.RPG_SEED_CHARACTERS || [];
    return list.map(P.mapCharacter).filter(function (x) { return x && !x.deleted; });
  }

  P.sortList = function (list, order) {
    var copy = list.slice();
    copy.sort(function (a, b) {
      var ta = String(a.created_at || "");
      var tb = String(b.created_at || "");
      if (ta !== tb) return order === "desc" ? (ta < tb ? 1 : -1) : (ta < tb ? -1 : 1);
      return String(a.id) < String(b.id) ? -1 : 1;
    });
    return copy;
  }

  P.matches = function (item, q, rating, occ) {
    if (rating && item.rating !== rating) return false;
    if (occ && item.occupation !== occ && item.side_job !== occ) return false;
    if (!q) return true;
    var low = q.toLowerCase();
    var hay = [
      item.name,
      item.aliases.join(" "),
      item.occupation,
      item.side_job,
      JSON.stringify(item.skills || []),
      item.raw_skills || ""
    ].join("\n").toLowerCase();
    return hay.indexOf(low) !== -1;
  }

  P.searchSeed = function (opts) {
    var page = Math.max(1, parseInt(opts.page, 10) || 1);
    var size = Math.max(1, parseInt(opts.pageSize, 10) || P.PAGE_SIZE);
    var shown = P.seedAll().filter(function (x) {
      return P.matches(x, P.trim(opts.q), P.trim(opts.rating), P.trim(opts.occ));
    });
    shown = P.sortList(shown, opts.order === "desc" ? "desc" : "asc");
    return {
      items: shown.slice((page - 1) * size, page * size),
      total: shown.length
    };
  }

  P.seedFacets = function () {
    var ratings = {}, occs = {};
    P.seedAll().forEach(function (x) {
      if (x.rating) ratings[x.rating] = 1;
      if (x.occupation) occs[x.occupation] = 1;
      if (x.side_job) occs[x.side_job] = 1;
    });
    return {
      ratings: Object.keys(ratings).sort(),
      occupations: Object.keys(occs).sort()
    };
  }

  /* ---------------- 读：列表 ---------------- */

  P.search = function (opts) {
    opts = opts || {};
    var c = P.cfg();
    var payload = {
      p_q: P.trim(opts.q),
      p_rating: P.trim(opts.rating),
      p_occ: P.trim(opts.occ),
      p_order: opts.order === "desc" ? "desc" : "asc",
      p_limit: Math.max(1, parseInt(opts.pageSize, 10) || P.PAGE_SIZE),
      p_offset: Math.max(0, ((Math.max(1, parseInt(opts.page, 10) || 1)) - 1) *
        (Math.max(1, parseInt(opts.pageSize, 10) || P.PAGE_SIZE)))
    };

    if (!c || P.isDown()) {
      var local = P.searchSeed(opts);
      local.fallback = true;
      return Promise.resolve(local);
    }

    return P.retryOnceOnTimeout(function () {
      return P.withTimeout(
        fetch(c.rest + "rpc/rpg_search", {
          method: "POST",
          headers: P.headers(c),
          body: JSON.stringify(payload)
        }),
        P.TIMEOUT_MS
      ).then(P.readJson);
    }).then(function (data) {
      return {
        items: (data.items || []).map(P.mapCharacter),
        total: typeof data.total === "number" ? data.total : (data.items || []).length,
        fallback: false
      };
    }).catch(function (err) {
      P.markDown();
      console.warn("[角色档案] 云端检索失败，改用内置副本：", err.message);
      var local = P.searchSeed(opts);
      local.fallback = true;
      return local;
    });
  }

  P.facets = function () {
    var c = P.cfg();
    if (!c || P.isDown()) return Promise.resolve(P.seedFacets());

    return P.retryOnceOnTimeout(function () {
      return P.withTimeout(
        fetch(c.rest + "rpc/rpg_facets", {
          method: "POST",
          headers: P.headers(c),
          body: "{}"
        }),
        P.TIMEOUT_MS
      ).then(P.readJson);
    }).then(function (data) {
      return {
        ratings: P.asArray(data.ratings),
        occupations: P.asArray(data.occupations)
      };
    }).catch(function (err) {
      console.warn("[角色档案] 筛选选项读取失败：", err.message);
      return P.seedFacets();
    });
  }

  /* ---------------- 读：单条 ---------------- */

  P.getCharacter = function (id) {
    if (!id) return Promise.resolve(null);
    var c = P.cfg();

    function fallback() {
      var all = (window.RPG_SEED_CHARACTERS || []).map(P.mapCharacter);
      var hit = all.filter(function (x) { return x && x.id === id; })[0];
      return hit || null;
    }

    if (!c || P.isDown()) return Promise.resolve(fallback());

    return P.retryOnceOnTimeout(function () {
      return P.get(c, c.characters + "?select=*&id=eq." + encodeURIComponent(id) + "&limit=1");
    }).then(function (rows) {
      var row = (Array.isArray(rows) ? rows : [])[0];
      return row ? P.mapCharacter(row) : null;
    }).catch(function (err) {
      P.markDown();
      console.warn("[角色档案] 读取角色失败，改用内置副本：", err.message);
      return fallback();
    });
  }

  P.listAll = function () {
    var c = P.cfg();
    if (!c || P.isDown()) return Promise.resolve((window.RPG_SEED_CHARACTERS || []).map(P.mapCharacter));

    return P.retryOnceOnTimeout(function () {
      return P.get(c, c.characters + "?select=*&order=created_at.asc&limit=1000");
    }).then(function (rows) {
      return (Array.isArray(rows) ? rows : []).map(P.mapCharacter);
    }).catch(function (err) {
      P.markDown();
      console.warn("[角色档案] 读取全部角色失败：", err.message);
      return (window.RPG_SEED_CHARACTERS || []).map(P.mapCharacter);
    });
  }

  /* ---------------- 读：相邻角色 ---------------- */

  /* 按列表同样的筛选与排序把结果收齐，返回当前角色在其中的位置。
     当前角色不在结果集（筛选失效、已删除）时 index 为 -1。 */
  P.listSiblings = function (item, opts) {
    opts = opts || {};
    var empty = { ids: [], index: -1, total: 0 };

    if (!item || item.deleted) return Promise.resolve(empty);
    if (!P.matches(item, P.trim(opts.q), P.trim(opts.rating), P.trim(opts.occ))) {
      return Promise.resolve(empty);
    }

    var collected = [];
    var total = 0;

    function step(page) {
      return P.search({
        q: opts.q,
        rating: opts.rating,
        occ: opts.occ,
        order: opts.order,
        page: page,
        pageSize: P.SIBLING_PAGE_SIZE
      }).then(function (res) {
        var items = res.items || [];
        collected = collected.concat(items);
        total = typeof res.total === "number" ? res.total : collected.length;

        if (!items.length || collected.length >= total || page >= P.SIBLING_MAX_PAGES) {
          var ids = collected.map(function (x) { return x.id; });
          return { ids: ids, index: ids.indexOf(item.id), total: ids.length };
        }
        return step(page + 1);
      });
    }

    return step(1);
  }



  /* ---------------- 读：版本 ---------------- */




  /* ---------------- 读：投稿 ---------------- */



  /* ---------------- 写：投稿 ---------------- */



  /* 转正：先查是否已建过角色（幂等），再建角色，最后改投稿状态。
     角色建好但状态没改成功时，重试会命中第一步，只补状态。 */

  /* ---------------- 写：角色 ---------------- */






  /* ---------------- 工具 ---------------- */





  /* ---------------- 战报 ---------------- */





  /* 删掉 30 天前的战报；期限写死在数据库函数里，前端不传参数。
     失败不抛错：清理是顺手做的事，不该把列表挡住。 */

  window.RpgData = {
    PAGE_SIZE: P.PAGE_SIZE,
    MEMBERS: P.MEMBERS,
    MARKS: P.MARKS,
    STAT_KEYS: P.STAT_KEYS,
    STAT_LABELS: P.STAT_LABELS,
    RATING_SUGGESTIONS: P.RATING_SUGGESTIONS,
    STATUS_TEXT: P.STATUS_TEXT,

    search: P.search,
    facets: P.facets,
    getCharacter: P.getCharacter,
    listAll: P.listAll,
    listSiblings: P.listSiblings,
    listVersions: P.listVersions,
    listVersionsOf: P.listVersionsOf,
    getVersion: P.getVersion,
    listSubmissions: P.listSubmissions,
    getSubmission: P.getSubmission,
    nextSeq: P.nextSeq,
    findCharacterBySubmission: P.findCharacterBySubmission,

    listBattles: P.listBattles,
    getBattle: P.getBattle,
    createBattle: P.createBattle,
    purgeBattles: P.purgeBattles,

    addSubmission: P.addSubmission,
    rejectSubmission: P.rejectSubmission,
    approveSubmission: P.approveSubmission,
    updateCharacter: P.updateCharacter,
    softDelete: P.softDelete,
    restoreCharacter: P.restoreCharacter,
    archiveVersion: P.archiveVersion,
    markVersionApplied: P.markVersionApplied,

    newId: P.newId,
    nowIso: P.nowIso,
    trim: P.trim,
    emptyCharacter: P.emptyCharacter,
    validateCharacter: P.validateCharacter,
    parseAliases: P.parseAliases,
    parseStatLine: P.parseStatLine,
    remoteEnabled: function () { return P.cfg() !== null; },
    isCloudDown: function () { return P.isDown(); },
    toRow: P.toRow
  };
})();

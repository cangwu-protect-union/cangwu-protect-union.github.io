/* ============================================================
   rpg-data.js —— 回合制正传 6.0 角色档案的数据访问层
   ------------------------------------------------------------
   数据库是唯一数据源。云端不可用时，公开列表与详情退回
   data/characters.js 里的 33 条内置副本（只作兜底）。

   云端接口（CloudBase PostgreSQL / PostgREST）：
     POST /v1/rdb/rest/rpc/rpg_search     列表检索
     POST /v1/rdb/rest/rpc/rpg_facets     筛选选项
     GET  /v1/rdb/rest/rpg_characters     角色
     GET  /v1/rdb/rest/rpg_character_versions  旧档案
     GET  /v1/rdb/rest/rpg_submissions    投稿

   写操作必须带组织验证令牌：令牌放在 Prefer 头里，
   由数据库的 gui_token_ok() 读取。
   ============================================================ */
(function () {
  "use strict";

  var TIMEOUT_MS = 6000;
  var BREAK_MS = 5 * 60 * 1000;
  var downUntil = 0;

  var PAGE_SIZE = 12;

  var MEMBERS = ["Forever", "苏橘AA", "全能天鬼", "漪珩BV1fy4y1L7Rq"];
  var MARKS = ["√", "O", "X"];
  var STAT_KEYS = ["atk", "def", "mres", "hp", "mp", "spd"];
  var STAT_LABELS = {
    atk: "攻击", def: "防御", mres: "法抗",
    hp: "血量", mp: "蓝上限", spd: "速度"
  };
  var RATING_SUGGESTIONS = ["E", "D", "C", "B", "A", "S", "SS", "SSS", "SB"];

  var STATUS_TEXT = {
    pending: "待审",
    approved: "已通过",
    rejected: "已驳回"
  };

  function isDown() { return Date.now() < downUntil; }
  function markDown() { downUntil = Date.now() + BREAK_MS; }

  function cfg() {
    var base = window.GUI_CLOUDBASE || {};
    var app = window.RPG_APP || {};
    if (!base.envId || !base.publishableKey) return null;
    var tables = app.tables || {};
    return {
      rest: "https://" + String(base.envId).trim() + ".api.tcloudbasegateway.com/v1/rdb/rest/",
      key: String(base.publishableKey).trim(),
      characters: tables.characters || "rpg_characters",
      versions: tables.versions || "rpg_character_versions",
      submissions: tables.submissions || "rpg_submissions"
    };
  }

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

    var tok = accessToken();
    if (tok) {
      h["Prefer"] = (h["Prefer"] ? h["Prefer"] + ", " : "") + "gui-token=" + tok;
    }
    return h;
  }

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

  function retryOnceOnTimeout(fn) {
    return fn().catch(function (err) {
      if (!/超时/.test(String(err && err.message))) throw err;
      return fn();
    });
  }

  function nowIso() { return new Date().toISOString(); }

  function newId(prefix) {
    return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function trim(v) { return String(v == null ? "" : v).trim(); }

  /* ---------------- 请求 ---------------- */

  function readJson(res) {
    if (res.ok) return res.json();
    return res.text().then(function (txt) {
      var err = new Error("云端返回 " + res.status + " " + txt.slice(0, 160));
      err.status = res.status;
      err.body = txt;
      throw err;
    });
  }

  function get(c, path) {
    return withTimeout(fetch(c.rest + path, { headers: headers(c) }), TIMEOUT_MS)
      .then(readJson);
  }

  /* 写：缺列时自动去掉该列重试，保证「先发代码、后跑 SQL」不会整页失败 */
  function send(c, url, method, payload) {
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
          if (isAuthError(err)) {
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

  function asArray(v) { return Array.isArray(v) ? v.slice() : []; }

  function mapCharacter(r) {
    if (!r) return null;
    return {
      id: r.id,
      seq: r.seq,
      name: r.name || "",
      aliases: asArray(r.aliases),
      occupation: r.occupation || "",
      side_job: r.side_job || "",
      rating: r.rating || "",
      review_mark: r.review_mark || "",
      atk: r.atk || "",
      def: r.def || "",
      mres: r.mres || "",
      hp: r.hp || "",
      mp: r.mp || "",
      spd: r.spd || "",
      skills: asArray(r.skills),
      raw_head: r.raw_head || "",
      raw_skills: r.raw_skills || "",
      images: asArray(r.images),
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

  function mapVersion(r) {
    var v = mapCharacter(r);
    if (!v) return null;
    v.version_id = r.version_id;
    v.character_id = r.character_id;
    v.reason = r.reason || "edit";
    v.applied = !!r.applied;
    v.archived_at = r.archived_at;
    return v;
  }

  function mapSubmission(r) {
    if (!r) return null;
    var s = mapCharacter(r);
    s.author = r.author || "";
    s.note = r.note || "";
    s.status = r.status || "pending";
    s.created_at = r.created_at;
    s.approved_character_id = r.approved_character_id || "";
    return s;
  }

  /* ---------------- 写 payload ---------------- */

  function toRow(obj) {
    return {
      name: trim(obj.name),
      aliases: asArray(obj.aliases),
      occupation: trim(obj.occupation),
      side_job: trim(obj.side_job),
      rating: trim(obj.rating),
      review_mark: trim(obj.review_mark),
      atk: trim(obj.atk),
      def: trim(obj.def),
      mres: trim(obj.mres),
      hp: trim(obj.hp),
      mp: trim(obj.mp),
      spd: trim(obj.spd),
      skills: asArray(obj.skills).map(function (s) {
        return {
          name: trim(s.name),
          condition: trim(s.condition),
          effect: trim(s.effect),
          note: trim(s.note)
        };
      }),
      images: asArray(obj.images),
      raw_head: trim(obj.raw_head),
      raw_skills: String(obj.raw_skills == null ? "" : obj.raw_skills)
    };
  }

  /* ---------------- 兜底：内置 33 条 ---------------- */

  function seedAll() {
    var list = window.RPG_SEED_CHARACTERS || [];
    return list.map(mapCharacter).filter(function (x) { return x && !x.deleted; });
  }

  function sortList(list, order) {
    var copy = list.slice();
    copy.sort(function (a, b) {
      var ta = String(a.created_at || "");
      var tb = String(b.created_at || "");
      if (ta !== tb) return order === "desc" ? (ta < tb ? 1 : -1) : (ta < tb ? -1 : 1);
      return String(a.id) < String(b.id) ? -1 : 1;
    });
    return copy;
  }

  function matches(item, q, rating, occ) {
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

  function searchSeed(opts) {
    var page = Math.max(1, parseInt(opts.page, 10) || 1);
    var size = Math.max(1, parseInt(opts.pageSize, 10) || PAGE_SIZE);
    var shown = seedAll().filter(function (x) {
      return matches(x, trim(opts.q), trim(opts.rating), trim(opts.occ));
    });
    shown = sortList(shown, opts.order === "desc" ? "desc" : "asc");
    return {
      items: shown.slice((page - 1) * size, page * size),
      total: shown.length
    };
  }

  function seedFacets() {
    var ratings = {}, occs = {};
    seedAll().forEach(function (x) {
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

  function search(opts) {
    opts = opts || {};
    var c = cfg();
    var payload = {
      p_q: trim(opts.q),
      p_rating: trim(opts.rating),
      p_occ: trim(opts.occ),
      p_order: opts.order === "desc" ? "desc" : "asc",
      p_limit: Math.max(1, parseInt(opts.pageSize, 10) || PAGE_SIZE),
      p_offset: Math.max(0, ((Math.max(1, parseInt(opts.page, 10) || 1)) - 1) *
        (Math.max(1, parseInt(opts.pageSize, 10) || PAGE_SIZE)))
    };

    if (!c || isDown()) {
      var local = searchSeed(opts);
      local.fallback = true;
      return Promise.resolve(local);
    }

    return retryOnceOnTimeout(function () {
      return withTimeout(
        fetch(c.rest + "rpc/rpg_search", {
          method: "POST",
          headers: headers(c),
          body: JSON.stringify(payload)
        }),
        TIMEOUT_MS
      ).then(readJson);
    }).then(function (data) {
      return {
        items: (data.items || []).map(mapCharacter),
        total: typeof data.total === "number" ? data.total : (data.items || []).length,
        fallback: false
      };
    }).catch(function (err) {
      markDown();
      console.warn("[角色档案] 云端检索失败，改用内置副本：", err.message);
      var local = searchSeed(opts);
      local.fallback = true;
      return local;
    });
  }

  function facets() {
    var c = cfg();
    if (!c || isDown()) return Promise.resolve(seedFacets());

    return retryOnceOnTimeout(function () {
      return withTimeout(
        fetch(c.rest + "rpc/rpg_facets", {
          method: "POST",
          headers: headers(c),
          body: "{}"
        }),
        TIMEOUT_MS
      ).then(readJson);
    }).then(function (data) {
      return {
        ratings: asArray(data.ratings),
        occupations: asArray(data.occupations)
      };
    }).catch(function (err) {
      console.warn("[角色档案] 筛选选项读取失败：", err.message);
      return seedFacets();
    });
  }

  /* ---------------- 读：单条 ---------------- */

  function getCharacter(id) {
    if (!id) return Promise.resolve(null);
    var c = cfg();

    function fallback() {
      var all = (window.RPG_SEED_CHARACTERS || []).map(mapCharacter);
      var hit = all.filter(function (x) { return x && x.id === id; })[0];
      return hit || null;
    }

    if (!c || isDown()) return Promise.resolve(fallback());

    return retryOnceOnTimeout(function () {
      return get(c, c.characters + "?select=*&id=eq." + encodeURIComponent(id) + "&limit=1");
    }).then(function (rows) {
      var row = (Array.isArray(rows) ? rows : [])[0];
      return row ? mapCharacter(row) : null;
    }).catch(function (err) {
      markDown();
      console.warn("[角色档案] 读取角色失败，改用内置副本：", err.message);
      return fallback();
    });
  }

  function listAll() {
    var c = cfg();
    if (!c || isDown()) return Promise.resolve((window.RPG_SEED_CHARACTERS || []).map(mapCharacter));

    return retryOnceOnTimeout(function () {
      return get(c, c.characters + "?select=*&order=created_at.asc&limit=1000");
    }).then(function (rows) {
      return (Array.isArray(rows) ? rows : []).map(mapCharacter);
    }).catch(function (err) {
      markDown();
      console.warn("[角色档案] 读取全部角色失败：", err.message);
      return (window.RPG_SEED_CHARACTERS || []).map(mapCharacter);
    });
  }

  function findCharacterBySubmission(submissionId) {
    var c = cfg();
    if (!c || !submissionId) return Promise.resolve(null);
    return get(c, c.characters + "?select=*&source_submission_id=eq." +
      encodeURIComponent(submissionId) + "&limit=1")
      .then(function (rows) {
        var row = (Array.isArray(rows) ? rows : [])[0];
        return row ? mapCharacter(row) : null;
      })
      .catch(function () { return null; });
  }

  function nextSeq() {
    var c = cfg();
    var seedMax = (window.RPG_SEED_CHARACTERS || []).reduce(function (max, x) {
      return Math.max(max, parseInt(x.seq, 10) || 0);
    }, 0);

    if (!c || isDown()) return Promise.resolve(seedMax + 1);

    return get(c, c.characters + "?select=seq&order=seq.desc&limit=1")
      .then(function (rows) {
        var row = (Array.isArray(rows) ? rows : [])[0];
        var max = row ? parseInt(row.seq, 10) || 0 : 0;
        return Math.max(max, seedMax) + 1;
      })
      .catch(function () { return seedMax + 1; });
  }

  /* ---------------- 读：版本 ---------------- */

  function listVersions() {
    var c = cfg();
    if (!c || isDown()) return Promise.resolve([]);

    return retryOnceOnTimeout(function () {
      return get(c, c.versions + "?select=*&applied=eq.false&order=archived_at.desc&limit=2000");
    }).then(function (rows) {
      return (Array.isArray(rows) ? rows : []).map(mapVersion);
    }).catch(function (err) {
      markDown();
      console.warn("[角色档案] 读取旧档案失败：", err.message);
      return [];
    });
  }

  function listVersionsOf(characterId) {
    var c = cfg();
    if (!c || !characterId || isDown()) return Promise.resolve([]);

    return retryOnceOnTimeout(function () {
      return get(c, c.versions + "?select=*&character_id=eq." +
        encodeURIComponent(characterId) + "&order=archived_at.desc&limit=2000");
    }).then(function (rows) {
      return (Array.isArray(rows) ? rows : []).map(mapVersion);
    }).catch(function (err) {
      markDown();
      console.warn("[角色档案] 读取版本失败：", err.message);
      return [];
    });
  }

  function getVersion(versionId) {
    var c = cfg();
    if (!c || !versionId || isDown()) return Promise.resolve(null);

    return get(c, c.versions + "?select=*&version_id=eq." +
      encodeURIComponent(versionId) + "&limit=1")
      .then(function (rows) {
        var row = (Array.isArray(rows) ? rows : [])[0];
        return row ? mapVersion(row) : null;
      })
      .catch(function () { return null; });
  }

  /* ---------------- 读：投稿 ---------------- */

  function listSubmissions(statuses) {
    var c = cfg();
    if (!c || isDown()) return Promise.resolve([]);

    var url = c.submissions + "?select=*&order=created_at.desc&limit=1000";
    if (statuses && statuses.length) {
      url += "&status=in.(" + statuses.map(encodeURIComponent).join(",") + ")";
    }

    return retryOnceOnTimeout(function () {
      return get(c, url);
    }).then(function (rows) {
      return (Array.isArray(rows) ? rows : []).map(mapSubmission);
    }).catch(function (err) {
      markDown();
      console.warn("[角色档案] 读取投稿失败：", err.message);
      return [];
    });
  }

  function getSubmission(id) {
    var c = cfg();
    if (!c || !id || isDown()) return Promise.resolve(null);

    return get(c, c.submissions + "?select=*&id=eq." + encodeURIComponent(id) + "&limit=1")
      .then(function (rows) {
        var row = (Array.isArray(rows) ? rows : [])[0];
        return row ? mapSubmission(row) : null;
      })
      .catch(function (err) {
        markDown();
        throw err;
      });
  }

  /* ---------------- 写：投稿 ---------------- */

  function addSubmission(payload) {
    var c = cfg();
    if (!c) return Promise.reject(new Error("云服务未配置，暂时无法提交。"));

    var row = toRow(payload);
    row.id = newId("s");
    row.status = "pending";
    row.author = trim(payload.author);
    row.note = trim(payload.note);
    row.created_at = nowIso();

    return send(c, c.rest + c.submissions, "POST", row).then(function () {
      return { id: row.id };
    });
  }

  function rejectSubmission(id, reviewer, note) {
    var c = cfg();
    if (!c) return Promise.reject(new Error("云服务未配置"));
    if (!accessToken()) return Promise.reject(new Error("需要先通过组织验证"));

    var row = {
      status: "rejected",
      reviewer: reviewer,
      reviewed_at: nowIso(),
      review_note: trim(note)
    };
    return send(c, c.rest + c.submissions + "?id=eq." + encodeURIComponent(id), "PATCH", row);
  }

  /* 转正：先查是否已建过角色（幂等），再建角色，最后改投稿状态。
     角色建好但状态没改成功时，重试会命中第一步，只补状态。 */
  function approveSubmission(submissionId, payload, reviewer, mark, note) {
    var c = cfg();
    if (!c) return Promise.reject(new Error("云服务未配置"));
    if (!accessToken()) return Promise.reject(new Error("需要先通过组织验证"));

    var characterId = "";

    return getSubmission(submissionId).then(function (sub) {
      if (!sub) throw new Error("投稿不存在，或当前身份无权读取。");
      if (sub.status !== "pending") {
        throw new Error("这条投稿已处理（" + (STATUS_TEXT[sub.status] || sub.status) + "）。");
      }
      return findCharacterBySubmission(submissionId);
    }).then(function (existing) {
      if (existing) {
        characterId = existing.id;
        return null;
      }
      return nextSeq().then(function (seq) {
        var row = toRow(payload);
        row.id = newId("rp");
        row.seq = seq;
        row.reviewer = reviewer;
        row.review_mark = mark;
        row.reviewed_at = nowIso();
        row.review_note = trim(note);
        row.source_submission_id = submissionId;
        row.created_at = nowIso();
        row.updated_at = row.created_at;
        characterId = row.id;

        var patch = {
          status: "approved",
          reviewer: reviewer,
          reviewed_at: row.reviewed_at,
          review_note: trim(note),
          approved_character_id: row.id
        };

        return send(c, c.rest + c.characters, "POST", row).then(function () {
          return send(c, c.rest + c.submissions + "?id=eq." + encodeURIComponent(submissionId), "PATCH", patch)
            .then(function () { return { id: row.id, reused: false }; })
            .catch(function (err) {
              err.partial = true;
              err.characterId = row.id;
              throw err;
            });
        });
      });
    }).then(function (result) {
      if (result) return result;

      var patch = {
        status: "approved",
        reviewer: reviewer,
        reviewed_at: nowIso(),
        review_note: trim(note),
        approved_character_id: characterId
      };
      return send(c, c.rest + c.submissions + "?id=eq." + encodeURIComponent(submissionId), "PATCH", patch)
        .then(function () { return { id: characterId, reused: true }; });
    });
  }

  /* ---------------- 写：角色 ---------------- */

  function updateCharacter(id, payload, operator) {
    var c = cfg();
    if (!c) return Promise.reject(new Error("云服务未配置"));
    if (!accessToken()) return Promise.reject(new Error("需要先通过组织验证"));
    if (!operator) return Promise.reject(new Error("请选择保存人"));

    var row = toRow(payload);
    row.editor = operator;
    row.edited_at = nowIso();
    row.updated_at = row.edited_at;

    return send(c, c.rest + c.characters + "?id=eq." + encodeURIComponent(id), "PATCH", row);
  }

  function softDelete(id, operator) {
    var c = cfg();
    if (!c) return Promise.reject(new Error("云服务未配置"));
    if (!accessToken()) return Promise.reject(new Error("需要先通过组织验证"));

    var row = {
      deleted: true,
      deleter: operator || "",
      deleted_at: nowIso(),
      updated_at: nowIso()
    };
    return send(c, c.rest + c.characters + "?id=eq." + encodeURIComponent(id), "PATCH", row);
  }

  function restoreCharacter(id, content, operator) {
    var c = cfg();
    if (!c) return Promise.reject(new Error("云服务未配置"));
    if (!accessToken()) return Promise.reject(new Error("需要先通过组织验证"));

    var row = toRow(content);
    row.deleted = false;
    row.editor = operator || "";
    row.edited_at = nowIso();
    row.updated_at = row.edited_at;

    return send(c, c.rest + c.characters + "?id=eq." + encodeURIComponent(id), "PATCH", row);
  }

  function archiveVersion(character, reason) {
    var c = cfg();
    if (!c) return Promise.reject(new Error("云服务未配置"));

    var row = toRow(character);
    row.version_id = newId("v");
    row.character_id = character.id;
    row.reason = reason === "delete" ? "delete" : "edit";
    row.applied = false;
    row.archived_at = nowIso();

    return send(c, c.rest + c.versions, "POST", row).then(function () {
      return row.version_id;
    });
  }

  function markVersionApplied(versionId) {
    var c = cfg();
    if (!c) return Promise.reject(new Error("云服务未配置"));
    return send(c, c.rest + c.versions + "?version_id=eq." + encodeURIComponent(versionId),
      "PATCH", { applied: true });
  }

  /* ---------------- 工具 ---------------- */

  function parseAliases(text) {
    var seen = {};
    return trim(text).split(/[,，]/).map(function (s) { return s.trim(); })
      .filter(function (s) {
        if (!s || seen[s]) return false;
        seen[s] = 1;
        return true;
      })
      .slice(0, 8);
  }

  function parseStatLine(text) {
    var parts = String(text == null ? "" : text).split("/");
    var out = {};
    STAT_KEYS.forEach(function (k, i) {
      out[k] = trim(parts[i]);
    });
    return out;
  }

  function emptyCharacter() {
    var obj = {
      name: "", aliases: [], occupation: "", side_job: "", rating: "",
      review_mark: "", images: [], skills: [], author: "", note: ""
    };
    STAT_KEYS.forEach(function (k) { obj[k] = ""; });
    for (var i = 0; i < 3; i++) {
      obj.skills.push({ name: "", condition: "", effect: "", note: "" });
    }
    return obj;
  }

  function validateCharacter(obj, opts) {
    opts = opts || {};
    var problems = [];

    if (!trim(obj.name)) problems.push("角色名称不能为空");
    else if (trim(obj.name).length > 40) problems.push("角色名称超过 40 字");

    if (asArray(obj.aliases).length > 8) problems.push("别名最多 8 个");
    asArray(obj.aliases).forEach(function (a) {
      if (trim(a).length > 12) problems.push("别名「" + trim(a) + "」超过 12 字");
    });

    if (!trim(obj.occupation)) problems.push("主职业不能为空");
    else if (trim(obj.occupation).length > 20) problems.push("主职业超过 20 字");
    if (trim(obj.side_job).length > 20) problems.push("副业超过 20 字");
    if (trim(obj.rating).length > 8) problems.push("强度评级超过 8 字");

    STAT_KEYS.forEach(function (k) {
      if (trim(obj[k]).length > 40) problems.push(STAT_LABELS[k] + "超过 40 字");
    });

    var skills = asArray(obj.skills);
    var filled = skills.filter(function (s) {
      return trim(s.name) || trim(s.effect);
    });
    if (!filled.length) problems.push("至少要写一个技能");
    if (skills.length > 12) problems.push("技能最多 12 条");
    skills.forEach(function (s, i) {
      var n = i + 1;
      if (trim(s.name).length > 40) problems.push("技能 " + n + " 名称超过 40 字");
      if (trim(s.condition).length > 40) problems.push("技能 " + n + " 释放条件超过 40 字");
      if (trim(s.effect).length > 400) problems.push("技能 " + n + " 效果超过 400 字");
      if (trim(s.note).length > 200) problems.push("技能 " + n + " 备注超过 200 字");
    });

    if (asArray(obj.images).length > 9) problems.push("图片最多 9 张");
    if (trim(obj.author).length > 30) problems.push("署名超过 30 字");
    if (trim(obj.note).length > 500) problems.push("备注超过 500 字");
    if (trim(obj.review_note).length > 200) problems.push("审核备注超过 200 字");

    if (opts.requireReview) {
      if (!trim(obj.reviewer)) problems.push("请选择审核人");
      if (!trim(obj.review_mark)) problems.push("请选择审核评价");
    }
    if (opts.requireOperator && !trim(obj.operator)) {
      problems.push("请选择保存人");
    }

    return problems;
  }

  window.RpgData = {
    PAGE_SIZE: PAGE_SIZE,
    MEMBERS: MEMBERS,
    MARKS: MARKS,
    STAT_KEYS: STAT_KEYS,
    STAT_LABELS: STAT_LABELS,
    RATING_SUGGESTIONS: RATING_SUGGESTIONS,
    STATUS_TEXT: STATUS_TEXT,

    search: search,
    facets: facets,
    getCharacter: getCharacter,
    listAll: listAll,
    listVersions: listVersions,
    listVersionsOf: listVersionsOf,
    getVersion: getVersion,
    listSubmissions: listSubmissions,
    getSubmission: getSubmission,
    nextSeq: nextSeq,
    findCharacterBySubmission: findCharacterBySubmission,

    addSubmission: addSubmission,
    rejectSubmission: rejectSubmission,
    approveSubmission: approveSubmission,
    updateCharacter: updateCharacter,
    softDelete: softDelete,
    restoreCharacter: restoreCharacter,
    archiveVersion: archiveVersion,
    markVersionApplied: markVersionApplied,

    newId: newId,
    nowIso: nowIso,
    trim: trim,
    emptyCharacter: emptyCharacter,
    validateCharacter: validateCharacter,
    parseAliases: parseAliases,
    parseStatLine: parseStatLine,
    remoteEnabled: function () { return cfg() !== null; },
    isCloudDown: function () { return isDown(); },
    toRow: toRow
  };
})();

/* ============================================================
   suggest-data.js —— 站点建议的数据访问（主站专用）
   ------------------------------------------------------------
   表 site_suggestions 与图鉴、区域档案完全隔离：
     匿名只能插入；读取与删除要组织验证令牌。
   配置复用 guitu/data/config.js 的 window.GUI_CLOUDBASE，
   只取 envId 与 publishableKey，表名写死在这里，
   不跟 config 的 table 字段走（那是图鉴的表）。
   ============================================================ */
(function () {
  "use strict";

  var TABLE = "site_suggestions";
  var TIMEOUT_MS = 6000;
  var TITLE_MAX = 25;
  var BODY_MAX = 2000;

  var KIND_LABELS = {
    bug: "页面 bug",
    feature: "功能建议",
    content: "内容建议",
    other: "其他"
  };
  var KIND_ORDER = ["bug", "feature", "content", "other"];

  function cfg() {
    var c = window.GUI_CLOUDBASE || {};
    if (!c.envId || !c.publishableKey) return null;
    return {
      base: "https://" + String(c.envId).trim() + ".api.tcloudbasegateway.com/v1/rdb/rest/",
      key: String(c.publishableKey).trim()
    };
  }

  function accessToken() {
    if (window.GuiGate && typeof window.GuiGate.token === "function") {
      return window.GuiGate.token();
    }
    return "";
  }

  /* 令牌放在 Prefer 头里：网关的 CORS 允许头是固定白名单，
     自定义头会被预检拦掉，Prefer 在白名单里且会被转发给 PostgREST。 */
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

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise(function (_, reject) {
        setTimeout(function () { reject(new Error("请求超时")); }, ms);
      })
    ]);
  }

  function httpError(res, what) {
    return res.text().then(function (txt) {
      var err = new Error(what + " HTTP " + res.status + " " + txt.slice(0, 160));
      err.status = res.status;
      err.body = txt;
      throw err;
    });
  }

  function newId() {
    return "sg-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function mapRow(r) {
    return {
      id: r.id,
      kind: r.kind,
      title: r.title,
      body: r.body,
      created_at: r.created_at || ""
    };
  }

  /* 提交一条建议。不需要令牌：数据库策略只要求字段合法。 */
  function addSuggestion(suggestion) {
    var c = cfg();
    if (!c) return Promise.reject(new Error("云服务未配置"));

    var row = {
      id: suggestion.id || newId(),
      kind: suggestion.kind,
      title: suggestion.title,
      body: suggestion.body
    };

    return withTimeout(
      fetch(c.base + TABLE, {
        method: "POST",
        headers: headers(c, { "Prefer": "return=minimal" }),
        body: JSON.stringify(row)
      }),
      TIMEOUT_MS
    ).then(function (res) {
      if (!res.ok) return httpError(res, "提交失败");
      return row.id;
    });
  }

  /* 读取全部建议，按时间倒序。没有令牌时数据库返回空数组。 */
  function listSuggestions() {
    var c = cfg();
    if (!c) return Promise.reject(new Error("云服务未配置"));

    var url = c.base + TABLE + "?select=*&order=created_at.desc&limit=500";

    return withTimeout(fetch(url, { headers: headers(c) }), TIMEOUT_MS)
      .then(function (res) {
        if (!res.ok) return httpError(res, "读取建议失败");
        return res.json();
      })
      .then(function (rows) {
        return (Array.isArray(rows) ? rows : []).map(mapRow);
      });
  }

  /* 删除一条建议。DELETE 命中 RLS 时也返回 204，所以删完要读回来确认。 */
  function deleteSuggestion(id) {
    var c = cfg();
    if (!c) return Promise.reject(new Error("云服务未配置"));
    if (!accessToken()) return Promise.reject(new Error("需要先通过组织验证"));

    var url = c.base + TABLE + "?id=eq." + encodeURIComponent(id);

    return withTimeout(
      fetch(url, {
        method: "DELETE",
        headers: headers(c, { "Prefer": "return=minimal" })
      }),
      TIMEOUT_MS
    ).then(function (res) {
      if (!res.ok) return httpError(res, "删除失败");
      return withTimeout(
        fetch(url + "&select=id", { headers: headers(c) }),
        TIMEOUT_MS
      );
    }).then(function (res) {
      if (!res.ok) return httpError(res, "删除后校验失败");
      return res.json();
    }).then(function (rows) {
      if (Array.isArray(rows) && rows.length) {
        throw new Error("没有权限删除这条建议，或它已不存在。");
      }
      return true;
    });
  }

  window.SiteSuggest = {
    add: addSuggestion,
    list: listSuggestions,
    remove: deleteSuggestion,
    newId: newId,
    KIND_LABELS: KIND_LABELS,
    KIND_ORDER: KIND_ORDER,
    TITLE_MAX: TITLE_MAX,
    BODY_MAX: BODY_MAX
  };
})();

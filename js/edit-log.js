/* ============================================================
   edit-log.js —— 写一条编辑日志（site_edit_log）
   ------------------------------------------------------------
   每次写操作成功后调用一次，统计页的「贡献度」就从这张表聚合。
   日志写失败只打 warn，不打断保存：内容是主，计数是次。
   ============================================================ */
(function () {
  "use strict";

  var TABLE = "site_edit_log";
  var TIMEOUT_MS = 8000;

  function cfg() {
    var c = window.GUI_CLOUDBASE || {};
    if (!c.envId || !c.publishableKey) return null;
    return {
      base: "https://" + String(c.envId).trim() + ".api.tcloudbasegateway.com/v1/rdb/rest/",
      key: String(c.publishableKey).trim()
    };
  }

  function token() {
    if (window.GuiGate && typeof window.GuiGate.token === "function") {
      return window.GuiGate.token() || "";
    }
    return "";
  }

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise(function (_, reject) {
        setTimeout(function () { reject(new Error("请求超时")); }, ms);
      })
    ]);
  }

  /* ev: { module, targetType, targetId, targetTitle, action, member, note }
     返回 Promise<boolean>：true 表示日志确实写进了数据库 */
  function log(ev) {
    var c = cfg();
    if (!c) return Promise.resolve(false);
    if (!ev || !ev.member) return Promise.resolve(false);

    var row = {
      module: String(ev.module || "").slice(0, 20),
      target_type: String(ev.targetType || "").slice(0, 20),
      target_id: String(ev.targetId || "").slice(0, 200),
      target_title: String(ev.targetTitle || "").slice(0, 120),
      action: String(ev.action || "update").slice(0, 20),
      member: String(ev.member).slice(0, 40),
      note: String(ev.note || "").slice(0, 200)
    };

    var headers = {
      "Authorization": "Bearer " + c.key,
      "Content-Type": "application/json",
      "Prefer": "return=minimal"
    };
    var tok = token();
    if (tok) headers["Prefer"] += ", gui-token=" + tok;

    return withTimeout(
      fetch(c.base + TABLE, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(row)
      }),
      TIMEOUT_MS
    ).then(function (res) {
      if (!res.ok) {
        console.warn("[编辑日志] 写入失败 HTTP " + res.status);
        return false;
      }
      return true;
    }).catch(function (err) {
      console.warn("[编辑日志] 写入失败：" + err.message);
      return false;
    });
  }

  window.EditLog = { log: log, token: token };
})();

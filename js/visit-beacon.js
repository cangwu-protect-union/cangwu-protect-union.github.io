/* ============================================================
   visit-beacon.js —— 公开页访问打点
   ------------------------------------------------------------
   每次打开一个公开页，向 site_views 写一行：路径 + 匿名访客号。
   不存 IP、不存 UA、不存 Referer；访客号只是浏览器里的随机串，
   用来估算独立访客（UV），清缓存即变成新访客。

   只在部署域名上发：localhost / 127.0.0.1 / file:// 一律跳过，
   免得本地调试污染真实流量。
   ============================================================ */
(function () {
  "use strict";

  var VISITOR_KEY = "cpu_visitor";
  var TABLE = "site_views";
  var TIMEOUT_MS = 5000;

  function skip() {
    var proto = location.protocol;
    if (proto !== "https:" && proto !== "http:") return true;
    var host = location.hostname;
    return host === "" || host === "localhost" || host === "127.0.0.1" ||
      host === "::1" || host === "[::1]";
  }

  function cfg() {
    var c = window.GUI_CLOUDBASE || {};
    if (!c.envId || !c.publishableKey) return null;
    return {
      base: "https://" + String(c.envId).trim() + ".api.tcloudbasegateway.com/v1/rdb/rest/",
      key: String(c.publishableKey).trim()
    };
  }

  function visitorId() {
    var v = "";
    try { v = localStorage.getItem(VISITOR_KEY) || ""; } catch (e) { v = ""; }
    if (v) return v;
    v = "v-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
    try { localStorage.setItem(VISITOR_KEY, v); } catch (e) { /* 隐身模式：本次仍计数 */ }
    return v;
  }

  function send() {
    if (skip()) return;
    var c = cfg();
    if (!c) return;

    var body = JSON.stringify({
      path: String(location.pathname || "/").slice(0, 200),
      visitor: visitorId().slice(0, 64)
    });

    var timer = setTimeout(function () { /* 失败就不管 */ }, TIMEOUT_MS);

    fetch(c.base + TABLE, {
      method: "POST",
      keepalive: true,
      headers: {
        "Authorization": "Bearer " + c.key,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: body
    }).then(function () {
      clearTimeout(timer);
    }).catch(function () {
      clearTimeout(timer);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", send);
  } else {
    send();
  }
})();

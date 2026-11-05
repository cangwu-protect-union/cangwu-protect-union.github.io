/* ============================================================
   location-picker.js —— 表单与标点页之间的坐标传递
   ------------------------------------------------------------
   用的是 sessionStorage：同一个标签页内来回，关掉就失效。
   写进去的是「当前坐标 + 回跳地址」，标点页确认后原样写回并跳回。
   ============================================================ */
(function () {
  "use strict";

  var KEY = "quyu_pending_location";

  function readRaw() {
    try {
      var v = JSON.parse(sessionStorage.getItem(KEY) || "null");
      return v && typeof v === "object" ? v : null;
    } catch (e) {
      return null;
    }
  }

  /* 表单 → 标点页 */
  function open(lng, lat, returnTo) {
    var payload = {
      lng: typeof lng === "number" ? lng : null,
      lat: typeof lat === "number" ? lat : null,
      returnTo: returnTo || location.pathname + location.search
    };
    try { sessionStorage.setItem(KEY, JSON.stringify(payload)); } catch (e) {}
    location.href = "pick-location.html";
  }

  function peek() { return readRaw(); }

  /* 标点页 → 表单 */
  function finish(lng, lat) {
    var cur = readRaw() || {};
    var payload = { lng: lng, lat: lat, returnTo: cur.returnTo || "" };
    try { sessionStorage.setItem(KEY, JSON.stringify(payload)); } catch (e) {}
    location.href = payload.returnTo || "quyu.html";
  }

  /* 表单读回标点结果；读到就清掉，避免下次打开又带着旧值 */
  function take() {
    var v = readRaw();
    if (!v) return null;
    if (typeof v.lng !== "number" || typeof v.lat !== "number") return null;
    return { lng: v.lng, lat: v.lat };
  }

  function clear() {
    try { sessionStorage.removeItem(KEY); } catch (e) {}
  }

  window.ZonePicker = { open: open, peek: peek, finish: finish, take: take, clear: clear };
})();

/* ============================================================
   pick-location.js —— 标点页：在地图上点一下选位置
   ------------------------------------------------------------
   进入时读 sessionStorage 里表单留下的坐标作为初始视野；
   点地图落点，确认后写回坐标并跳回表单。
   高德底图是 GCJ-02，这里用 ZoneMap.fromMapLatLng 换回 WGS-84 再存。
   ============================================================ */
(function () {
  "use strict";

  var mapEl = document.getElementById("pickMap");
  var coordEl = document.getElementById("pickCoord");
  var hintEl = document.getElementById("pickHint");
  var okBtn = document.getElementById("okBtn");
  var cancelBtn = document.getElementById("cancelBtn");

  var pending = window.ZonePicker.peek() || {};
  var returnTo = pending.returnTo || "quyu.html";
  var current = { lng: null, lat: null };
  var marker = null;

  var mw = window.ZoneMap.create(mapEl, {
    center: typeof pending.lat === "number" ? [pending.lat, pending.lng] : undefined,
    zoom: typeof pending.lng === "number" ? 11 : 6,
    interactive: true
  });

  function paint() {
    var has = typeof current.lng === "number" && typeof current.lat === "number";
    coordEl.textContent = has
      ? current.lng.toFixed(5) + ", " + current.lat.toFixed(5)
      : "未标点";
    okBtn.disabled = !has;
    hintEl.textContent = has ? "点地图可以重新标点" : "在地图上点一下选择位置";
  }

  function place(lng, lat) {
    current.lng = lng;
    current.lat = lat;

    var ll = mw.toLatLng(lng, lat);
    if (!ll) return;

    if (!marker) {
      marker = L.circleMarker(ll, {
        radius: 9, color: "#ffffff", weight: 3,
        fillColor: "#0969da", fillOpacity: 1
      }).addTo(mw.map);
    } else {
      marker.setLatLng(ll);
    }
    paint();
  }

  mw.map.on("click", function (ev) {
    var w = mw.fromMapLatLng(ev.latlng);
    place(w.lng, w.lat);
  });

  okBtn.addEventListener("click", function () {
    if (typeof current.lng !== "number") return;
    window.ZonePicker.finish(current.lng, current.lat);
  });

  cancelBtn.addEventListener("click", function () {
    location.href = returnTo;
  });

  /* 已有坐标：先标出来，视野跟过去 */
  if (typeof pending.lng === "number" && typeof pending.lat === "number") {
    place(pending.lng, pending.lat);
    var ll0 = mw.toLatLng(pending.lng, pending.lat);
    if (ll0) mw.map.setView(ll0, 12);
  } else {
    paint();
  }
})();

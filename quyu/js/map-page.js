/* ============================================================
   map-page.js —— 地图页：左侧列表与地图标记双向联动
   ------------------------------------------------------------
   约定：
     - 左侧列表只列有坐标的区域，没有坐标的统一排在最后并标「未定位」
     - 点「定位」→ 地图飞到该点并打开气泡
     - 点标题 → 进区域详情
     - 点地图标记 → 左侧列表滚动到对应项并高亮
     - 不做标记聚合：规格里定的是 50 条以内
   ============================================================ */
(function () {
  "use strict";

  var canvas = document.getElementById("mapCanvas");
  var sideList = document.getElementById("mapSideList");
  var sideHead = document.getElementById("mapSideHead");
  var fallbackNote = document.getElementById("mapFallbackNote");

  var markers = [];         /* [{ zone, marker, latlng }] */
  var itemById = {};        /* id → li 元素 */

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function badges(z) {
    var out = "";
    if (z.level) out += '<span class="zone-badge zone-level" data-level="' + esc(z.level) + '">' + esc(z.level) + "</span>";
    if (z.status) out += '<span class="zone-badge zone-status" data-status="' + esc(z.status) + '">' + esc(z.status) + "</span>";
    return out;
  }

  function popupHtml(z) {
    return "" +
      '<div class="zone-popup">' +
        "<strong>" + esc(z.title) + "</strong>" +
        (z.region ? '<div class="zone-popup__meta">' + esc(z.region) + "</div>" : "") +
        '<div class="zone-popup__meta">' + badges(z) + "</div>" +
        '<a href="zone.html?id=' + encodeURIComponent(z.id) + '">查看档案 →</a>' +
      "</div>";
  }

  function itemHtml(z, hasCoord) {
    return "" +
      '<li class="map-item" data-id="' + esc(z.id) + '">' +
        '<a class="map-item__link" href="zone.html?id=' + encodeURIComponent(z.id) + '">' +
          '<span class="map-item__title">' + esc(z.title) + "</span>" +
          '<span class="map-item__meta">' +
            (hasCoord ? badges(z) : '<span class="map-item__none">未定位</span>') +
            (z.region ? "<span>" + esc(z.region) + "</span>" : "") +
          "</span>" +
        "</a>" +
        (hasCoord ? '<button type="button" class="map-item__locate" data-locate="' + esc(z.id) + '">定位</button>' : "") +
      "</li>";
  }

  function highlight(id) {
    Object.keys(itemById).forEach(function (k) {
      itemById[k].classList.toggle("is-on", k === id);
    });
    var el = itemById[id];
    if (!el) return;
    if (el.scrollIntoView) el.scrollIntoView({ block: "nearest", behavior: "smooth" });

    /* 窄屏下侧栏是横向条，scrollIntoView 不一定把项带进视野，再横向补一次 */
    var strip = sideList;
    if (strip && strip.scrollWidth > strip.clientWidth) {
      strip.scrollLeft = el.offsetLeft - strip.clientWidth / 2 + el.clientWidth / 2;
    }
  }

  window.ZoneData.list().then(function (zones) {
    var located = zones.filter(function (z) {
      return typeof z.lng === "number" && typeof z.lat === "number";
    });
    var others = zones.filter(function (z) {
      return !(typeof z.lng === "number" && typeof z.lat === "number");
    });

    sideList.innerHTML = located.map(function (z) { return itemHtml(z, true); }).join("") +
      others.map(function (z) { return itemHtml(z, false); }).join("");

    sideHead.textContent = zones.length
      ? "共 " + zones.length + " 个区域，其中 " + located.length + " 个已定位"
      : "暂无区域";

    var nodes = sideList.querySelectorAll(".map-item");
    for (var i = 0; i < nodes.length; i++) {
      itemById[nodes[i].getAttribute("data-id")] = nodes[i];
    }

    /* 建图 */
    var mw = window.ZoneMap.create(canvas, {
      onTilesFailed: function () {
        if (fallbackNote) fallbackNote.hidden = false;
      }
    });
    var map = mw.map;

    located.forEach(function (z) {
      var made = mw.addZone(z);
      if (!made) return;

      made.marker.bindPopup(popupHtml(z), { closeButton: true, maxWidth: 260 });
      made.marker.on("click", function () { highlight(z.id); });
      markers.push({ zone: z, marker: made.marker, latlng: made.latlng });
    });

    /* 初始视野：覆盖全部已定位的点 */
    if (markers.length === 1) {
      map.setView(markers[0].latlng, 11);
    } else if (markers.length > 1) {
      var group = L.featureGroup(markers.map(function (m) { return m.marker; }));
      map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 11 });
    }

    /* 「定位」按钮 → 地图 */
    sideList.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-locate]");
      if (!btn) return;
      ev.preventDefault();

      var id = btn.getAttribute("data-locate");
      var hit = null;
      for (var j = 0; j < markers.length; j++) {
        if (markers[j].zone.id === id) { hit = markers[j]; break; }
      }
      if (!hit) return;

      highlight(id);
      map.setView(hit.latlng, Math.max(map.getZoom(), 11), { animate: true });
      hit.marker.openPopup();
    });
  }).catch(function () {
    sideHead.textContent = "载入失败，请刷新重试。";
  });
})();

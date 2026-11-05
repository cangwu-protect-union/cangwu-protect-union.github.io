/* ============================================================
   map-page.js —— 地图页：左侧列表与地图标记双向联动
   ------------------------------------------------------------
   - 左侧列表只列有坐标的区域，没坐标的排在最后并标「未定位」
   - 点「定位」→ 地图飞到该点并打开气泡
   - 点标题 → 进区域详情
   - 点地图标记 → 左侧列表滚动到对应项并高亮
   - 支持 ?id=<区域> 进入时直接定位到那个点（详情页的缩略图点过来）
   ============================================================ */
(function () {
  "use strict";

  var canvas = document.getElementById("mapCanvas");
  var sideList = document.getElementById("mapSideList");
  var sideHead = document.getElementById("mapSideHead");
  var fallbackNote = document.getElementById("mapFallbackNote");

  var markers = [];
  var itemById = {};
  var focusId = new URLSearchParams(location.search).get("id");

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function popupHtml(z) {
    return "" +
      '<div class="zone-popup">' +
        "<strong>" + esc(z.title) + "</strong>" +
        (z.date ? '<div class="zone-popup__meta">' + esc(z.date) + "</div>" : "") +
        '<a href="zone.html?id=' + encodeURIComponent(z.id) + '">查看档案 →</a>' +
      "</div>";
  }

  function itemHtml(z, hasCoord) {
    return "" +
      '<li class="map-item" data-id="' + esc(z.id) + '">' +
        '<a class="map-item__link" href="zone.html?id=' + encodeURIComponent(z.id) + '">' +
          '<span class="map-item__title">' + esc(z.title) + "</span>" +
          (hasCoord ? "" : '<span class="map-item__meta"><span class="map-item__none">未定位</span></span>') +
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

    var strip = sideList;
    if (strip && strip.scrollWidth > strip.clientWidth) {
      strip.scrollLeft = el.offsetLeft - strip.clientWidth / 2 + el.clientWidth / 2;
    }
  }

  function hasCoord(z) {
    return typeof z.lng === "number" && typeof z.lat === "number";
  }

  window.ZoneData.list().then(function (zones) {
    var located = zones.filter(hasCoord);
    var others = zones.filter(function (z) { return !hasCoord(z); });

    sideList.innerHTML = located.map(function (z) { return itemHtml(z, true); }).join("") +
      others.map(function (z) { return itemHtml(z, false); }).join("");

    sideHead.textContent = zones.length
      ? "共 " + zones.length + " 个区域，其中 " + located.length + " 个已定位"
      : "暂无区域";

    var nodes = sideList.querySelectorAll(".map-item");
    for (var i = 0; i < nodes.length; i++) {
      itemById[nodes[i].getAttribute("data-id")] = nodes[i];
    }

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

    if (markers.length === 1) {
      map.setView(markers[0].latlng, 11);
    } else if (markers.length > 1) {
      var group = L.featureGroup(markers.map(function (m) { return m.marker; }));
      map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 11 });
    }

    /* 从详情页点缩略图过来：直接定位那个区域 */
    if (focusId) {
      var hit = markers.filter(function (m) { return m.zone.id === focusId; })[0];
      if (hit) {
        highlight(focusId);
        map.setView(hit.latlng, 12, { animate: false });
        hit.marker.openPopup();
      }
    }

    sideList.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-locate]");
      if (!btn) return;
      ev.preventDefault();

      var id = btn.getAttribute("data-locate");
      var found = null;
      for (var j = 0; j < markers.length; j++) {
        if (markers[j].zone.id === id) { found = markers[j]; break; }
      }
      if (!found) return;

      highlight(id);
      map.setView(found.latlng, Math.max(map.getZoom(), 11), { animate: true });
      found.marker.openPopup();
    });
  }).catch(function () {
    sideHead.textContent = "载入失败，请刷新重试。";
  });
})();

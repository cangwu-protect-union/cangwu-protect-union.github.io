/* ============================================================
   zone-map.js —— 地图基础设施（地图页、详情页缩略图、表单缩略图共用）
   ------------------------------------------------------------
   职责：
     1. 按 data/config.js 的 provider 建底图（天地图 / 高德过渡）
     2. 坐标换算：数据库统一存 WGS-84；高德瓦片是 GCJ-02，需要转换
     3. 瓦片连续失败时降级成纯色底，标记照常显示

   标记不再按等级上色（等级字段已删），统一用一个强调色。
   ============================================================ */
(function () {
  "use strict";

  var TILE_ERROR_LIMIT = 6;
  var MARKER_COLOR = "#0969da";

  /* ---------------- 坐标换算：WGS-84 → GCJ-02 ---------------- */

  var PI = Math.PI;
  var A = 6378245.0;
  var EE = 0.00669342162296594323;

  function outOfChina(lng, lat) {
    return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
  }

  function transformLat(x, y) {
    var ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0;
    ret += (160.0 * Math.sin(y / 12.0 * PI) + 320 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0;
    return ret;
  }

  function transformLng(x, y) {
    var ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0;
    ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0;
    return ret;
  }

  function wgs84ToGcj02(lng, lat) {
    if (outOfChina(lng, lat)) return [lng, lat];
    var dLat = transformLat(lng - 105.0, lat - 35.0);
    var dLng = transformLng(lng - 105.0, lat - 35.0);
    var radLat = lat / 180.0 * PI;
    var magic = Math.sin(radLat);
    magic = 1 - EE * magic * magic;
    var sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
    dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);
    return [lng + dLng, lat + dLat];
  }

  /* 反算：高德地图上点出来的坐标是 GCJ-02，要存成 WGS-84。
     没有解析解，用迭代逼近，十次内收敛到 1e-9 度（约 0.1 毫米）。 */
  function gcj02ToWgs84(lng, lat) {
    if (outOfChina(lng, lat)) return [lng, lat];
    var wgs = [lng, lat];
    for (var i = 0; i < 10; i++) {
      var g = wgs84ToGcj02(wgs[0], wgs[1]);
      var dLng = g[0] - lng;
      var dLat = g[1] - lat;
      if (Math.abs(dLng) < 1e-9 && Math.abs(dLat) < 1e-9) break;
      wgs = [wgs[0] - dLng, wgs[1] - dLat];
    }
    return wgs;
  }

  /* ---------------- 底图 ---------------- */

  function mapCfg() { return window.ZONE_MAP || {}; }

  function activeProvider() {
    var cfg = mapCfg();
    if (cfg.provider === "tianditu" && cfg.tiandituKey) return "tianditu";
    return "amap";
  }

  function buildTileLayers(map, onFail) {
    var cfg = mapCfg();
    var provider = activeProvider();
    var failed = 0;
    var layers = [];

    function watch(layer) {
      layer.on("tileerror", function () {
        failed++;
        if (failed >= TILE_ERROR_LIMIT && onFail) onFail();
      });
      layer.on("tileload", function () { failed = 0; });
      layers.push(layer);
      return layer;
    }

    if (provider === "tianditu") {
      var td = cfg.tianditu || {};
      var key = cfg.tiandituKey;
      var subs = td.subdomains || ["0", "1", "2", "3", "4", "5", "6", "7"];

      map.addLayer(watch(L.tileLayer(String(td.vec).replace("{key}", key), {
        subdomains: subs, maxZoom: 18, attribution: "© 天地图"
      })));
      map.addLayer(watch(L.tileLayer(String(td.cva).replace("{key}", key), {
        subdomains: subs, maxZoom: 18
      })));
    } else {
      var am = cfg.amap || {};
      map.addLayer(watch(L.tileLayer(am.url, {
        subdomains: am.subdomains || ["1", "2", "3", "4"],
        maxZoom: 18,
        attribution: "过渡底图 · © 高德"
      })));
    }

    /* 高德偶尔会漏掉个别瓦片（换一张也许就成功）。两秒半后检查一次，
       还有空白的就整层重绘一次，不要让它一直空着。 */
    var retried = false;
    setTimeout(function () {
      if (retried) return;
      var imgs = map.getContainer().querySelectorAll("img.leaflet-tile");
      for (var i = 0; i < imgs.length; i++) {
        if (imgs[i].complete && imgs[i].naturalWidth === 0) {
          retried = true;
          layers.forEach(function (l) { l.redraw(); });
          return;
        }
      }
    }, 2500);

    return provider;
  }

  function toLatLng(lng, lat, provider) {
    if (typeof lng !== "number" || typeof lat !== "number") return null;
    var p = provider === "amap" ? wgs84ToGcj02(lng, lat) : [lng, lat];
    return [p[1], p[0]];
  }

  /**
   * 建一张地图。
   * opts: { center: [纬度, 经度], zoom, interactive, onTilesFailed }
   * 返回: { map, provider, toLatLng, addZone(zone), setPosition(lng, lat) }
   */
  function create(el, opts) {
    opts = opts || {};
    var provider = activeProvider();
    var tilesFailed = false;

    var map = L.map(el, {
      center: opts.center || mapCfg().center || [30.9, 120.2],
      zoom: opts.zoom || mapCfg().zoom || 6,
      minZoom: 3,
      maxZoom: 18,
      zoomControl: opts.interactive !== false,
      dragging: opts.interactive !== false,
      scrollWheelZoom: opts.interactive === true,
      doubleClickZoom: opts.interactive !== false,
      attributionControl: true,
      tap: false
    });

    buildTileLayers(map, function () {
      tilesFailed = true;
      el.classList.add("map--no-tiles");
      if (opts.onTilesFailed) opts.onTilesFailed();
    });

    function resize() { try { map.invalidateSize(); } catch (_e) {} }
    requestAnimationFrame(resize);
    setTimeout(resize, 300);

    var selfMarker = null;

    function style() {
      return {
        radius: 8,
        color: "#ffffff",
        weight: 2,
        fillColor: MARKER_COLOR,
        fillOpacity: 0.95,
        opacity: 1
      };
    }

    function addZone(zone) {
      var ll = toLatLng(zone && zone.lng, zone && zone.lat, provider);
      if (!ll) return null;

      var marker = L.circleMarker(ll, style()).addTo(map);
      marker.on("mouseover", function () { marker.setStyle({ radius: 11 }); });
      marker.on("mouseout", function () { marker.setStyle({ radius: 8 }); });

      return { marker: marker, latlng: ll };
    }

    /* 表单缩略图用：坐标变了就挪标记，没有标记就建一个 */
    function setPosition(lng, lat) {
      var ll = toLatLng(lng, lat, provider);
      if (!ll) return;

      if (!selfMarker) {
        selfMarker = L.circleMarker(ll, style()).addTo(map);
      } else {
        selfMarker.setLatLng(ll);
      }
      map.setView(ll, map.getZoom(), { animate: false });
    }

    return {
      map: map,
      provider: provider,
      tilesFailed: function () { return tilesFailed; },
      toLatLng: function (lng, lat) { return toLatLng(lng, lat, provider); },
      /* 地图上点出来的 latlng → 要存进数据库的 WGS-84 经纬度 */
      fromMapLatLng: function (latlng) {
        if (provider !== "amap") return { lng: latlng.lng, lat: latlng.lat };
        var w = gcj02ToWgs84(latlng.lng, latlng.lat);
        return { lng: w[0], lat: w[1] };
      },
      addZone: addZone,
      setPosition: setPosition,
      markerColor: function () { return MARKER_COLOR; }
    };
  }

  window.ZoneMap = {
    create: create,
    wgs84ToGcj02: wgs84ToGcj02,
    gcj02ToWgs84: gcj02ToWgs84,
    activeProvider: activeProvider
  };
})();

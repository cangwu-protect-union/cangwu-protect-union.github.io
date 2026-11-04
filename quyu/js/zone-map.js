/* ============================================================
   zone-map.js —— 地图基础设施（地图页与详情页缩略图共用）
   ------------------------------------------------------------
   职责只有三件：
     1. 按 data/config.js 的 provider 建底图（天地图 / 高德过渡）
     2. 坐标换算：数据库统一存 WGS-84；高德瓦片是 GCJ-02，需要转换
     3. 瓦片连续失败时降级成纯色底，标记照常显示

   为什么坐标要换算：高德瓦片底图用的是 GCJ-02（火星坐标），
   直接把 WGS-84 的经纬度画上去，点位会偏 200~600 米。
   天地图是 CGCS2000，与 WGS-84 只差厘米级，不需要转换。
   ============================================================ */
(function () {
  "use strict";

  var TILE_ERROR_LIMIT = 6;    /* 连续这么多个瓦片失败就降级 */

  /* ---------------- 坐标换算：WGS-84 → GCJ-02 ---------------- */

  var PI = Math.PI;
  var A = 6378245.0;           /* 克拉索夫斯基椭球长半轴 */
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

  /* ---------------- 底图 ---------------- */

  function mapCfg() { return window.ZONE_MAP || {}; }

  /* 实际生效的服务商：天地图没填 key 就退回高德过渡底图 */
  function activeProvider() {
    var cfg = mapCfg();
    if (cfg.provider === "tianditu" && cfg.tiandituKey) return "tianditu";
    return "amap";
  }

  function buildTileLayers(map, onFail) {
    var cfg = mapCfg();
    var provider = activeProvider();
    var failed = 0;

    function watch(layer) {
      layer.on("tileerror", function () {
        failed++;
        if (failed >= TILE_ERROR_LIMIT && onFail) onFail();
      });
      layer.on("tileload", function () { failed = 0; });
      return layer;
    }

    if (provider === "tianditu") {
      var td = cfg.tianditu || {};
      var key = cfg.tiandituKey;
      var subs = td.subdomains || ["0", "1", "2", "3", "4", "5", "6", "7"];

      var vec = L.tileLayer(String(td.vec).replace("{key}", key), {
        subdomains: subs, maxZoom: 18,
        attribution: "© 天地图"
      });
      var cva = L.tileLayer(String(td.cva).replace("{key}", key), {
        subdomains: subs, maxZoom: 18
      });
      map.addLayer(watch(vec));
      map.addLayer(watch(cva));
    } else {
      var am = cfg.amap || {};
      map.addLayer(watch(L.tileLayer(am.url, {
        subdomains: am.subdomains || ["1", "2", "3", "4"],
        maxZoom: 18,
        attribution: "过渡底图 · © 高德"
      })));
    }

    return provider;
  }

  /* ---------------- 建图 ---------------- */

  /* C(lng, lat) → Leaflet 的 [lat, lng]，并处理高德底图的坐标偏移 */
  function toLatLng(lng, lat, provider) {
    if (typeof lng !== "number" || typeof lat !== "number") return null;
    var p = provider === "amap" ? wgs84ToGcj02(lng, lat) : [lng, lat];
    return [p[1], p[0]];
  }

  /**
   * 建一张地图。
   * el      容器元素
   * opts    { center: [纬度, 经度], zoom, interactive, onTilesFailed }
   * 返回    { map, provider, toLatLng(lng, lat), addZone(zone, opts) }
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

    /* 容器尺寸在脚本执行时可能还没定下来（详情页的地图是刚插进 DOM 的），
       量错尺寸会让瓦片只铺一角。两帧之后再量一次。 */
    function resize() { try { map.invalidateSize(); } catch (_e) {} }
    requestAnimationFrame(resize);
    setTimeout(resize, 300);

    function addZone(zone) {
      var ll = toLatLng(zone.lng, zone.lat, provider);
      if (!ll) return null;

      var color = levelColor(zone.level);
      var marker = L.circleMarker(ll, {
        radius: 8,
        color: "#ffffff",
        weight: 2,
        fillColor: color,
        fillOpacity: 0.95,
        opacity: 1
      }).addTo(map);

      /* 鼠标移上去放大一点，方便在小屏上点中 */
      marker.on("mouseover", function () { marker.setStyle({ radius: 11 }); });
      marker.on("mouseout", function () { marker.setStyle({ radius: 8 }); });

      if (zone.radius_m > 0) {
        L.circle(ll, {
          radius: Number(zone.radius_m),
          color: color,
          weight: 1,
          opacity: 0.5,
          fillColor: color,
          fillOpacity: 0.1,
          interactive: false
        }).addTo(map);
      }

      return { marker: marker, latlng: ll };
    }

    return {
      map: map,
      provider: provider,
      tilesFailed: function () { return tilesFailed; },
      toLatLng: function (lng, lat) { return toLatLng(lng, lat, provider); },
      addZone: addZone
    };
  }

  var LEVEL_COLORS = { A: "#b42318", B: "#9a6700", C: "#0969da", D: "#656d76" };

  function levelColor(level) {
    return LEVEL_COLORS[String(level || "").trim()] || "#656d76";
  }

  window.ZoneMap = {
    create: create,
    levelColor: levelColor,
    wgs84ToGcj02: wgs84ToGcj02,
    activeProvider: activeProvider
  };
})();

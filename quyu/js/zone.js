/* ============================================================
   zone.js —— 区域详情页：信息表 + 位置缩略图 + 正文 + 常见鬼
   ------------------------------------------------------------
   数据全部来自 ZoneData：
     getEntry(id)        区域本体
     getGhostBriefs()    常见鬼的标题（查 gui_entries，只取 id/title）
     getZoneBriefs()     关联区域
     getTipsForZone()    被采纳到这个区域的投稿
   ============================================================ */
(function () {
  "use strict";

  var root = document.getElementById("zoneRoot");

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function notFound() {
    document.title = "区域不存在 · 异常区域档案 · CPU";
    root.innerHTML =
      "<h1>区域不存在</h1>" +
      '<p class="lead">这个区域可能已被移除，或者链接里的编号不正确。</p>' +
      '<p><a class="btn" href="quyu.html">返回档案</a></p>';
  }

  function levelBadge(level) {
    if (!level) return "";
    return '<span class="zone-badge zone-level" data-level="' + esc(level) + '">' + esc(level) + " 级</span>";
  }

  function statusBadge(status) {
    if (!status) return "";
    return '<span class="zone-badge zone-status" data-status="' + esc(status) + '">' + esc(status) + "</span>";
  }

  /* 信息表的一行；值为空时整行不显示 */
  function row(label, value) {
    if (value === "" || value == null) return "";
    return "<tr><th>" + esc(label) + "</th><td>" + value + "</td></tr>";
  }

  function formatCoord(lng, lat) {
    if (typeof lng !== "number" || typeof lat !== "number") return "";
    return lng.toFixed(4) + ", " + lat.toFixed(4) + ' <span class="muted">（WGS-84）</span>';
  }

  function formatRadius(m) {
    if (typeof m !== "number" || m <= 0) return "";
    return m >= 1000 ? (m / 1000).toFixed(2) + " 公里" : m + " 米";
  }

  var id = new URLSearchParams(location.search).get("id");

  window.ZoneData.getEntry(id).then(function (zone) {
    if (!zone) { notFound(); return; }

    document.title = zone.title + " · 异常区域档案 · CPU";

    var paras = String(zone.body || "").split(/\n+/).filter(function (p) {
      return p.trim() !== "";
    }).map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("");

    var tags = (zone.tags || []).map(function (t) {
      return "<li>" + esc(t) + "</li>";
    }).join("");

    var imgs = window.zoneImagesFor(zone);
    var gallery = "";
    if (imgs.length === 1) {
      gallery = '<div class="entry-hero"><img src="' + esc(imgs[0]) + '" alt=""></div>';
    } else if (imgs.length > 1) {
      gallery = '<div class="entry-gallery">' +
        imgs.map(function (u, i) {
          return '<figure class="gallery-item"><img src="' + esc(u) + '" alt="" loading="' +
                 (i === 0 ? "eager" : "lazy") + '"></figure>';
        }).join("") +
        "</div>";
    }

    var hasCoord = typeof zone.lng === "number" && typeof zone.lat === "number";

    root.innerHTML =
      '<h1 class="entry-title">' + esc(zone.title) + "</h1>" +
      (zone.region ? '<p class="entry-date muted">' + esc(zone.region) + "</p>" : "") +
      '<table class="zone-info"><tbody>' +
        row("编号", esc(zone.id)) +
        row("地区", esc(zone.region)) +
        row("地形", esc(zone.terrain)) +
        row("等级", levelBadge(zone.level)) +
        row("状态", statusBadge(zone.status)) +
        row("坐标", formatCoord(zone.lng, zone.lat)) +
        row("范围半径", formatRadius(zone.radius_m)) +
        row("记录日期", esc(zone.date)) +
      "</tbody></table>" +
      (hasCoord ? '<div class="zone-mini-map" id="zoneMiniMap"><div class="zone-mini-map__canvas" id="zoneMiniCanvas"></div></div>' : "") +
      gallery +
      '<div class="entry-body">' + paras + "</div>" +
      '<section id="zoneGhosts"></section>' +
      '<section id="zoneRelated"></section>' +
      '<section id="zoneTips"></section>' +
      (tags ? '<ul class="tags entry-tags">' + tags + "</ul>" : "") +
      '<p class="entry-foot"><a class="btn btn-ghost" href="quyu.html">← 返回档案</a></p>';

    /* 位置缩略图：不可拖动，只做定位展示 */
    if (hasCoord && window.ZoneMap) {
      var mini = window.ZoneMap.create(document.getElementById("zoneMiniCanvas"), {
        center: [zone.lat, zone.lng],
        zoom: 12,
        interactive: false
      });
      mini.addZone(zone);
    }

    /* 常见鬼 */
    window.ZoneData.getGhostBriefs(zone.ghost_ids).then(function (list) {
      var host = document.getElementById("zoneGhosts");
      if (!host || !list.length) return;
      host.innerHTML =
        '<h2 class="entry-section-title">常见鬼</h2>' +
        '<ul class="zone-rel-list">' +
          list.map(function (g) {
            var label = g.title || g.id;
            return '<li><a href="../guitu/条目.html?id=' + encodeURIComponent(g.id) + '">' +
                     esc(label) + "</a>" +
                     (g.title ? "" : ' <span class="muted">（条目不存在）</span>') + "</li>";
          }).join("") +
        "</ul>";
    });

    /* 关联区域 */
    window.ZoneData.getZoneBriefs(zone.related_zone_ids).then(function (list) {
      var host = document.getElementById("zoneRelated");
      if (!host || !list.length) return;
      host.innerHTML =
        '<h2 class="entry-section-title">关联区域</h2>' +
        '<ul class="zone-rel-list">' +
          list.map(function (z) {
            return '<li><a href="zone.html?id=' + encodeURIComponent(z.id) + '">' + esc(z.title) + "</a>" +
                   (z.region ? ' <span class="muted">' + esc(z.region) + "</span>" : "") + "</li>";
          }).join("") +
        "</ul>";
    });

    /* 相关情报（被采纳到这个区域的投稿） */
    window.ZoneData.getTipsForZone(zone.id).then(function (list) {
      var host = document.getElementById("zoneTips");
      if (!host || !list.length) return;
      host.innerHTML =
        '<h2 class="entry-section-title">相关情报</h2>' +
        '<ul class="zone-rel-list">' +
          list.map(function (t) {
            return '<li><a href="tips-entry.html?id=' + encodeURIComponent(t.id) + '">' +
                     esc(t.title) + "</a></li>";
          }).join("") +
        "</ul>";
    });
  }).catch(function () { notFound(); });
})();

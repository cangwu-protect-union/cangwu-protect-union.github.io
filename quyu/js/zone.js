/* ============================================================
   zone.js —— 区域详情页
   ------------------------------------------------------------
   版式：标题 → 日期 → 位置缩略图（可点进地图）→ 正文 → 标签
         → 关联条目（鬼 / 区域两段）→ 引用情报（折叠）
   关联是双向的：别人引用了我，这里也看得到。
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
      '<p class="lead">这个区域可能已被移除，或者链接不正确。</p>' +
      '<p><a class="btn" href="quyu.html">返回档案</a></p>';
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
    var locHtml = hasCoord
      ? '<a class="zone-loc" href="map.html?id=' + encodeURIComponent(zone.id) + '" aria-label="在地图上查看">' +
          '<div class="zone-loc__map" id="zoneLocMap"></div>' +
          '<span class="zone-loc__text">' + zone.lng.toFixed(4) + ", " + zone.lat.toFixed(4) +
          ' <span class="muted">（WGS-84）· 点击在地图上查看</span></span>' +
        "</a>"
      : '<p class="zone-loc zone-loc--empty">未标点</p>';

    root.innerHTML =
      '<h1 class="entry-title">' + esc(zone.title) + "</h1>" +
      (zone.date ? '<p class="entry-date muted">记录日期：' + esc(zone.date) + "</p>" : "") +
      locHtml +
      gallery +
      '<div class="entry-body">' + paras + "</div>" +
      (tags ? '<ul class="tags entry-tags">' + tags + "</ul>" : "") +
      '<section id="zoneRelations"></section>' +
      '<section id="zoneRefs"></section>' +
      '<p class="entry-foot"><a class="btn btn-ghost" href="quyu.html">← 返回档案</a></p>';

    /* 位置缩略图 */
    if (hasCoord && window.ZoneMap) {
      window.ZoneMap.create(document.getElementById("zoneLocMap"), {
        center: [zone.lat, zone.lng],
        zoom: 11,
        interactive: false
      }).addZone(zone);
    }

    /* 引用情报 */
    if (window.RefsList && (zone.refs || []).length) {
      window.RefsList.mount(document.getElementById("zoneRefs"), {
        refs: zone.refs,
        editable: false,
        href: function (r) { return "tips-entry.html?id=" + encodeURIComponent(r.id); }
      });
    }

    /* 关联条目：按类型分两段 */
    renderRelations(zone.id);
  }).catch(function () { notFound(); });

  function renderRelations(zoneId) {
    var host = document.getElementById("zoneRelations");
    if (!host) return;

    window.ZoneRelations.listFor("zone", zoneId).then(function (items) {
      if (!items || !items.length) return;

      var ghosts = items.filter(function (x) { return x.type === "ghost"; });
      var zones = items.filter(function (x) { return x.type === "zone"; });

      function block(title, list, href) {
        if (!list.length) return "";
        return '<div class="rel-block">' +
          '<h2 class="entry-section-title">' + title + "（" + list.length + "）</h2>" +
          '<ul class="rel-list">' +
            list.map(function (it) {
              return '<li><a href="' + esc(href(it)) + '">' + esc(it.title) + "</a></li>";
            }).join("") +
          "</ul>" +
        "</div>";
      }

      host.innerHTML = block("关联的鬼", ghosts, function (it) {
        return "../guitu/条目.html?id=" + encodeURIComponent(it.id);
      }) + block("关联的区域", zones, function (it) {
        return "zone.html?id=" + encodeURIComponent(it.id);
      });
    });
  }
})();

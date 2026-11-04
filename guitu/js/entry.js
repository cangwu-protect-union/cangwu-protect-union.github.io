/* ============================================================
   entry.js —— 条目详情页逻辑：按 ?id=... 找到并渲染该条目
   ============================================================ */
(function () {
  "use strict";

  var root = document.getElementById("entryRoot");

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function notFound() {
    document.title = "条目不存在 · 鬼图鉴 · CPU";
    root.innerHTML =
      "<h1>条目不存在</h1>" +
      '<p class="lead">这个条目可能已被移除，或者链接里的编号不正确。</p>' +
      '<p><a class="btn" href="guitu.html">返回图鉴</a></p>';
  }

  var id = new URLSearchParams(location.search).get("id");

  window.GuiData.getEntry(id).then(function (entry) {
    if (!entry) { notFound(); return; }

    document.title = entry.title + " · 鬼图鉴 · CPU";

    var paras = String(entry.body || "").split(/\n+/).filter(function (p) {
      return p.trim() !== "";
    }).map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("");

    var tags = (entry.tags || []).map(function (t) {
      return "<li>" + esc(t) + "</li>";
    }).join("");

    /* 图片区：一张就正常显示，多张就排成画廊 */
    var imgs = window.guiImagesFor(entry);
    var gallery = "";
    if (imgs.length === 1) {
      gallery = '<div class="entry-hero"><img src="' + esc(imgs[0]) + '" alt=""></div>';
    } else if (imgs.length > 1) {
      gallery = '<div class="entry-gallery">' +
        imgs.map(function (u, i) {
          return '<figure class="gallery-item">' +
                   '<img src="' + esc(u) + '" alt="" loading="' + (i === 0 ? "eager" : "lazy") + '">' +
                 '</figure>';
        }).join("") +
      '</div>';
    }

    /* 引用情报：正文末尾列出跳转链接（引用时只拷贝了文段/图片/标签，标题不拷贝） */
    var refs = Array.isArray(entry.refs) ? entry.refs : [];
    var refsHtml = "";
    if (refs.length) {
      refsHtml =
        '<div class="entry-refs">' +
          '<p class="entry-refs-title">引用情报</p>' +
          '<ul>' +
            refs.map(function (r) {
              var rid = (r && r.id) ? r.id : "";
              var rtitle = (r && r.title) ? r.title : "（无标题）";
              return '<li><a href="tips-entry.html?id=' + encodeURIComponent(rid) + '">' +
                       esc(rtitle) + "</a></li>";
            }).join("") +
          "</ul>" +
        "</div>";
    }

    root.innerHTML =
      '<h1 class="entry-title">' + esc(entry.title) + "</h1>" +
      (entry.date ? '<p class="entry-date muted">记录日期：' + esc(entry.date) + "</p>" : "") +
      gallery +
      '<div class="entry-body">' + paras + "</div>" +
      refsHtml +
      (tags ? '<ul class="tags entry-tags">' + tags + "</ul>" : "") +
      '<p class="entry-foot"><a class="btn btn-ghost" href="guitu.html">← 返回图鉴</a></p>';

    /* 出没区域：反查异常区域档案里 ghost_ids 含本条目 id 的区域。
       用 ZoneData.getZonesByGhost（复用区域模块的查询），没有结果就不显示。 */
    if (window.ZoneData && typeof window.ZoneData.getZonesByGhost === "function") {
      window.ZoneData.getZonesByGhost(entry.id).then(function (zones) {
        var host = document.getElementById("entryZones");
        if (!host || !zones.length) return;

        host.innerHTML =
          '<div class="entry-refs">' +
            '<p class="entry-refs-title">出没区域</p>' +
            "<ul>" +
              zones.map(function (z) {
                var meta = [z.region, z.level ? z.level + " 级" : "", z.status]
                  .filter(Boolean).join(" · ");
                return '<li><a href="../quyu/zone.html?id=' + encodeURIComponent(z.id) + '">' +
                       esc(z.title) + "</a>" +
                       (meta ? ' <span class="muted">（' + esc(meta) + "）</span>" : "") + "</li>";
              }).join("") +
            "</ul>" +
          "</div>";

        /* 容器默认在正文外面，挪到「返回图鉴」按钮之前，读起来更顺 */
        var foot = root.querySelector(".entry-foot");
        if (foot && foot.parentNode) foot.parentNode.insertBefore(host, foot);
      }).catch(function () { /* 反查失败不影响正文 */ });
    }
  }).catch(function () { notFound(); });
})();
/* ============================================================
   entry.js —— 条目详情页逻辑：按 ?id=... 找到并渲染该条目
   ------------------------------------------------------------
   底部两块：关联条目（鬼 / 区域两段，含别人引用过来的）、引用情报（折叠）。
   两块都复用区域档案模块的组件，查询逻辑只有一份。
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
      '<p class="lead">这个条目可能已被移除，或者链接里的编号不正确。</p>';
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

    root.innerHTML =
      '<h1 class="entry-title">' + esc(entry.title) + "</h1>" +
      (entry.date ? '<p class="entry-date muted">记录日期：' + esc(entry.date) + "</p>" : "") +
      gallery +
      '<div class="entry-body">' + paras + "</div>" +
      (tags ? '<ul class="tags entry-tags">' + tags + "</ul>" : "");

    /* 关联条目 */
    var relHost = document.getElementById("entryRelations");
    if (relHost && window.ZoneRelations) {
      window.ZoneRelations.listFor("ghost", entry.id).then(function (items) {
        if (!items || !items.length) return;

        var ghosts = items.filter(function (x) { return x.type === "ghost"; });
        var zones = items.filter(function (x) { return x.type === "zone"; });

        function block(title, list, href) {
          if (!list.length) return "";
          return '<div class="rel-block">' +
            '<h2 class="entry-section-title">' + title + "（" + list.length + "）</h2>" +
            '<ul class="rel-list">' +
              list.map(function (it) {
                return '<li><a href="' + href(it) + '">' + esc(it.title) + "</a></li>";
              }).join("") +
            "</ul>" +
          "</div>";
        }

        relHost.innerHTML =
          block("关联的鬼", ghosts, function (it) {
            return "条目.html?id=" + encodeURIComponent(it.id);
          }) +
          block("关联的区域", zones, function (it) {
            return "../quyu/zone.html?id=" + encodeURIComponent(it.id);
          });
      }).catch(function () { /* 关联失败不影响正文 */ });
    }

    /* 引用情报 */
    var refsHost = document.getElementById("entryRefs");
    if (refsHost && window.RefsList && (entry.refs || []).length) {
      window.RefsList.mount(refsHost, {
        refs: entry.refs,
        editable: false,
        href: function (r) { return "tips-entry.html?id=" + encodeURIComponent(r.id); }
      });
    }
  }).catch(function () { notFound(); });
})();

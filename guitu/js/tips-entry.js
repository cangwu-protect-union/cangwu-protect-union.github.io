/* ============================================================
   tips-entry.js —— 单条情报的详情
   ------------------------------------------------------------
   只读。排版和图鉴详情页一致，方便对照阅读。
   返回按钮跟着 ?from= 走，回到用户来的那个列表页。
   ============================================================ */
(function () {
  "use strict";

  var rootEl = document.getElementById("tipRoot");
  var backLink = document.getElementById("backLink");

  var params = new URLSearchParams(location.search);
  var id = params.get("id");
  var from = params.get("from");

  /* 返回目标 */
  var backMap = {
    provide: { href: "provide-tip.html", text: "← 返回提供情报" },
    edit:    { href: "tips.html?from=edit", text: "← 返回查看情报" }
  };
  var back = backMap[from] || { href: "tips.html", text: "← 返回查看情报" };
  backLink.href = back.href;
  backLink.textContent = back.text;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function render(t) {
    var imgs = window.guiImagesFor(t);

    var gallery = "";
    if (imgs.length === 1) {
      gallery = '<div class="entry-hero"><img src="' + esc(imgs[0]) + '" alt=""></div>';
    } else if (imgs.length > 1) {
      gallery = '<div class="entry-gallery">' + imgs.map(function (u) {
        return '<figure class="gallery-item"><img src="' + esc(u) + '" alt="" loading="lazy"></figure>';
      }).join("") + "</div>";
    }

    var paras = String(t.body || "").split(/\n+/)
      .filter(function (p) { return p.trim() !== ""; })
      .map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("");

    var tags = (t.tags || []).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("");

    document.title = t.title + " · 情报 · CPU";
    rootEl.innerHTML =
      '<h1 class="entry-title">' + esc(t.title) + "</h1>" +
      '<p class="entry-date muted">投稿于 ' + esc(String(t.created_at || "").slice(0, 16).replace("T", " ")) + "</p>" +
      '<p class="tip-badge">情报 · 未经核实</p>' +
      gallery +
      '<div class="entry-body">' + paras + "</div>" +
      (tags ? '<ul class="tags entry-tags">' + tags + "</ul>" : "") +
      '<p class="entry-foot"><a class="btn btn-ghost" id="backFoot" href="' + back.href + '">' + back.text + "</a></p>";
  }

  window.GuiData.listTips().then(function (tips) {
    var t = tips.filter(function (x) { return x.id === id; })[0];
    if (!t) {
      rootEl.innerHTML = '<h1>情报不存在</h1><p class="lead">链接无效，或者这条情报已被清理。</p>' +
                         '<p><a class="btn" href="tips.html">返回查看情报</a></p>';
      return;
    }
    render(t);
  }).catch(function (err) {
    rootEl.innerHTML = '<h1>载入失败</h1><p class="lead">' + esc(err.message) + "</p>";
  });
})();
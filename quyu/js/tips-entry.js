/* ============================================================
   tips-entry.js —— 单条投稿详情
   ------------------------------------------------------------
   数据层没有单独的 getTip()：投稿量小（限 1000 条），
   直接从列表里挑出这一条，少一个接口也少一处出错。
   ============================================================ */
(function () {
  "use strict";

  var root = document.getElementById("tipRoot");

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function notFound(msg) {
    document.title = "情报不存在 · 异常区域档案 · CPU";
    root.innerHTML =
      "<h1>情报不存在</h1>" +
      '<p class="lead">' + esc(msg) + "</p>";
  }

  var id = new URLSearchParams(location.search).get("id");
  if (!id) { notFound("链接里没有带编号。"); return; }

  window.ZoneData.listTips().then(function (tips) {
    var tip = tips.filter(function (t) { return t.id === id; })[0];
    if (!tip) { notFound("这条投稿可能已被删除，或者编号不正确。"); return; }

    document.title = tip.title + " · 区域情报 · 异常区域档案 · CPU";

    var paras = String(tip.body || "").split(/\n+/).filter(function (p) {
      return p.trim() !== "";
    }).map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("");

    var imgs = (tip.images && tip.images.length) ? tip.images : (tip.image ? [tip.image] : []);
    var gallery = imgs.length === 1
      ? '<div class="entry-hero"><img src="' + esc(imgs[0]) + '" alt=""></div>'
      : imgs.length > 1
        ? '<div class="entry-gallery">' + imgs.map(function (u) {
            return '<figure class="gallery-item"><img src="' + esc(u) + '" alt="" loading="lazy"></figure>';
          }).join("") + "</div>"
        : "";

    var tags = (tip.tags || []).map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("");

    var status = tip.adopted
      ? '<p class="muted">已采纳' +
          (tip.adopted_zone_id
            ? '，收进正式档案：<a href="zone.html?id=' + encodeURIComponent(tip.adopted_zone_id) + '">查看区域</a>'
            : "") +
        "</p>"
      : '<p class="muted">待核实。编辑核实后会决定是否收进正式档案。</p>';

    root.innerHTML =
      '<h1 class="entry-title">' + esc(tip.title) + "</h1>" +
      '<table class="zone-info"><tbody>' +
        (tip.date ? "<tr><th>报告日期</th><td>" + esc(tip.date) + "</td></tr>" : "") +
        (typeof tip.lng === "number" && typeof tip.lat === "number"
          ? "<tr><th>坐标</th><td>" + tip.lng.toFixed(4) + ", " + tip.lat.toFixed(4) +
            ' <span class="muted">（WGS-84）</span></td></tr>'
          : "") +
      "</tbody></table>" +
      status +
      gallery +
      '<div class="entry-body">' + paras + "</div>" +
      (tags ? '<ul class="tags entry-tags">' + tags + "</ul>" : "");
  }).catch(function (err) {
    notFound("读取失败：" + (err.message || "请稍后重试"));
  });
})();

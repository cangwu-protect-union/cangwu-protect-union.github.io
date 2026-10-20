/* ============================================================
   version.js —— 只读查看某个历史版本
   ------------------------------------------------------------
   界面和公开的条目详情页一致，但没有编辑入口。
   如果这个条目还在图鉴中（未删除），顶部会出现「应用这个版本」：
     验证身份 → 把当前内容存进旧图鉴 → 用这个版本的内容替换展示
   如果条目已删除，这里不显示应用按钮（恢复按钮在版本列表页）。
   ============================================================ */
(function () {
  "use strict";

  var rootEl   = document.getElementById("verRoot");
  var backLink = document.getElementById("backLink");
  var banner   = document.getElementById("banner");
  var bannerText = document.getElementById("bannerText");
  var applyBtn = document.getElementById("applyBtn");

  var versionId = new URLSearchParams(location.search).get("v");
  var version = null;
  var entry = null;
  var busy = false;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function fmtTime(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
           " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  function render(v) {
    var imgs = (v.images && v.images.length) ? v.images : (v.image ? [v.image] : []);

    var gallery = "";
    if (imgs.length === 1) {
      gallery = '<div class="entry-hero"><img src="' + esc(imgs[0]) + '" alt=""></div>';
    } else if (imgs.length > 1) {
      gallery = '<div class="entry-gallery">' + imgs.map(function (u) {
        return '<figure class="gallery-item"><img src="' + esc(u) + '" alt="" loading="lazy"></figure>';
      }).join("") + "</div>";
    }

    var paras = String(v.body || "").split(/\n+/).filter(function (p) { return p.trim() !== ""; })
      .map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("");

    var tags = (v.tags || []).map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("");

    document.title = v.title + "（旧版本）· CPU";
    rootEl.innerHTML =
      '<h1 class="entry-title">' + esc(v.title) + "</h1>" +
      '<p class="entry-date muted">存档于 ' + esc(fmtTime(v.archived_at)) +
        (v.reason === "delete" ? "（删除前）" : "（修改前）") + "</p>" +
      gallery +
      '<div class="entry-body">' + paras + "</div>" +
      (tags ? '<ul class="tags entry-tags">' + tags + "</ul>" : "") +
      '<p class="entry-foot"><a class="btn btn-ghost" id="backFoot" href="old-gui.html">← 返回旧图鉴</a></p>';

    var foot = document.getElementById("backFoot");
    if (foot && v.entry_id) foot.href = "old-entry.html?id=" + encodeURIComponent(v.entry_id);
  }

  Promise.all([window.GuiData.listAll(), window.GuiData.listVersions()])
    .then(function (res) {
      var entries = res[0];
      var all = res[1];

      version = all.filter(function (v) { return v.version_id === versionId; })[0];

      if (!version) {
        rootEl.innerHTML = '<h1>版本不存在</h1><p class="lead">链接无效，或该版本已被清理。</p>' +
                           '<p><a class="btn" href="old-gui.html">返回旧图鉴</a></p>';
        return;
      }

      entry = entries.filter(function (e) { return e.id === version.entry_id; })[0];
      var alive = !!entry && !entry.deleted;

      backLink.href = "old-entry.html?id=" + encodeURIComponent(version.entry_id);
      backLink.textContent = "← 返回该条目的所有版本";

      render(version);

      /* 只有条目还在图鉴中才允许「应用」；已删除的请去版本列表页用「恢复」 */
      if (alive) {
        banner.hidden = false;
        bannerText.textContent = "这是「" + version.title + "」的一个历史版本。" +
          "点「应用」会把图鉴里的当前内容换成这个版本（当前内容会存进旧图鉴）。";
        bindApply();
      }
    })
    .catch(function (err) {
      rootEl.innerHTML = '<h1>载入失败</h1><p class="lead">' + esc(err.message) + "</p>";
    });

  /* ---------- 应用：验证 → 存档当前 → 用版本内容替换 ---------- */
  function bindApply() {
    applyBtn.addEventListener("click", function () {
      if (busy || !entry) return;

      if (!window.confirm("确定应用这个版本吗？\n\n图鉴里的当前内容会被替换，并存入「旧图鉴」。")) {
        return;
      }

      window.GuiGate.ask({
        message: "确认应用「" + version.title + "」的这个历史版本？请再次验证身份。"
      }).then(function (ok) {
        if (!ok) { location.href = "projects.html"; return; }

        busy = true;
        applyBtn.disabled = true;
        applyBtn.textContent = "应用中…";

        /* 先存档当前版本，再替换内容 */
        window.GuiData.archiveVersion(entry, "edit").then(function () {
          return window.GuiData.updateEntry({
            id: entry.id,
            title: version.title,
            image: (version.images && version.images[0]) || version.image || "",
            images: version.images || [],
            thumbs: version.thumbs || [],
            intro: version.intro || "",
            body: version.body || "",
            tags: version.tags || [],
            date: version.date || entry.date
          });
        }).then(function () {
          location.href = "edit-gui.html";
        }).catch(function (err) {
          busy = false;
          applyBtn.disabled = false;
          applyBtn.textContent = "应用这个版本";
          bannerText.textContent = "应用失败：" + err.message;
        });
      });
    });
  }
})();
/* ============================================================
   version.js —— 查看单个历史版本，并可应用回去
   ------------------------------------------------------------
   应用 = 把这份快照写回区域表（恢复不删行，只覆盖内容），
   然后把该版本标记为 applied，旧档案里不再重复出现。
   ============================================================ */
(function () {
  "use strict";

  var gateSection = document.getElementById("gateSection");
  var verSection = document.getElementById("verSection");
  var verTitle = document.getElementById("verTitle");
  var verSub = document.getElementById("verSub");
  var verBody = document.getElementById("verBody");
  var verError = document.getElementById("verError");
  var applyBtn = document.getElementById("applyBtn");
  var backZone = document.getElementById("backZone");

  var version = null;
  var versionId = new URLSearchParams(location.search).get("v");

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function showError(text) {
    verError.textContent = text || "";
    verError.hidden = !text;
  }

  function when(v) {
    var t = v.archived_at || "";
    return t ? String(t).replace("T", " ").slice(0, 16) : "";
  }

  function render() {
    verSection.hidden = false;
    verTitle.textContent = version.title || "（无标题）";
    verSub.textContent = "区域 " + version.zone_id + " · " +
      (version.reason === "delete" ? "删除前存档" : "编辑前存档") +
      (when(version) ? " · " + when(version) : "");

    backZone.href = "old-zone.html?id=" + encodeURIComponent(version.zone_id);

    var paras = String(version.body || "").split(/\n+/).filter(function (p) {
      return p.trim() !== "";
    }).map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("");

    var imgs = (version.images && version.images.length) ? version.images
             : (version.image ? [version.image] : []);
    var gallery = imgs.length === 1
      ? '<div class="entry-hero"><img src="' + esc(imgs[0]) + '" alt=""></div>'
      : imgs.length > 1
        ? '<div class="entry-gallery">' + imgs.map(function (u) {
            return '<figure class="gallery-item"><img src="' + esc(u) + '" alt="" loading="lazy"></figure>';
          }).join("") + "</div>"
        : "";

    var tags = (version.tags || []).map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("");

    var info =
      '<table class="zone-info"><tbody>' +
        (typeof version.lng === "number" && typeof version.lat === "number"
          ? "<tr><th>坐标</th><td>" + version.lng + ", " + version.lat + "</td></tr>" : "") +
        (version.date ? "<tr><th>记录日期</th><td>" + esc(version.date) + "</td></tr>" : "") +
      "</tbody></table>";

    verBody.innerHTML = info + gallery +
      '<div class="entry-body">' + paras + "</div>" +
      (tags ? '<ul class="tags entry-tags">' + tags + "</ul>" : "");

    if (version.applied) {
      applyBtn.disabled = true;
      applyBtn.textContent = "这个版本已经应用过";
    }
  }

  window.GuiGate.require(document.getElementById("gateMount"), {
    cancelHref: "old-zones.html",
    failHref: "edit-zones.html",
    onPass: function () {
      gateSection.hidden = true;

      if (!versionId) {
        verSection.hidden = false;
        verTitle.textContent = "缺少版本编号";
        verSub.textContent = "链接里没有带 ?v=。";
        applyBtn.disabled = true;
        return;
      }

      window.ZoneData.getVersion(versionId).then(function (v) {
        if (!v) {
          verSection.hidden = false;
          verTitle.textContent = "版本不存在";
          verSub.textContent = "可能已被清理，或者编号写错了。";
          applyBtn.disabled = true;
          return;
        }
        version = v;
        render();
      }).catch(function (err) {
        showError("读取失败：" + (err.message || "请稍后重试"));
      });
    }
  });

  applyBtn.addEventListener("click", function () {
    if (!version) return;
    if (!confirm("把「" + (version.title || version.zone_id) + "」的内容恢复成这个版本？\n\n当前内容会先归档一份。")) return;

    showError("");
    applyBtn.disabled = true;
    applyBtn.textContent = "正在应用…";

    window.ZoneData.getEntryAny(version.zone_id).then(function (now) {
      /* 先归档当前内容，再覆盖，否则这一步的改动就再也找不回来了 */
      return now ? window.ZoneData.archiveVersion(now, "edit") : null;
    }).then(function () {
      return window.ZoneData.updateEntry({ id: version.zone_id, title: version.title,
        lng: version.lng, lat: version.lat,
        image: version.image, images: version.images, thumbs: version.thumbs,
        related: version.related, refs: version.refs,
        intro: version.intro, body: version.body, tags: version.tags, date: version.date });
    }).then(function () {
      return window.ZoneData.markVersionApplied(version.version_id);
    }).then(function () {
      location.href = "zone.html?id=" + encodeURIComponent(version.zone_id);
    }).catch(function (err) {
      showError("应用失败：" + (err.message || "请稍后重试"));
      applyBtn.disabled = false;
      applyBtn.textContent = "应用这个版本";
    });
  });
})();

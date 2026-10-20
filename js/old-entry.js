/* ============================================================
   old-entry.js —— 一个旧条目的所有版本
   ------------------------------------------------------------
   顶部显示条目名和状态：
     · 条目还在  → 提示「仍在图鉴中」，不显示恢复按钮
     · 已删除    → 显示「恢复」按钮（验证身份后让最新版本重新上线）
   下面按时间倒序列出所有版本，点任一版本进只读查看界面。
   ============================================================ */
(function () {
  "use strict";

  var groupTitle = document.getElementById("groupTitle");
  var groupState = document.getElementById("groupState");
  var restoreWrap = document.getElementById("restoreWrap");
  var restoreBtn = document.getElementById("restoreBtn");
  var verList = document.getElementById("verList");
  var verEmpty = document.getElementById("verEmpty");
  var verCount = document.getElementById("verCount");

  var entryId = new URLSearchParams(location.search).get("id");
  var entry = null;
  var versions = [];

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

  function reasonText(r) {
    if (r === "delete") return "删除前存档";
    if (r === "edit") return "修改前存档";
    return "存档";
  }

  /* 版本卡片：显示时间、原因、正文开头 */
  function verHtml(v, i) {
    var body = String(v.body || "").replace(/\s+/g, " ");
    var preview = body.slice(0, 80) + (body.length > 80 ? "…" : "");
    var imgCount = (v.images && v.images.length) || (v.image ? 1 : 0);

    return '<a class="ver-item" href="版本.html?v=' + encodeURIComponent(v.version_id) + '">' +
             '<div class="ver-meta">' +
               '<span class="ver-time">' + esc(fmtTime(v.archived_at)) + "</span>" +
               '<span class="ver-tag">' + esc(reasonText(v.reason)) + "</span>" +
               '<span class="ver-tag">' + (i === 0 ? "最新版本" : "第 " + (versions.length - i) + " 版") + "</span>" +
               (imgCount ? '<span class="ver-tag">' + imgCount + " 图</span>" : "") +
             "</div>" +
             '<div class="ver-title">' + esc(v.title) + "</div>" +
             '<div class="ver-preview">' + esc(preview || "（无正文）") + "</div>" +
           "</a>";
  }

  Promise.all([window.GuiData.listAll(), window.GuiData.listVersions()])
    .then(function (res) {
      var entries = res[0];
      var all = res[1];

      versions = all.filter(function (v) { return v.entry_id === entryId; })
        .sort(function (a, b) {
          return String(b.archived_at || "").localeCompare(String(a.archived_at || ""));
        });

      entry = entries.filter(function (e) { return e.id === entryId; })[0];
      var alive = !!entry && !entry.deleted;

      /* 组名：条目还在用现行标题，否则用最新版本标题 */
      var name = alive ? entry.title : (versions[0] && versions[0].title) || "（无标题）";
      document.title = name + " · 旧图鉴 · CPU";
      groupTitle.textContent = name;

      if (alive) {
        groupState.textContent = "这个条目仍在图鉴中。下面保留着它的历史版本。";
        restoreWrap.hidden = true;
      } else {
        groupState.textContent = "这个条目已被删除，仅在这里保留。可以恢复到图鉴。";
        restoreWrap.hidden = false;
      }

      verList.innerHTML = versions.map(verHtml).join("");
      verEmpty.hidden = versions.length !== 0;
      verCount.textContent = versions.length ? "共 " + versions.length + " 个版本" : "";

      bindRestore(alive);
    })
    .catch(function (err) {
      groupTitle.textContent = "载入失败";
      groupState.textContent = err.message;
    });

  /* ---------- 恢复：确认 → 验证 → 用最新版本内容重新上线 ---------- */
  function bindRestore(alive) {
    if (alive) return;

    restoreBtn.addEventListener("click", function () {
      if (!versions.length) {
        alert("这个条目没有任何历史版本，无法恢复。");
        return;
      }

      var latest = versions[0];   /* 时间倒序的第一条就是最新版本 */

      if (!window.confirm("确定恢复条目「" + latest.title + "」吗？\n\n会用它的最新版本内容重新出现在图鉴中。")) {
        return;
      }

      window.GuiGate.ask({
        message: "确认恢复条目「" + latest.title + "」？请再次验证身份。"
      }).then(function (ok) {
        if (!ok) { location.href = "projects.html"; return; }

        restoreBtn.disabled = true;
        restoreBtn.textContent = "恢复中…";

        window.GuiData.restoreEntry(entryId, {
          title: latest.title,
          image: latest.image || "",
          images: latest.images || [],
          thumbs: latest.thumbs || [],
          intro: latest.intro || "",
          body: latest.body || "",
          tags: latest.tags || [],
          date: latest.date || ""
        }).then(function () {
          location.href = "edit-gui.html";
        }).catch(function (err) {
          restoreBtn.disabled = false;
          restoreBtn.textContent = "恢复此条目";
          groupState.textContent = "恢复失败：" + err.message;
        });
      });
    });
  }
})();
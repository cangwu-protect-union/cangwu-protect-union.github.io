/* ============================================================
   old-gui.js —— 旧图鉴（历史版本总览）
   ------------------------------------------------------------
   做法：把所有版本按 entry_id 分组，每组算作一个「旧条目」。
     · 组名 = 该条目最新的名字（条目还在就用它现在的标题，
              已删除就用最新那个版本里的标题）
     · 条目还在（未删除）→ 白色；已删除 → 灰色
     · 排序：白色在前、灰色在后，同类内按拼音首字母
   ============================================================ */
(function () {
  "use strict";

  var gridEl  = document.getElementById("oldGrid");
  var emptyEl = document.getElementById("oldEmpty");
  var countEl = document.getElementById("oldCount");
  var inputEl = document.getElementById("oldSearch");

  var groups = [];   /* { entryId, name, deleted, count } */

  /* 旧图鉴属于编辑区，未验证的话跳回去验证再回来 */
  if (!window.GuiGate.isVerified()) {
    location.replace("edit-gui.html?next=" + encodeURIComponent(location.pathname + location.search));
    return;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* 拼装分组 */
  function buildGroups(entries, versions) {
    var byEntry = {};
    versions.forEach(function (v) {
      if (!v.entry_id) return;
      if (!byEntry[v.entry_id]) byEntry[v.entry_id] = [];
      byEntry[v.entry_id].push(v);
    });

    var entryMap = {};
    entries.forEach(function (e) { entryMap[e.id] = e; });

    return Object.keys(byEntry).map(function (eid) {
      var vs = byEntry[eid].slice().sort(function (a, b) {
        return String(b.archived_at || "").localeCompare(String(a.archived_at || ""));
      });
      var e = entryMap[eid];
      var alive = !!e && !e.deleted;
      /* 组名：条目还在就用现行标题，否则用最新版本的标题 */
      var name = alive ? e.title : (vs[0] && vs[0].title) || "（无标题）";
      return { entryId: eid, name: name, deleted: !alive, count: vs.length };
    });
  }

  /* 排序：白色优先 → 拼音首字母 */
  function sortGroups(list) {
    return list.sort(function (a, b) {
      if (a.deleted !== b.deleted) return a.deleted ? 1 : -1;
      return String(a.name).localeCompare(String(b.name), "zh-Hans-CN", { sensitivity: "base" });
    });
  }

  function render(kw) {
    kw = (kw || "").trim().toLowerCase();
    var shown = groups.filter(function (g) {
      if (!kw) return true;
      return g.name.toLowerCase().indexOf(kw) !== -1;
    });

    gridEl.innerHTML = shown.map(function (g) {
      return '<a class="old-tile' + (g.deleted ? " is-deleted" : "") + '" href="old-entry.html?id=' +
             encodeURIComponent(g.entryId) + '">' +
               '<span class="old-tile-name">' + esc(g.name) + "</span>" +
               '<span class="old-tile-count">' + g.count + " 版</span>" +
             "</a>";
    }).join("");

    emptyEl.hidden = shown.length !== 0;
    countEl.textContent = groups.length
      ? (kw ? "匹配到 " + shown.length + " 个（共 " + groups.length + " 个）"
            : "共 " + groups.length + " 个旧条目")
      : "旧图鉴还是空的。";
  }

  /* 载入：条目 + 版本 */
  Promise.all([window.GuiData.listAll(), window.GuiData.listVersions()])
    .then(function (res) {
      groups = sortGroups(buildGroups(res[0], res[1]));
      render("");
    })
    .catch(function (err) {
      countEl.textContent = "载入失败：" + err.message;
    });

  inputEl.addEventListener("input", function () { render(inputEl.value); });
})();
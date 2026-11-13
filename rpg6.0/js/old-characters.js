/* ============================================================
   old-characters.js —— 旧档案总览
   ------------------------------------------------------------
   把所有未应用的版本按角色分组，每组一张卡片。
   在档的在前，已删除的在后；同类按名称排序。
   ============================================================ */
(function () {
  "use strict";

  var gateSection = document.getElementById("gateSection");
  var gateMount = document.getElementById("gateMount");
  var oldSection = document.getElementById("oldSection");
  var gridEl = document.getElementById("oldGrid");
  var emptyEl = document.getElementById("oldEmpty");
  var countEl = document.getElementById("oldCount");
  var inputEl = document.getElementById("oldSearch");

  var groups = [];

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function buildGroups(characters, versions) {
    var byCharacter = {};
    versions.forEach(function (v) {
      if (!v.character_id) return;
      if (!byCharacter[v.character_id]) byCharacter[v.character_id] = [];
      byCharacter[v.character_id].push(v);
    });

    var map = {};
    characters.forEach(function (c) { map[c.id] = c; });

    return Object.keys(byCharacter).map(function (cid) {
      var list = byCharacter[cid].slice().sort(function (a, b) {
        return String(b.archived_at || "").localeCompare(String(a.archived_at || ""));
      });
      var item = map[cid];
      var alive = !!item && !item.deleted;
      var name = alive ? item.name : (list[0] && list[0].name) || "（无名称）";
      return {
        id: cid,
        name: name,
        deleted: !alive,
        count: list.length
      };
    });
  }

  function sortGroups(list) {
    return list.sort(function (a, b) {
      if (a.deleted !== b.deleted) return a.deleted ? 1 : -1;
      return String(a.name).localeCompare(String(b.name), "zh-Hans-CN", { sensitivity: "base" });
    });
  }

  function render() {
    var kw = inputEl.value.trim().toLowerCase();
    var shown = groups.filter(function (g) {
      if (!kw) return true;
      return g.name.toLowerCase().indexOf(kw) !== -1;
    });

    gridEl.innerHTML = shown.map(function (g) {
      return '<a class="old-tile' + (g.deleted ? " is-deleted" : "") +
               '" href="old-character.html?id=' + encodeURIComponent(g.id) + '">' +
               '<span class="old-tile-name">' + esc(g.name) + "</span>" +
               '<span class="old-tile-count">' + g.count + " 版</span>" +
             "</a>";
    }).join("");

    var cloudDown = window.RpgData.isCloudDown();
    emptyEl.hidden = shown.length !== 0 || (groups.length === 0 && cloudDown);

    if (groups.length) {
      countEl.textContent = kw
        ? "匹配到 " + shown.length + " 个（共 " + groups.length + " 个）"
        : "共 " + groups.length + " 个角色有历史版本";
    } else if (cloudDown) {
      countEl.textContent = "云端暂不可用，读不到旧档案。";
    } else {
      countEl.textContent = "旧档案还是空的。";
    }
  }

  function load() {
    countEl.textContent = "正在载入…";
    Promise.all([window.RpgData.listAll(), window.RpgData.listVersions()])
      .then(function (res) {
        groups = sortGroups(buildGroups(res[0], res[1]));
        render();
      }).catch(function (err) {
        countEl.textContent = "载入失败：" + err.message;
      });
  }

  inputEl.addEventListener("input", render);

  window.GuiGate.require(gateMount, {
    cancelHref: "edit-characters.html",
    failHref: "edit-characters.html",
    onPass: function () {
      gateSection.hidden = true;
      oldSection.hidden = false;
      load();
    }
  });
})();

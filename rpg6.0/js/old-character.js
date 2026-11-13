/* ============================================================
   old-character.js —— 一个角色的全部历史版本
   ------------------------------------------------------------
   角色在档：提示仍在档案中，不给恢复按钮（用版本页的「应用」）。
   角色已删除：给「恢复此角色」，用最新版本内容重新上线。
   ============================================================ */
(function () {
  "use strict";

  var gateSection = document.getElementById("gateSection");
  var gateMount = document.getElementById("gateMount");
  var verSection = document.getElementById("verSection");
  var groupTitle = document.getElementById("groupTitle");
  var groupState = document.getElementById("groupState");
  var restoreWrap = document.getElementById("restoreWrap");
  var restoreBtn = document.getElementById("restoreBtn");
  var verList = document.getElementById("verList");
  var verEmpty = document.getElementById("verEmpty");
  var verCount = document.getElementById("verCount");

  var characterId = new URLSearchParams(location.search).get("id");

  var item = null;
  var versions = [];
  var busy = false;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function fmtTime(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 16);
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
           " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  function reasonText(reason) {
    if (reason === "delete") return "删除前存档";
    if (reason === "edit") return "修改前存档";
    return "存档";
  }

  function previewOf(version) {
    var skills = version.skills || [];
    for (var i = 0; i < skills.length; i++) {
      var text = String(skills[i].effect || "").replace(/\s+/g, " ");
      if (text) return text.slice(0, 80) + (text.length > 80 ? "…" : "");
    }
    return "（没有技能内容）";
  }

  function verHtml(version, index) {
    var images = (version.images || []).filter(function (u) { return String(u).trim(); });
    return '<a class="ver-item" href="version.html?v=' + encodeURIComponent(version.version_id) + '">' +
             '<div class="ver-meta">' +
               '<span class="ver-time">' + esc(fmtTime(version.archived_at)) + "</span>" +
               '<span class="ver-tag">' + esc(reasonText(version.reason)) + "</span>" +
               '<span class="ver-tag">' + (index === 0 ? "最新版本" : "第 " + (versions.length - index) + " 版") + "</span>" +
               (images.length ? '<span class="ver-tag">' + images.length + " 图</span>" : "") +
             "</div>" +
             '<div class="ver-title">' + esc(version.name) + "</div>" +
             '<div class="ver-preview">' + esc(previewOf(version)) + "</div>" +
           "</a>";
  }

  function bindRestore(alive) {
    if (alive) {
      restoreWrap.hidden = true;
      return;
    }
    restoreWrap.hidden = false;

    restoreBtn.addEventListener("click", function () {
      if (busy) return;
      if (!versions.length) {
        window.alert("这个角色没有任何历史版本，无法恢复。");
        return;
      }
      var latest = versions[0];

      window.RpgForm.dialog({
        title: "恢复角色",
        text: "恢复会用「" + latest.name + "」最近的一个历史版本重新上线。",
        needOperator: true,
        confirmText: "确认恢复"
      }).then(function (result) {
        if (!result) return;
        busy = true;
        restoreBtn.disabled = true;
        restoreBtn.textContent = "恢复中…";

        window.RpgData.restoreCharacter(characterId, latest, result.operator).then(function () {
          return window.RpgData.markVersionApplied(latest.version_id);
        }).then(function () {
          location.href = "edit-characters.html";
        }).catch(function (err) {
          busy = false;
          restoreBtn.disabled = false;
          restoreBtn.textContent = "恢复此角色";
          groupState.textContent = "恢复失败：" + err.message;
        });
      });
    });
  }

  function load() {
    Promise.all([window.RpgData.listAll(), window.RpgData.listVersionsOf(characterId)])
      .then(function (res) {
        var characters = res[0];
        versions = (res[1] || []).slice().sort(function (a, b) {
          return String(b.archived_at || "").localeCompare(String(a.archived_at || ""));
        });

        item = characters.filter(function (c) { return c.id === characterId; })[0];
        var alive = !!item && !item.deleted;

        var name = alive ? item.name : (versions[0] && versions[0].name) || "（无名称）";
        document.title = name + " · 历史版本 · CPU";
        groupTitle.textContent = name;

        if (alive) {
          groupState.textContent = "这个角色仍在档案中。下面保留着它的历史版本。";
        } else {
          groupState.textContent = "这个角色已被删除，仅在这里保留。可以恢复到档案。";
        }

        verList.innerHTML = versions.map(verHtml).join("");
        verEmpty.hidden = versions.length !== 0;
        verCount.textContent = versions.length ? "共 " + versions.length + " 个版本" : "";

        bindRestore(alive);
      }).catch(function (err) {
        groupTitle.textContent = "载入失败";
        groupState.textContent = err.message;
      });
  }

  if (!characterId) {
    gateSection.hidden = true;
    verSection.hidden = false;
    groupTitle.textContent = "缺少参数";
    groupState.textContent = "这个页面需要 ?id=。";
    return;
  }

  window.GuiGate.require(gateMount, {
    cancelHref: "old-characters.html",
    failHref: "old-characters.html",
    onPass: function () {
      gateSection.hidden = true;
      verSection.hidden = false;
      load();
    }
  });
})();

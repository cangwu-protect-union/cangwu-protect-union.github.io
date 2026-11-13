/* ============================================================
   edit-characters.js —— 编撰列表
   ------------------------------------------------------------
   列出全部角色（含已删除），可搜索、筛选、排序，行内编辑 / 删除 /
   恢复。没有「新增」入口：新角色只能由投稿转正产生。
   ============================================================ */
(function () {
  "use strict";

  var gateSection = document.getElementById("gateSection");
  var gateMount = document.getElementById("gateMount");
  var editSection = document.getElementById("editSection");
  var listEl = document.getElementById("adminList");
  var emptyEl = document.getElementById("adminEmpty");
  var countEl = document.getElementById("adminCount");
  var statusEl = document.getElementById("adminStatus");
  var searchEl = document.getElementById("adminSearch");
  var stateEl = document.getElementById("adminState");
  var orderEl = document.getElementById("adminOrder");

  var items = [];
  var busy = false;
  var debounceTimer = null;

  var MARK_CLASS = {
    "√": "mark-ok",
    "O": "mark-half",
    "X": "mark-bad",
    "？": "mark-unknown"
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 10);
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  function setStatus(text) {
    statusEl.hidden = !text;
    statusEl.textContent = text || "";
  }

  function matchQ(item, q) {
    if (!q) return true;
    var low = q.toLowerCase();
    var hay = [
      item.name,
      (item.aliases || []).join(" "),
      item.occupation,
      item.side_job,
      item.rating
    ].join("\n").toLowerCase();
    return hay.indexOf(low) !== -1;
  }

  function rowHtml(item) {
    var mark = String(item.review_mark || "").trim();
    var alias = (item.aliases || []).filter(function (a) { return String(a).trim(); })
      .map(function (a) { return '<span class="rpg-alias">[' + esc(a) + "]</span>"; }).join("");
    var side = String(item.side_job || "").trim();

    var meta = item.deleted
      ? "删除：" + (String(item.deleter || "").trim() || "未记录") +
        (item.deleted_at ? " · " + fmtDate(item.deleted_at) : "")
      : (String(item.editor || "").trim()
          ? "最近编辑：" + esc(item.editor) + (item.edited_at ? " · " + fmtDate(item.edited_at) : "")
          : "未编辑过");

    var actions = item.deleted
      ? '<button type="button" class="btn btn-ghost" data-act="restore">恢复</button>'
      : '<a class="btn btn-ghost" href="edit-character.html?id=' + encodeURIComponent(item.id) + '">编辑</a>' +
        '<button type="button" class="btn btn-danger" data-act="delete">删除</button>';

    return '<div class="rpg-admin-row' + (item.deleted ? " is-deleted" : "") +
             '" data-id="' + esc(item.id) + '">' +
             '<div class="rpg-admin-main">' +
               (mark ? '<span class="rpg-mark ' + (MARK_CLASS[mark] || "mark-unknown") + '">' +
                 esc(mark) + "</span>" : '<span class="rpg-mark is-empty"></span>') +
               alias +
               '<span class="rpg-name">' + esc(item.name) + "</span>" +
               (String(item.occupation || "").trim() || side
                 ? '<span class="rpg-occ">（' + esc(item.occupation) + (side ? "/" + esc(side) : "") + "）</span>"
                 : "") +
               (String(item.rating || "").trim()
                 ? '<span class="rpg-rating">' + esc(item.rating) + "</span>" : "") +
             "</div>" +
             '<div class="rpg-admin-meta">' +
               '<span class="rpg-state">' + (item.deleted ? "已删除" : "在档") + "</span>" +
               '<span class="muted">' + meta + "</span>" +
             "</div>" +
             '<div class="rpg-admin-actions">' + actions + "</div>" +
           "</div>";
  }

  function render() {
    var q = searchEl.value.trim();
    var state = stateEl.value;
    var order = orderEl.value === "desc" ? "desc" : "asc";

    var shown = items.filter(function (item) {
      if (state === "live" && item.deleted) return false;
      if (state === "deleted" && !item.deleted) return false;
      return matchQ(item, q);
    });

    shown.sort(function (a, b) {
      var ta = String(a.created_at || "");
      var tb = String(b.created_at || "");
      if (ta !== tb) return order === "desc" ? (ta < tb ? 1 : -1) : (ta < tb ? -1 : 1);
      return String(a.name).localeCompare(String(b.name), "zh-Hans-CN");
    });

    listEl.innerHTML = shown.map(rowHtml).join("");
    var cloudDown = window.RpgData.isCloudDown();
    emptyEl.hidden = shown.length !== 0 || (items.length === 0 && cloudDown);

    var live = items.filter(function (x) { return !x.deleted; }).length;
    var dead = items.length - live;
    if (items.length) {
      countEl.textContent = "共 " + items.length + " 个角色（在档 " + live + "，已删除 " + dead + "）";
    } else if (cloudDown) {
      countEl.textContent = "云端暂不可用，读不到角色。编撰只对数据库里的角色生效。";
    } else {
      countEl.textContent = "档案还是空的。";
    }
  }

  function reload() {
    countEl.textContent = "正在载入…";
    setStatus("");

    window.RpgData.listAll().then(function (list) {
      items = list;
      render();
    }).catch(function (err) {
      listEl.innerHTML = "";
      countEl.textContent = "载入失败：" + err.message;
    });
  }

  function replaceItem(id, patch) {
    items = items.map(function (item) {
      if (item.id !== id) return item;
      for (var k in patch) item[k] = patch[k];
      return item;
    });
  }

  function handleDelete(card) {
    var id = card.getAttribute("data-id");
    var item = items.filter(function (x) { return x.id === id; })[0];
    if (!item || busy) return;

    window.RpgForm.dialog({
      title: "删除角色",
      text: "删除后这条档案从公开列表消失，同时把当前内容存入旧档案，可以恢复。",
      needOperator: true,
      confirmText: "确认删除",
      danger: true
    }).then(function (result) {
      if (!result) return;
      busy = true;
      setStatus("正在删除…");

      window.RpgData.archiveVersion(item, "delete").then(function () {
        return window.RpgData.softDelete(item.id, result.operator);
      }).then(function () {
        busy = false;
        replaceItem(item.id, {
          deleted: true,
          deleter: result.operator,
          deleted_at: window.RpgData.nowIso()
        });
        render();
        setStatus("已删除「" + item.name + "」，可以在旧档案里恢复。");
      }).catch(function (err) {
        busy = false;
        setStatus("删除失败：" + err.message);
      });
    });
  }

  function handleRestore(card) {
    var id = card.getAttribute("data-id");
    var item = items.filter(function (x) { return x.id === id; })[0];
    if (!item || busy) return;

    window.RpgForm.dialog({
      title: "恢复角色",
      text: "恢复会用这条档案最近的一个历史版本重新上线。",
      needOperator: true,
      confirmText: "确认恢复"
    }).then(function (result) {
      if (!result) return;
      busy = true;
      setStatus("正在恢复…");

      window.RpgData.listVersionsOf(item.id).then(function (versions) {
        if (!versions.length) throw new Error("这个角色没有任何历史版本，无法恢复。");
        var latest = versions[0];
        return window.RpgData.restoreCharacter(item.id, latest, result.operator).then(function () {
          return window.RpgData.markVersionApplied(latest.version_id).then(function () {
            return latest;
          });
        });
      }).then(function (latest) {
        busy = false;
        replaceItem(item.id, {
          deleted: false,
          name: latest.name,
          aliases: latest.aliases,
          occupation: latest.occupation,
          side_job: latest.side_job,
          rating: latest.rating,
          review_mark: latest.review_mark,
          skills: latest.skills,
          images: latest.images,
          editor: result.operator,
          edited_at: window.RpgData.nowIso()
        });
        render();
        setStatus("已恢复「" + latest.name + "」。");
      }).catch(function (err) {
        busy = false;
        setStatus("恢复失败：" + err.message);
      });
    });
  }

  listEl.addEventListener("click", function (ev) {
    var btn = ev.target.closest ? ev.target.closest("[data-act]") : null;
    if (!btn || btn.disabled) return;
    var card = btn.closest(".rpg-admin-row");
    if (!card) return;

    if (btn.getAttribute("data-act") === "delete") handleDelete(card);
    else handleRestore(card);
  });

  searchEl.addEventListener("input", function () {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(render, 200);
  });

  stateEl.addEventListener("change", render);
  orderEl.addEventListener("change", render);

  window.GuiGate.require(gateMount, {
    cancelHref: "../projects.html",
    failHref: "../projects.html",
    onPass: function () {
      gateSection.hidden = true;
      editSection.hidden = false;
      reload();
    }
  });
})();

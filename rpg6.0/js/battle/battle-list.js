/* 回合制正传 6.0 · 战报列表
   读 rpg_battles，按时间倒序；点一行进 test.html?record=id 回放。
   列表对所有人共享，可按参与角色筛选；进页面顺手清掉 30 天前的记录。 */
import "../rpg-data.js";

(function (root) {
  "use strict";

  var PAGE_SIZE = 20;

  var state = {
    items: [],
    characters: [],
    character: "",
    loading: true,
    error: "",
    more: true,
    busy: false,
    seq: 0
  };

  function $(sel) {
    return document.querySelector(sel);
  }

  function esc(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function when(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 16);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
      " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function resultOf(item) {
    if (item.result === "draw") return "平局";
    if (item.result === "a") return (item.name_a || "甲") + " 获胜";
    if (item.result === "b") return (item.name_b || "乙") + " 获胜";
    return "未完成";
  }

  function renderCharacters() {
    var sel = $("[data-filter-character]");
    if (!sel) return;
    var html = '<option value="">全部角色</option>';
    state.characters.forEach(function (item) {
      html += '<option value="' + esc(item.id) + '">' + esc(item.name) + "</option>";
    });
    sel.innerHTML = html;
    sel.value = state.character;
  }

  function render() {
    var box = $("[data-list]");
    if (!box) return;
    if (state.loading) {
      box.innerHTML = '<p class="setup-note">正在读取战报…</p>';
      return;
    }
    if (state.error) {
      box.innerHTML = '<p class="setup-note">读取失败：' + esc(state.error) + "</p>" +
        '<p><button type="button" class="btn btn-ghost" data-retry>重试</button></p>';
      var retry = $("[data-retry]");
      if (retry) retry.addEventListener("click", load);
      return;
    }
    if (!state.items.length) {
      box.innerHTML = '<p class="setup-note">' +
        (state.character ? "这个角色还没有战报。" : "还没有战报。打完一局就会出现在这里。") + "</p>";
      return;
    }
    var html = '<ol class="battle-list-items">';
    state.items.forEach(function (item) {
      html += '<li class="battle-item">' +
        '<a class="battle-item-main" href="test.html?record=' + encodeURIComponent(item.id) + '">' +
        '<span class="battle-item-pair">' + esc(item.name_a || "甲") + " vs " + esc(item.name_b || "乙") + "</span>" +
        '<span class="battle-item-result">' + esc(resultOf(item)) + "</span>" +
        '<span class="battle-item-meta">' + item.rounds + " 回合 · " + item.steps + " 步 · " + esc(when(item.created_at)) + "</span>" +
        "</a></li>";
    });
    html += "</ol>";
    if (state.more) {
      html += '<p><button type="button" class="btn btn-ghost" data-more' +
        (state.busy ? " disabled" : "") + ">" + (state.busy ? "正在读取…" : "加载更多") + "</button></p>";
    }
    box.innerHTML = html;
    var more = $("[data-more]");
    if (more) more.addEventListener("click", loadMore);
  }

  function loadMore() {
    if (state.busy) return;
    var seq = state.seq;
    state.busy = true;
    render();
    window.RpgData.listBattles({
      limit: PAGE_SIZE,
      offset: state.items.length,
      character: state.character
    }).then(function (items) {
      if (seq !== state.seq) return;
      state.items = state.items.concat(items || []);
      state.more = (items || []).length >= PAGE_SIZE;
      state.busy = false;
      render();
    }).catch(function (err) {
      if (seq !== state.seq) return;
      state.busy = false;
      state.error = err.message || "网络错误";
      render();
    });
  }

  function load() {
    var seq = ++state.seq;
    state.loading = true;
    state.error = "";
    state.more = true;
    state.busy = false;
    render();

    if (!window.RpgData || typeof window.RpgData.listBattles !== "function") {
      state.loading = false;
      state.error = "数据层没有加载成功";
      render();
      return;
    }

    window.RpgData.listBattles({
      limit: PAGE_SIZE,
      offset: 0,
      character: state.character
    }).then(function (items) {
      if (seq !== state.seq) return;
      state.items = items || [];
      state.more = (items || []).length >= PAGE_SIZE;
      state.loading = false;
      render();
    }).catch(function (err) {
      if (seq !== state.seq) return;
      state.loading = false;
      state.error = err.message || "网络错误";
      render();
    });
  }

  function loadCharacters() {
    if (!window.RpgData || typeof window.RpgData.listAll !== "function") return;
    window.RpgData.listAll().then(function (list) {
      state.characters = (list || []).filter(function (x) {
        return x && !x.deleted && x.id;
      }).sort(function (a, b) {
        var na = String(a.name || "");
        var nb = String(b.name || "");
        return na.localeCompare(nb, "zh-Hans-CN") || (a.id < b.id ? -1 : 1);
      });
      renderCharacters();
    }).catch(function () { /* 角色取不到就不给筛选，列表照常 */ });
  }

  function onFilterChange(event) {
    var next = String(event.target.value || "");
    if (next === state.character) return;
    state.character = next;
    state.items = [];
    load();
  }

  function purge() {
    if (!window.RpgData || typeof window.RpgData.purgeBattles !== "function") return;
    /* 确实删掉了旧记录才重查一次，避免列表里留着已过期的行 */
    window.RpgData.purgeBattles().then(function (n) {
      if (n > 0) load();
    });
  }

  function boot() {
    var sel = $("[data-filter-character]");
    if (sel) sel.addEventListener("change", onFilterChange);
    loadCharacters();
    load();
    purge();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

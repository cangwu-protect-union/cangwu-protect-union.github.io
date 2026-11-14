/* 回合制正传 6.0 · 战报列表
   读 rpg_battles，按时间倒序；点一行进 test.html?record=id 回放。 */
(function (root) {
  "use strict";

  var PAGE_SIZE = 20;

  var state = { items: [], loading: true, error: "", more: true, busy: false };

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
      box.innerHTML = '<p class="setup-note">还没有战报。打完一局就会出现在这里。</p>';
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
    state.busy = true;
    render();
    window.RpgData.listBattles({ limit: PAGE_SIZE, offset: state.items.length }).then(function (items) {
      state.items = state.items.concat(items || []);
      state.more = (items || []).length >= PAGE_SIZE;
      state.busy = false;
      render();
    }).catch(function (err) {
      state.busy = false;
      state.error = err.message || "网络错误";
      render();
    });
  }

  function load() {
    state.loading = true;
    state.error = "";
    render();

    if (!window.RpgData || typeof window.RpgData.listBattles !== "function") {
      state.loading = false;
      state.error = "数据层没有加载成功";
      render();
      return;
    }

    window.RpgData.listBattles({ limit: PAGE_SIZE, offset: 0 }).then(function (items) {
      state.items = items || [];
      state.more = (items || []).length >= PAGE_SIZE;
      state.loading = false;
      render();
    }).catch(function (err) {
      state.loading = false;
      state.error = err.message || "网络错误";
      render();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

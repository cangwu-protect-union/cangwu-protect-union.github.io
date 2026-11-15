/* 策略实验室 · 页面逻辑
   优先读数据库（rpg_lab_runs / rpg_lab_pairs），读不到就退回 data/lab-snapshot.js。 */
(function () {
  "use strict";

  var TIMEOUT_MS = 6000;
  var state = { runs: [], run: null, pairs: [], filter: "全部", open: {} };

  var view = window.LabView;

  function byId(id) { return document.getElementById(id); }

  function api() {
    var base = window.GUI_CLOUDBASE || {};
    var app = window.RPG_APP || {};
    if (!base.envId || !base.publishableKey) return null;
    var tables = app.tables || {};
    return {
      rest: "https://" + String(base.envId).trim() + ".api.tcloudbasegateway.com/v1/rdb/rest/",
      key: String(base.publishableKey).trim(),
      runs: tables.labRuns || "rpg_lab_runs",
      pairs: tables.labPairs || "rpg_lab_pairs"
    };
  }

  function getJson(url, key) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error("请求超时")); }, TIMEOUT_MS);
      fetch(url, { headers: { "Authorization": "Bearer " + key } })
        .then(function (res) {
          clearTimeout(timer);
          if (!res.ok) { reject(new Error("HTTP " + res.status)); return; }
          res.json().then(resolve, reject);
        })
        .catch(function (err) { clearTimeout(timer); reject(err); });
    });
  }

  function snapshotRun() {
    var snap = window.RPG_LAB_SNAPSHOT;
    if (!snap || !snap.pairs) return null;
    return {
      id: "snapshot",
      createdAt: snap.generatedAt,
      engineVersion: snap.engineVersion,
      chars: snap.chars,
      config: snap.config,
      source: "snapshot",
      pairs: snap.pairs
    };
  }

  function dbRunMeta(row) {
    return {
      id: row.id,
      createdAt: row.created_at,
      engineVersion: row.engine_version,
      chars: row.chars || [],
      config: row.config || {},
      summary: row.summary || {},
      source: "db",
      pairs: null
    };
  }

  function dbPair(row) {
    return {
      a: row.a,
      b: row.b,
      verdict: row.verdict || { state: row.state, mode: row.mode, strength: row.strength, resolve: row.resolve, stable: row.stable, spread: row.spread },
      summary: { winA: row.avg_win_a, draw: row.draw_rate, games: row.games, cells: (row.cells || []).length, certainCells: 0 },
      cells: row.cells || [],
      policiesA: (row.policies && row.policies.a) || [],
      policiesB: (row.policies && row.policies.b) || []
    };
  }

  function loadDbRuns() {
    var c = api();
    if (!c) return Promise.resolve(null);
    return getJson(c.rest + c.runs + "?select=id,created_at,engine_version,chars,config,summary&order=created_at.desc&limit=20", c.key);
  }

  function loadDbPairs(meta) {
    var c = api();
    if (!c) return Promise.reject(new Error("没有云端配置"));
    return getJson(c.rest + c.pairs + "?select=*&run_id=eq." + encodeURIComponent(meta.id) + "&order=a.asc,b.asc", c.key)
      .then(function (rows) { return rows.map(dbPair); });
  }

  function countsOf(pairs) {
    var out = { 静止: 0, 封闭: 0, 开放: 0 };
    for (var i = 0; i < pairs.length; i++) {
      var key = pairs[i].verdict.state;
      out[key] = (out[key] || 0) + 1;
    }
    return out;
  }

  function renderSummary() {
    var box = byId("lab-summary");
    if (!state.run) { box.innerHTML = ""; return; }
    var counts = countsOf(state.pairs);
    var meta = state.run;
    var time = String(meta.createdAt || "").replace("T", " ").slice(0, 16);
    box.innerHTML = "<p class=\"lab-meta\">引擎 <code>" + view.esc(meta.engineVersion || "?") + "</code> · "
      + view.esc(time) + " · " + (meta.chars || []).length + " 角色 · " + state.pairs.length + " 对 · 每格最多 "
      + view.esc((meta.config || {}).games || "?") + " 局 · 数据来源：" + (meta.source === "db" ? "数据库" : "内置快照") + "</p>"
      + "<p class=\"lab-counts\">静止 <b>" + counts["静止"] + "</b> · 封闭 <b>" + counts["封闭"] + "</b> · 开放 <b>" + counts["开放"] + "</b></p>";
  }

  function renderFilters() {
    var box = byId("lab-filters");
    var counts = countsOf(state.pairs);
    var names = ["全部", "静止", "封闭", "开放"];
    var html = "";
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      var n = name === "全部" ? state.pairs.length : (counts[name] || 0);
      html += "<button type=\"button\" data-filter=\"" + name + "\" aria-pressed=\"" + (state.filter === name) + "\">"
        + name + "（" + n + "）</button>";
    }
    box.innerHTML = html;
    box.onclick = function (event) {
      var btn = event.target.closest("[data-filter]");
      if (!btn) return;
      state.filter = btn.getAttribute("data-filter");
      renderFilters();
      renderGrid();
    };
  }

  function cardOf(pair) {
    var el = document.createElement("section");
    el.className = "lab-card";
    var open = !!state.open[pair.a + "|" + pair.b];
    if (open) el.className += " is-open";
    el.innerHTML = "<h2>" + view.esc(pair.a) + " vs " + view.esc(pair.b)
      + "<span class=\"lab-badge " + view.stateClass(pair.verdict) + "\">" + view.stateText(pair.verdict) + "</span></h2>"
      + "<p class=\"lab-meta\">平均胜率 " + view.pct(pair.summary.winA) + " · 平局 " + view.pct(pair.summary.draw)
      + " · 极差 " + view.esc(pair.verdict.spread) + " · " + view.esc(pair.summary.games) + " 局</p>"
      + view.matrixHtml(pair)
      + "<button type=\"button\" class=\"lab-toggle\">" + (open ? "收起打法" : "打法与规则") + "</button>"
      + "<div class=\"lab-policy-box\">" + view.policyList(pair.a + " 的打法", pair.policiesA) + view.policyList(pair.b + " 的打法", pair.policiesB) + "</div>";
    var toggle = el.querySelector(".lab-toggle");
    toggle.addEventListener("click", function () {
      var key = pair.a + "|" + pair.b;
      state.open[key] = !state.open[key];
      el.classList.toggle("is-open");
      toggle.textContent = state.open[key] ? "收起打法" : "打法与规则";
    });
    return el;
  }

  function renderGrid() {
    var grid = byId("lab-grid");
    var list = state.pairs.filter(function (pair) {
      return state.filter === "全部" || pair.verdict.state === state.filter;
    });
    grid.innerHTML = "";
    if (!list.length) {
      grid.innerHTML = "<p class=\"lab-empty\">这个状态下没有对局。</p>";
      return;
    }
    for (var i = 0; i < list.length; i++) grid.appendChild(cardOf(list[i]));
  }

  function renderRunPicker() {
    var box = byId("lab-runs");
    if (state.runs.length <= 1) { box.innerHTML = ""; return; }
    var options = "";
    for (var i = 0; i < state.runs.length; i++) {
      var run = state.runs[i];
      var time = String(run.createdAt || "").replace("T", " ").slice(0, 16);
      options += "<option value=\"" + i + "\">" + view.esc(time) + " · " + view.esc(run.engineVersion || "?")
        + " · " + (run.chars || []).length + " 角色</option>";
    }
    box.innerHTML = "<label for=\"lab-run-select\">选择一次运行</label><select id=\"lab-run-select\">" + options + "</select>";
    byId("lab-run-select").onchange = function (event) {
      var index = Number(event.target.value) || 0;
      selectRun(index);
    };
  }

  function selectRun(index) {
    var meta = state.runs[index];
    if (!meta) return;
    byId("lab-status").textContent = "正在读取 " + String(meta.createdAt || "").slice(0, 10) + " 的结果…";
    var ready = meta.pairs ? Promise.resolve(meta.pairs) : loadDbPairs(meta);
    ready.then(function (pairs) {
      state.run = meta;
      state.pairs = pairs;
      state.filter = "全部";
      byId("lab-status").textContent = "";
      renderSummary();
      renderFilters();
      renderGrid();
      renderRunPicker();
    }).catch(function (err) {
      byId("lab-status").textContent = "读取失败：" + (err && err.message || err);
    });
  }

  function fallbackToSnapshot() {
    var snap = snapshotRun();
    if (!snap) {
      byId("lab-status").textContent = "数据库里还没有结果，也没有内置快照。先在本地跑一次 lab.mjs 并上传。";
      return;
    }
    state.runs = [snap];
    selectRun(0);
    byId("lab-note").textContent = "当前显示随站点发布的最新快照。";
  }

  function init() {
    byId("lab-status").textContent = "正在读取…";
    loadDbRuns().then(function (rows) {
      if (!rows || !rows.length) { fallbackToSnapshot(); return; }
      state.runs = rows.map(dbRunMeta);
      var snap = snapshotRun();
      if (snap) state.runs.push(snap);
      selectRun(0);
    }).catch(function () {
      fallbackToSnapshot();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

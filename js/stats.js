/* ============================================================
   stats.js —— 统计页
   ------------------------------------------------------------
   三块数据：
     流量   → rpc/site_stats_totals、site_stats_views、site_stats_pages
     更新记录 → data/updates.json（维护者手工维护）
     贡献度 → rpc/site_stats_edits
   范围按钮切换时三块一起重算。RPC 只返回聚合结果，访客明细不出库。
   ============================================================ */
(function () {
  "use strict";

  var RANGES = [
    { days: 7, label: "最近一周" },
    { days: 30, label: "最近一个月" },
    { days: 365, label: "最近一年" }
  ];

  var ACTIONS = [
    { key: "create", label: "新增" },
    { key: "update", label: "修改" },
    { key: "review", label: "审核" },
    { key: "delete", label: "删除" },
    { key: "other", label: "其余" }
  ];

  var MODULE_LABELS = {
    guitu: "鬼图鉴",
    quyu: "异常区域档案",
    suggest: "站点建议",
    "rpg6.0": "回合制正传6.0"
  };

  var days = 7;

  var statusEl = document.getElementById("statsStatus");
  var rangesEl = document.querySelector(".stats-ranges");
  var kpiPvEl = document.getElementById("kpiPv");
  var kpiUvEl = document.getElementById("kpiUv");
  var chartEl = document.getElementById("viewsChart");
  var viewsEmptyEl = document.getElementById("viewsEmpty");
  var pagesEl = document.getElementById("pagesList");
  var pagesEmptyEl = document.getElementById("pagesEmpty");
  var updatesEl = document.getElementById("updatesList");
  var updatesEmptyEl = document.getElementById("updatesEmpty");
  var contribEl = document.getElementById("contribTable");
  var editsEmptyEl = document.getElementById("editsEmpty");
  var viewsSection = document.getElementById("viewsSection");
  var contribSection = document.getElementById("contribSection");

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function cfg() {
    var c = window.GUI_CLOUDBASE || {};
    if (!c.envId || !c.publishableKey) return null;
    return {
      base: "https://" + String(c.envId).trim() + ".api.tcloudbasegateway.com/v1/rdb/rest/",
      key: String(c.publishableKey).trim()
    };
  }

  /* PostgREST 的函数调用：POST /rpc/名字，参数放在 JSON 里 */
  function rpc(name, args) {
    var c = cfg();
    if (!c) return Promise.reject(new Error("云端未配置"));
    return fetch(c.base + "rpc/" + name, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + c.key,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
      },
      body: JSON.stringify(args || {})
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (txt) {
          var err = new Error("HTTP " + res.status + " " + txt.slice(0, 120));
          err.status = res.status;
          throw err;
        });
      }
      return res.json();
    });
  }

  function num(v) {
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }

  function fmt(n) {
    return String(num(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function dayKey(daysAgo) {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - daysAgo);
    return d;
  }

  function shortDate(iso) {
    return String(iso || "").slice(5).replace("-", "/");
  }

  function bucketLabel(bucket, bucketIsMonth) {
    var s = String(bucket || "");
    if (!s) return "";
    if (bucketIsMonth) {
      var m = Number(String(s).slice(5, 7));
      return m ? m + "月" : s;
    }
    return shortDate(s);
  }

  function pageLabel(path) {
    var p = String(path || "");
    var parts = p.split("/").filter(function (x) { return x !== ""; });
    var last = parts.length ? parts[parts.length - 1] : p;
    if (/^$/.test(last)) last = "/";
    return decodeURIComponent(last);
  }

  /* ---------------- 流量 ---------------- */

  function renderTotals(rows) {
    var row = (rows && rows[0]) || {};
    kpiPvEl.textContent = fmt(row.pv || 0);
    kpiUvEl.textContent = fmt(row.uv || 0);
  }

  function renderChart(rows) {
    var list = (rows || []).map(function (r) {
      return { bucket: r.bucket, pv: num(r.pv), uv: num(r.uv) };
    });

    if (!list.length) {
      chartEl.innerHTML = "";
      chartEl.hidden = true;
      viewsEmptyEl.hidden = false;
      return;
    }
    viewsEmptyEl.hidden = true;
    chartEl.hidden = false;
    chartEl.classList.toggle("is-dense", list.length > 12);

    var isMonth = days > 60;
    var max = list.reduce(function (m, r) { return Math.max(m, r.pv); }, 0) || 1;

    chartEl.innerHTML = list.map(function (r) {
      var h = Math.max(2, Math.round(r.pv / max * 100));
      var label = bucketLabel(r.bucket, isMonth);
      return '<div class="stats-bar" title="' + esc(r.bucket) + "：PV " + r.pv + " / UV " + r.uv + '">' +
        '<span class="stats-bar-count">' + r.pv + "</span>" +
        '<span class="stats-bar-fill" style="height:' + h + '%"></span>' +
        '<span class="stats-bar-label">' + esc(label) + "</span>" +
        "</div>";
    }).join("");
  }

  function renderPages(rows) {
    var list = rows || [];
    if (!list.length) {
      pagesEl.innerHTML = "";
      pagesEmptyEl.hidden = false;
      return;
    }
    pagesEmptyEl.hidden = true;

    var max = list.reduce(function (m, r) { return Math.max(m, num(r.pv)); }, 0) || 1;
    pagesEl.innerHTML = list.map(function (r) {
      var pct = Math.max(4, Math.round(num(r.pv) / max * 100));
      return '<li class="stats-page">' +
        '<span class="stats-page-name" title="' + esc(r.path) + '">' + esc(pageLabel(r.path)) + "</span>" +
        '<span class="stats-page-bar"><span style="width:' + pct + '%"></span></span>' +
        '<span class="stats-page-count muted">' + fmt(r.pv) + "</span>" +
        "</li>";
    }).join("");
  }

  /* ---------------- 更新记录 ---------------- */

  function loadUpdates() {
    return fetch("data/updates.json", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        renderUpdates((data && data.updates) || []);
      })
      .catch(function () {
        updatesEl.innerHTML = "";
        updatesEmptyEl.hidden = false;
        updatesEmptyEl.textContent = "更新记录文件读取失败（data/updates.json）。";
      });
  }

  function renderUpdates(list) {
    var from = dayKey(days);
    var shown = (list || []).filter(function (u) {
      var t = new Date(String(u.date || "") + "T00:00:00");
      return !isNaN(t.getTime()) && t >= from;
    }).sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date));
    });

    if (!shown.length) {
      updatesEl.innerHTML = "";
      updatesEmptyEl.hidden = false;
      updatesEmptyEl.textContent = "这个范围内本站没有功能更新。";
      return;
    }
    updatesEmptyEl.hidden = true;

    updatesEl.innerHTML = shown.map(function (u) {
      var items = (u.items || []).map(function (it) {
        return "<li>" + esc(it) + "</li>";
      }).join("");
      return '<li class="stats-update">' +
        '<p class="stats-update-head">' +
          '<span class="stats-update-date">' + esc(u.date) + "</span>" +
          (u.tag ? '<span class="stats-tag">' + esc(u.tag) + "</span>" : "") +
          '<strong>' + esc(u.title) + "</strong>" +
        "</p>" +
        (items ? '<ul class="stats-update-items">' + items + "</ul>" : "") +
        "</li>";
    }).join("");
  }

  /* ---------------- 贡献度 ---------------- */

  function renderEdits(rows) {
    var members = (window.CPU_MEMBERS || []).slice();
    var list = rows || [];
    if (!list.length) {
      contribEl.innerHTML = "";
      editsEmptyEl.hidden = false;
      return;
    }
    editsEmptyEl.hidden = true;

    var table = {};
    function slot(name) {
      if (!table[name]) {
        table[name] = { create: 0, update: 0, review: 0, delete: 0, other: 0 };
        table[name].total = 0;
      }
      return table[name];
    }
    members.forEach(slot);

    list.forEach(function (r) {
      var name = String(r.member || "").trim();
      if (!name) return;
      var s = slot(name);
      var action = String(r.action || "");
      var n = num(r.n);
      if (action === "create" || action === "update" || action === "review" || action === "delete") {
        s[action] += n;
      } else {
        s.other += n;
      }
      s.total += n;
    });

    var names = members.slice();
    Object.keys(table).forEach(function (n) {
      if (names.indexOf(n) === -1) names.push(n);
    });

    var max = names.reduce(function (m, n) { return Math.max(m, table[n].total); }, 0) || 1;

    var head = '<div class="stats-row stats-row-head">' +
      "<span>成员</span>" +
      ACTIONS.map(function (a) { return "<span>" + a.label + "</span>"; }).join("") +
      "<span>合计</span>" +
      "</div>";

    var body = names.map(function (n) {
      var s = table[n];
      var barPct = Math.round(s.total / max * 100);
      return '<div class="stats-row">' +
        '<span class="stats-row-name">' + esc(n) + "</span>" +
        ACTIONS.map(function (a) {
          return '<span class="stats-cell">' + (a.key === "other" ? s.other : s[a.key]) + "</span>";
        }).join("") +
        '<span class="stats-cell stats-cell-total">' + s.total +
          '<span class="stats-mini-bar"><span style="width:' + barPct + '%"></span></span>' +
        "</span>" +
        "</div>";
    }).join("");

    contribEl.innerHTML = head + body;
  }

  /* ---------------- 载入与切换 ---------------- */

  function fail(msg) {
    statusEl.textContent = msg;
  }

  function loadAll() {
    statusEl.textContent = "正在载入…";
    viewsSection.hidden = false;
    contribSection.hidden = false;
    loadUpdates();

    return Promise.all([
      rpc("site_stats_totals", { p_days: days }),
      rpc("site_stats_views", { p_days: days }),
      rpc("site_stats_pages", { p_days: days, p_limit: 8 }),
      rpc("site_stats_edits", { p_days: days })
    ]).then(function (res) {
      renderTotals(res[0]);
      renderChart(res[1]);
      renderPages(res[2]);
      renderEdits(res[3]);
      statusEl.textContent = "";
    }).catch(function (err) {
      renderTotals([]);
      renderChart([]);
      renderPages([]);
      renderEdits([]);
      if (err && (err.status === 404 || /PGRST202|schema cache/i.test(String(err.message)))) {
        fail("统计后端还没启用：先在数据库控制台执行 _local/sql/editor-stats-setup.sql。");
        viewsSection.hidden = true;
        contribSection.hidden = true;
      } else {
        fail("统计载入失败：" + (err && err.message ? err.message : "未知错误"));
      }
    });
  }

  rangesEl.addEventListener("click", function (ev) {
    var btn = ev.target.closest ? ev.target.closest("[data-days]") : null;
    if (!btn) return;
    var next = num(btn.getAttribute("data-days"));
    if (!next || next === days) return;
    days = next;

    Array.prototype.forEach.call(rangesEl.querySelectorAll("[data-days]"), function (b) {
      b.classList.toggle("is-active", b === btn);
    });

    loadAll();
  });

  loadAll();
})();

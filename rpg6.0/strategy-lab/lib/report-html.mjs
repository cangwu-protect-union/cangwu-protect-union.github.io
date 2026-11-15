/* 单文件 HTML 报告：把数据内联进模板，双击即开，不依赖任何外部资源。 */
import fs from "node:fs";
import path from "node:path";

function esc(text) {
  return String(text == null ? "" : text)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const TEMPLATE = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>策略实验室 · __TITLE__</title>
<style>
  :root { color-scheme: light; --line:#d8d3c8; --ink:#24211c; --dim:#6b6459; --bg:#f6f3ea; --card:#fffdf7; }
  * { box-sizing: border-box; }
  body { margin:0; padding:24px; font:14px/1.55 "Segoe UI","Microsoft YaHei",sans-serif; color:var(--ink); background:var(--bg); }
  h1 { font-size:20px; margin:0 0 4px; letter-spacing:.02em; }
  .meta { color:var(--dim); font-size:12px; margin-bottom:16px; }
  .bar { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px; }
  .bar button { font:inherit; padding:4px 10px; border:1px solid var(--line); background:var(--card); color:var(--ink); cursor:pointer; border-radius:2px; }
  .bar button[aria-pressed="true"] { background:var(--ink); color:var(--card); border-color:var(--ink); }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:12px; }
  .pair { border:1px solid var(--line); background:var(--card); padding:12px; }
  .pair h2 { font-size:14px; margin:0 0 6px; font-weight:600; }
  .badge { display:inline-block; padding:1px 6px; border:1px solid var(--line); border-radius:2px; font-size:12px; margin-left:6px; }
  .badge.s0 { border-color:#2f6f4f; color:#2f6f4f; }
  .badge.s1 { border-color:#8a6d1f; color:#8a6d1f; }
  .badge.s2 { border-color:#7a4a72; color:#7a4a72; }
  .kv { color:var(--dim); font-size:12px; margin-bottom:8px; }
  table.m { border-collapse:collapse; font-size:12px; }
  table.m td, table.m th { border:1px solid var(--line); padding:3px 6px; text-align:center; min-width:44px; }
  table.m th { color:var(--dim); font-weight:400; }
  table.m td.sad { outline:2px solid var(--ink); outline-offset:-2px; }
  .pols { margin-top:10px; display:none; }
  .pair.open .pols { display:block; }
  .pols h3 { font-size:12px; margin:8px 0 2px; color:var(--dim); font-weight:400; }
  .pols ul { margin:0; padding-left:16px; }
  .pols li { font-size:12px; color:var(--dim); }
  .toggle { margin-top:8px; font:inherit; font-size:12px; padding:2px 8px; border:1px solid var(--line); background:transparent; cursor:pointer; }
</style>
</head>
<body>
<h1>策略实验室</h1>
<div class="meta">__META__</div>
<div class="bar" id="filters"></div>
<div class="grid" id="grid"></div>
<script>
const DATA = __DATA__;

function tint(v) {
  const d = Math.min(1, Math.abs(v - 0.5) * 2);
  const a = 0.08 + d * 0.5;
  return v >= 0.5 ? "rgba(181,83,59," + a.toFixed(2) + ")" : "rgba(59,110,165," + a.toFixed(2) + ")";
}

function stateClass(verdict) {
  if (verdict.state === "静止") return "s0";
  if (verdict.state === "封闭") return "s1";
  return "s2";
}

function stateText(verdict) {
  if (verdict.resolve === "underpowered") return verdict.state + "（预算不足）";
  if (verdict.state === "静止") {
    if (verdict.mode === "策略无关") return "静止 · 无策略差异";
    if (verdict.mode === "多重最优") return "静止 · 多重最优";
    return "静止 · 唯一最优";
  }
  if (verdict.state === "封闭") return "封闭 · 克制循环";
  if (verdict.mode === "弱鞍点") return "开放 · 弱鞍点";
  if (verdict.mode && verdict.mode.indexOf("单向") === 0) return "开放 · 单向选择";
  return "开放 · 平坦";
}

function pct(v) { return (v * 100).toFixed(1) + "%"; }

function matrixHtml(pair) {
  const rows = pair.cells.map((row, i) => {
    const tds = row.map((cell, j) => {
      const v = cell.n ? (cell.a + 0.5 * cell.d) / cell.n : 0;
      const sad = pair.verdict.cell && pair.verdict.cell[0] === i && pair.verdict.cell[1] === j ? " sad" : "";
      return '<td class="' + (sad ? "sad " : "") + '" style="background:' + tint(v) + '" title="' +
        (cell.n + " 局，平 " + cell.d) + '">' + pct(v) + "</td>";
    }).join("");
    return "<tr><th>A" + i + "</th>" + tds + "</tr>";
  }).join("");
  const head = "<tr><th></th>" + pair.cells[0].map((_, j) => "<th>B" + j + "</th>").join("") + "</tr>";
  return '<table class="m">' + head + rows + "</table>";
}

function polList(title, list) {
  if (!list || !list.length) return "";
  return "<h3>" + title + "</h3><ul>" + list.map(function (p) {
    return "<li><code>" + p.id + "</code> 保底 " + pct(p.obj) + "<br>" + p.readable.join("<br>") + "</li>";
  }).join("") + "</ul>";
}

function card(pair) {
  const el = document.createElement("section");
  el.className = "pair";
  el.dataset.state = pair.verdict.state;
  el.innerHTML = "<h2>" + pair.a + " vs " + pair.b +
    '<span class="badge ' + stateClass(pair.verdict) + '">' + stateText(pair.verdict) + "</span></h2>" +
    '<div class="kv">平均胜率 ' + pct(pair.summary.winA) + " · 平局 " + pct(pair.summary.draw) +
    " · 极差 " + pair.verdict.spread + " · 对局 " + pair.summary.games + " 局" +
    (pair.summary.certainCells ? "（" + pair.summary.certainCells + "/" + pair.summary.cells + " 格提前收手）" : "") + "</div>" +
    matrixHtml(pair) +
    '<button class="toggle">打法与规则</button>' +
    '<div class="pols">' + polList(pair.a + " 的打法", pair.policiesA) + polList(pair.b + " 的打法", pair.policiesB) + "</div>";
  el.querySelector(".toggle").addEventListener("click", function () {
    el.classList.toggle("open");
  });
  return el;
}

const grid = document.getElementById("grid");
const states = ["全部", "静止", "封闭", "开放"];
const filters = document.getElementById("filters");
let active = "全部";
states.forEach(function (s) {
  const b = document.createElement("button");
  b.textContent = s + (s === "全部" ? "（" + DATA.pairs.length + "）" : "（" + DATA.pairs.filter(function (p) { return p.verdict.state === s; }).length + "）");
  b.setAttribute("aria-pressed", String(s === active));
  b.addEventListener("click", function () {
    active = s;
    for (const other of filters.querySelectorAll("button")) other.setAttribute("aria-pressed", String(other === b));
    render();
  });
  filters.appendChild(b);
});

function render() {
  grid.textContent = "";
  DATA.pairs.filter(function (p) { return active === "全部" || p.verdict.state === active; }).forEach(function (p) {
    grid.appendChild(card(p));
  });
}
render();
</script>
</body>
</html>
`;

export function writeHtml(outDir, result) {
  const title = result.generatedAt.slice(0, 16).replace("T", " ");
  const meta = "引擎 " + result.engineVersion + " · 生成于 " + title + " · " + result.chars.length
    + " 角色 / " + result.pairs.length + " 对 · 每格最多 " + result.config.games + " 局";
  const data = {
    engineVersion: result.engineVersion,
    generatedAt: result.generatedAt,
    config: result.config,
    chars: result.chars,
    pairs: result.pairs.map((p) => ({
      a: p.a,
      b: p.b,
      verdict: p.verdict,
      summary: p.summary,
      cells: p.cells,
      policiesA: p.policiesA.map((x) => ({ id: x.id, obj: x.obj, readable: x.readable })),
      policiesB: p.policiesB.map((x) => ({ id: x.id, obj: x.obj, readable: x.readable }))
    }))
  };
  const html = TEMPLATE
    .replace("__TITLE__", esc(title))
    .replace("__META__", esc(meta))
    .replace("__DATA__", JSON.stringify(data).replace(/</g, "\\u003c"));
  const file = path.join(outDir, "report.html");
  fs.writeFileSync(file, html, "utf8");
  return file;
}

#!/usr/bin/env node
/* ============================================================
   tools/size-report.js —— 代码行额度与结构指标，零依赖
   ------------------------------------------------------------
   用法：
     node tools/size-report.js                 总览：额度表、超限、接近、豁免
     node tools/size-report.js --check         只看违规（check.ps1 用），有超限退出 1
     node tools/size-report.js --check --stdin 文件清单从 stdin 读（每行一个，来自 git ls-files）
     node tools/size-report.js --near          列出 ≥ warnRatio 的文件与余量
     node tools/size-report.js --file <路径>   单文件明细：函数长度、嵌套、长行
     node tools/size-report.js --json          机器可读输出

   规则来源是 tools/size-budget.json：
     额度按代码行算（非空、非注释行），注释与空行不占额度，所以想写注释不会被罚。
     豁免只给“拆了会产生新风险”的文件，必须写明 class 与 why，cap 不得超过 hardCap。
     数据文件（生成物、平铺用例）不计额度，但必须写明 why。

   退出码：0 全过，1 有超限或配置不合法。
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(__dirname, "size-budget.json");
const SKIP_DIRS = new Set([".git", "node_modules", ".pnpm-store", "_local", ".vscode", "preview"]);
const CODE_EXT = new Set(["js", "mjs", "css", "html", "htm", "md", "ps1"]);
const JS_EXT = new Set(["js", "mjs"]);

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const valueOf = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};

function fail(msg) {
  console.error("size-report: " + msg);
  process.exit(1);
}

function loadConfig() {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch (e) {
    fail("读不到 size-budget.json：" + e.message);
  }
  const problems = [];
  for (const item of raw.exempt || []) {
    if (!item.path || !item.class || !item.why || !(item.cap > 0)) {
      problems.push("豁免条目缺 path/class/why/cap：" + JSON.stringify(item));
      continue;
    }
    if (item.cap > raw.hardCap) problems.push("豁免 cap 超过 hardCap：" + item.path);
    if (!fs.existsSync(path.join(ROOT, item.path))) problems.push("豁免条目指向不存在的文件：" + item.path);
  }
  for (const item of raw.dataFiles || []) {
    if (!item.path || !item.why) problems.push("数据文件条目缺 path/why：" + JSON.stringify(item));
    else if (!fs.existsSync(path.join(ROOT, item.path))) problems.push("数据文件条目指向不存在的文件：" + item.path);
  }
  if (problems.length) fail(problems.join("\n"));
  return raw;
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, "/");
}

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
      walk(path.join(dir, entry.name), out);
    } else if (CODE_EXT.has(path.extname(entry.name).slice(1).toLowerCase())) {
      out.push(path.join(dir, entry.name));
    }
  }
}

function readList() {
  if (has("--stdin")) {
    const text = fs.readFileSync(0, "utf8");
    return text.split(/\r?\n|\0/).map((s) => s.trim()).filter(Boolean)
      .filter((p) => CODE_EXT.has(path.extname(p).slice(1).toLowerCase()))
      .map((p) => path.join(ROOT, p));
  }
  const out = [];
  walk(ROOT, out);
  return out;
}

/* 把注释与字符串体替换成空格，行号不变；后续结构分析只看剩下的代码 */
function maskSource(text) {
  const out = text.split("");
  const n = text.length;
  let i = 0;
  let lastSig = "";
  const blank = (a, b) => {
    for (let k = a; k < b && k < n; k++) if (out[k] !== "\n") out[k] = " ";
  };
  while (i < n) {
    const c = text[i];
    if (c === "/" && text[i + 1] === "/") {
      const end = text.indexOf("\n", i);
      const stop = end < 0 ? n : end;
      blank(i, stop);
      i = stop;
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      const stop = end < 0 ? n : end + 2;
      blank(i, stop);
      i = stop;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < n) {
        if (text[j] === "\\") { j += 2; continue; }
        if (text[j] === c) { j++; break; }
        if (text[j] === "\n") break;
        j++;
      }
      blank(i + 1, j - 1 > i ? j - 1 : i + 1);
      i = j;
      lastSig = c;
      continue;
    }
    if (c === "/" && /[(,=:[!&|?{};+\-*%<>~^]|^$/.test(lastSig)) {
      let j = i + 1;
      let inClass = false;
      while (j < n) {
        const d = text[j];
        if (d === "\\") { j += 2; continue; }
        if (d === "[") inClass = true;
        else if (d === "]") inClass = false;
        else if (d === "/" && !inClass) { j++; break; }
        else if (d === "\n") break;
        j++;
      }
      blank(i + 1, j - 1 > i ? j - 1 : i + 1);
      i = j;
      lastSig = "/";
      continue;
    }
    if (!/\s/.test(c)) lastSig = c;
    i++;
  }
  return out.join("");
}

/* 代码行、长行、函数长度、嵌套深度、参数个数；只对 js/mjs 算结构 */
function analyze(text, wantStructure) {
  const masked = maskSource(text);
  const rawLines = text.split("\n");
  const codeLines = masked.split("\n");
  let codeCount = 0;
  const longLines = [];
  for (let k = 0; k < codeLines.length; k++) {
    const line = codeLines[k];
    if (!line.trim()) continue;
    codeCount++;
    const width = rawLines[k].length;
    if (width > 200) longLines.push({ line: k + 1, width });
  }
  const blankCount = rawLines.filter((l) => !l.trim()).length;
  const result = {
    lines: rawLines.length,
    codeLines: codeCount,
    blankRatio: rawLines.length ? +(blankCount / rawLines.length).toFixed(4) : 1,
    maxLineLength: rawLines.reduce((m, l) => Math.max(m, l.length), 0),
    longLines,
    functions: [],
    maxFunctionLines: 0,
    maxNesting: 0,
    maxParams: 0
  };
  if (!wantStructure) return result;

  let line = 1;
  let depth = 0;
  let maxDepth = 0;
  let lastWord = "";
  let pending = null;
  const frames = [];
  let i = 0;
  const n = masked.length;
  while (i < n) {
    const c = masked[i];
    if (c === "\n") { line++; i++; continue; }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_$]/.test(masked[j])) j++;
      const word = masked.slice(i, j);
      if (word === "function") {
        let back = i - 1;
        while (back >= 0 && /\s/.test(masked[back])) back--;
        const prevSig = back >= 0 ? masked[back] : "";
        let k = j;
        while (k < n && /\s/.test(masked[k])) { if (masked[k] === "\n") line++; k++; }
        let name = "";
        if (/[A-Za-z_$]/.test(masked[k])) {
          let m = k + 1;
          while (m < n && /[A-Za-z0-9_$]/.test(masked[m])) m++;
          name = masked.slice(k, m);
          k = m;
          while (k < n && /\s/.test(masked[k])) { if (masked[k] === "\n") line++; k++; }
        }
        let params = 0;
        if (masked[k] === "(") {
          let par = 0;
          let start = k;
          for (; k < n; k++) {
            if (masked[k] === "(") par++;
            else if (masked[k] === ")") { par--; if (!par) { k++; break; } }
            else if (masked[k] === "\n") line++;
          }
          const inner = masked.slice(start + 1, k - 1).trim();
          params = inner ? inner.split(",").length : 0;
        }
        while (k < n && /\s/.test(masked[k])) { if (masked[k] === "\n") line++; k++; }
        const label = name || (prevSig === "=" || prevSig === ":" ? lastWord : "") || "匿名@" + (line + 1);
        pending = { name: label, params, startLine: line };
        i = k;
        continue;
      }
      lastWord = word;
      i = j;
      continue;
    }
    if (c === "{") {
      depth++;
      if (pending) {
        frames.push({ name: pending.name, params: pending.params, startLine: pending.startLine, baseDepth: depth - 1, maxDepth: 0 });
        pending = null;
      }
      for (const f of frames) f.maxDepth = Math.max(f.maxDepth, depth - f.baseDepth);
      maxDepth = Math.max(maxDepth, depth);
      i++;
      continue;
    }
    if (c === "}") {
      for (let f = frames.length - 1; f >= 0; f--) {
        if (frames[f].baseDepth === depth - 1) {
          const frame = frames.splice(f, 1)[0];
          frame.length = line - frame.startLine + 1;
          frame.endLine = line;
          result.functions.push(frame);
          break;
        }
      }
      depth = Math.max(0, depth - 1);
      i++;
      continue;
    }
    i++;
  }
  pending = null;
  /* 顶层 IIFE 包住整个文件，不是可以拆的单元，不参与函数长度统计 */
  result.functions = result.functions.filter((f) => !(f.startLine <= 10 && f.length > result.lines * 0.8));
  result.functions.sort((a, b) => b.length - a.length);
  result.maxNesting = maxDepth;
  result.maxFunctionLines = result.functions.length ? result.functions[0].length : 0;
  result.maxParams = result.functions.reduce((m, f) => Math.max(m, f.params), 0);
  return result;
}

function budgetFor(p, cfg) {
  const ext = path.extname(p).slice(1).toLowerCase();
  const exemption = (cfg.exempt || []).find((item) => item.path === p);
  if (exemption) return { budget: exemption.cap, exemptClass: exemption.class, why: exemption.why };
  if (isDataPath(p, cfg)) return { budget: 0, data: true };
  const tool = (cfg.toolPaths || []).some((prefix) => p.startsWith(prefix));
  if (tool) return { budget: cfg.toolBudget, exemptClass: null };
  return { budget: (cfg.budgets || {})[ext] || 0 };
}

function isDataPath(p, cfg) {
  if ((cfg.dataFiles || []).some((item) => item.path === p)) return true;
  return (cfg.dataPrefixes || []).some((prefix) => p.startsWith(prefix));
}

function collect(cfg, files) {
  const dataFiles = new Map((cfg.dataFiles || []).map((item) => [item.path, item.why]));
  const skip = cfg.skip || [];
  const rows = [];
  let blobFail = 0;  for (const file of files) {
    const p = rel(file);
    if (skip.some((prefix) => p.startsWith(prefix))) continue;
    let stat;
    try { stat = fs.statSync(file); } catch (e) { continue; }
    if (!stat.isFile()) continue;
    if (stat.size > cfg.blobLimitBytes) {
      rows.push({ path: p, bytes: stat.size, blob: true, over: true });
      blobFail++;
      continue;
    }
    const ext = path.extname(p).slice(1).toLowerCase();
    const text = fs.readFileSync(file, "utf8");
    const isData = isDataPath(p, cfg);
    const { budget, exemptClass, why } = budgetFor(p, cfg);
    const metrics = analyze(text, JS_EXT.has(ext) && !isData);
    rows.push({
      path: p,
      ext,
      bytes: stat.size,
      isData,
      dataWhy: (dataFiles.get(p) || "") || (isData ? "数据目录，不计额度" : ""),
      budget,
      exemptClass: exemptClass || null,
      exemptWhy: why || "",
      over: !isData && (metrics.codeLines > budget || metrics.codeLines > cfg.hardCap),
      ...metrics
    });
  }
  return { rows, blobFail };
}

function warningsFor(row, cfg) {
  const warn = [];
  if (row.isData || !row.budget || !JS_EXT.has(row.ext)) return warn;
  const s = cfg.structureWarn || {};
  if (row.blankRatio < s.minBlankRatio) warn.push("空行率 " + Math.round(row.blankRatio * 100) + "%");
  if (row.maxLineLength > s.maxLineLength) warn.push("最长行 " + row.maxLineLength);
  if (row.maxFunctionLines > s.maxFunctionLines) warn.push("最长函数 " + row.maxFunctionLines + " 行");
  if (row.maxNesting > s.maxNesting) warn.push("嵌套 " + row.maxNesting);
  if (row.maxParams > s.maxParams) warn.push("参数 " + row.maxParams);
  return warn;
}

function fmtRow(row) {
  if (row.isData) return row.path.padEnd(46) + "数据（不计额度）";
  const ratio = row.budget ? Math.round((row.codeLines / row.budget) * 100) : 0;
  let text = row.path.padEnd(46) + String(row.codeLines).padStart(5) + " / " + String(row.budget).padStart(4) + "  " + String(ratio).padStart(3) + "%";
  if (row.exemptClass) text += "  豁免" + row.exemptClass;
  return text;
}

function main() {
  const cfg = loadConfig();
  const files = readList();
  const { rows, blobFail } = collect(cfg, files);
  const over = rows.filter((r) => r.over);
  const near = rows.filter((r) => !r.over && !r.isData && r.budget && r.codeLines >= r.budget * cfg.warnRatio)
    .sort((a, b) => b.codeLines / b.budget - a.codeLines / a.budget);
  const warnRows = rows.filter((r) => !r.isData).map((r) => ({ row: r, warn: warningsFor(r, cfg) })).filter((x) => x.warn.length);

  if (has("--json")) {
    console.log(JSON.stringify({ config: cfg, rows, over: over.map((r) => r.path), near: near.map((r) => r.path) }, null, 2));
    process.exit(over.length || blobFail ? 1 : 0);
  }

  if (has("--file")) {
    const want = valueOf("--file");
    const row = rows.find((r) => r.path === want || r.path === rel(path.resolve(want)));
    if (!row) fail("文件不在统计范围：" + want);
    console.log(fmtRow(row));
    console.log("  行数 " + row.lines + "，空行率 " + Math.round(row.blankRatio * 100) + "%，最长行 " + row.maxLineLength);
    if (row.budget) console.log("  余量 " + (row.budget - row.codeLines) + " 行");
    if (row.exemptWhy) console.log("  豁免理由：" + row.exemptWhy);
    if (row.dataWhy) console.log("  数据文件：" + row.dataWhy);
    const top = row.functions.slice(0, 5);
    for (const fn of top) console.log("  函数 " + fn.name + " " + fn.length + " 行（" + fn.startLine + "-" + fn.endLine + "，参数 " + fn.params + "）");
    if (row.longLines.length) console.log("  长行 " + row.longLines.slice(0, 5).map((l) => l.line + ":" + l.width).join("、"));
    process.exit(0);
  }

  if (has("--check")) {
    let bad = 0;
    for (const row of over) {
      console.log("  over  " + fmtRow(row) + (row.blob ? "  体积 " + Math.round(row.bytes / 1024) + "KB 超过 " + Math.round(cfg.blobLimitBytes / 1024) + "KB" : ""));
      bad++;
    }
    if (near.length) {
      const head = near.slice(0, 5).map((r) => r.path + " " + r.codeLines + "/" + r.budget).join("、");
      console.log("  near  " + near.length + " 个：" + head + (near.length > 5 ? " 等（node tools/size-report.js --near 看全部）" : ""));
    }
    if (warnRows.length) console.log("  warn  " + warnRows.length + " 个结构提醒（node tools/size-report.js 看全部）");
    if (bad) console.log("size gate: " + bad + " 个文件超额度");
    else console.log("size gate: ok（" + rows.length + " 个文件，最近 " + (near[0] ? near[0].path + " " + near[0].codeLines + "/" + near[0].budget : "无") + "）");
    process.exit(bad ? 1 : 0);
  }

  console.log("--- 额度（代码行）---");
  console.log("  " + Object.keys(cfg.budgets).map((k) => "." + k + " " + cfg.budgets[k]).join("   ") + "   工具 " + cfg.toolBudget + "   硬顶 " + cfg.hardCap + "   预警 " + Math.round(cfg.warnRatio * 100) + "%");
  console.log("--- 超限 ---");
  if (!over.length) console.log("  无");
  for (const row of over) console.log("  " + fmtRow(row));
  console.log("--- 接近预警线 ---");
  if (!near.length) console.log("  无");
  for (const row of near.slice(0, 10)) console.log("  " + fmtRow(row) + "  剩 " + (row.budget - row.codeLines));
  if (near.length > 10) console.log("  ……另有 " + (near.length - 10) + " 个");
  console.log("--- 结构提醒（不阻断，最差 " + Math.min(warnRows.length, 8) + "/" + warnRows.length + "）---");
  if (!warnRows.length) console.log("  无");
  for (const item of warnRows.slice(0, 8)) console.log("  " + item.row.path + "  " + item.warn.join("、"));
  console.log("--- 豁免 ---");
  for (const item of cfg.exempt || []) console.log("  " + item.class + "  " + item.path + "  cap " + item.cap + "  " + item.why);
  console.log("--- 数据文件（不计额度）---");
  for (const item of cfg.dataFiles || []) console.log("  " + item.path + "  " + item.why);
  process.exit(over.length || blobFail ? 1 : 0);
}

main();

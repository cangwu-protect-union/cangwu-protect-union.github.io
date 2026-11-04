#!/usr/bin/env node
/* ============================================================
   tools/design-audit.js —— 界面「AI 味」体检，零依赖，只用 node 内置模块
   ------------------------------------------------------------
   用法：node tools/design-audit.js [--json]

   这不是语法检查（那是 tools/check.js 的活），只量界面上靠眼睛
   数不准的东西，给 DESIGN.md 里的清单提供数字：

     字号   种类数、最小值、每种各用了多少次
     圆角   种类数、偏离 --radius 的硬编码值
     效果   渐变 / 毛玻璃 / 发光阴影 / 装饰动画 的条数
     颜色   :root 之外硬编码的颜色（换配色时会漏改）
     表情   HTML 正文里的 emoji 与符号，带行号

   退出码恒为 0：这是体检报告，不是门禁。改完界面重跑一次，
   和的数字比就知道有没有变干净。
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");

const ARG_ROOT = process.argv.slice(2).find((a) => !a.startsWith("-"));
const ROOT = ARG_ROOT ? path.resolve(ARG_ROOT) : path.resolve(__dirname, "..");
const JSON_OUT = process.argv.includes("--json");
const SKIP_DIRS = new Set([".git", "node_modules", ".pnpm-store", "_local", "lib", "preview", ".dsh", ".vscode"]);
const BASE_FONT = 16; // 1rem = 16px，和 body 的 font-size 一致

function walk(dir, out) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) {
      if (SKIP_DIRS.has(name.name) || name.name.startsWith(".")) continue;
      walk(full, out);
    } else {
      const ext = path.extname(name.name).toLowerCase();
      if (ext === ".css" || ext === ".html" || ext === ".htm") out.push(full);
    }
  }
  return out;
}

const rel = (f) => path.relative(ROOT, f).replace(/\\/g, "/");
const lineAt = (text, index) => text.slice(0, index).split("\n").length;

/* ---------- CSS 解析：取出每条声明所属的选择器 ---------- */
function parseCss(text) {
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length)); // 保长度，行号不偏
  const decls = [];
  const stack = [];
  let buf = "";
  let bufStart = 0;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === "{") {
      stack.push({ prelude: buf.trim().replace(/\s+/g, " "), at: buf.trim().startsWith("@"), line: lineAt(clean, i) });
      buf = "";
      bufStart = i + 1;
    } else if (ch === "}") {
      const top = stack.pop();
      if (top && !top.at && top.prelude) {
        let offset = bufStart;
        for (const part of buf.split(";")) {
          const partStart = offset;
          offset += part.length + 1;
          const idx = part.indexOf(":");
          if (idx < 0) continue;
          const prop = part.slice(0, idx).trim().toLowerCase();
          const value = part.slice(idx + 1).trim();
          if (prop && value) decls.push({ selector: top.prelude, prop, value, line: lineAt(clean, partStart + idx) });
        }
      }
      buf = "";
      bufStart = i + 1;
    } else {
      buf += ch;
    }
  }
  return decls;
}

/* ---------- 单位换算 ---------- */
function toPx(value) {
  const v = value.trim().toLowerCase();
  let m = /^(-?[\d.]+)px$/.exec(v);
  if (m) return Number(m[1]);
  m = /^(-?[\d.]+)rem$/.exec(v);
  if (m) return Number(m[1]) * BASE_FONT;
  m = /^(-?[\d.]+)em$/.exec(v);
  if (m) return Number(m[1]) * BASE_FONT; // 近似：按父级 16px 算
  m = /^(-?[\d.]+)%$/.exec(v);
  if (m) return (Number(m[1]) / 100) * BASE_FONT;
  return null;
}

const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;
const SYMBOL_RE = /[\u2190-\u21FF\u2300-\u23FF\u25A0-\u25FF]/g;

const files = walk(ROOT, []).sort();
const cssFiles = files.filter((f) => f.toLowerCase().endsWith(".css"));
const htmlFiles = files.filter((f) => /\.html?$/i.test(f));

const fontSizes = [];      // {value, px, selector, file, line}
const radii = [];          // {raw, parts, selector, file, line}
const effects = [];        // {kind, selector, file, line, value}
const hardColors = [];     // {hex, selector, file, line}
const emojis = [];         // {char, file, line, context}
const symbols = [];
const tokens = new Set();
let varUses = 0;

for (const file of cssFiles) {
  const text = fs.readFileSync(file, "utf8");
  for (const d of parseCss(text)) {
    const isRoot = /:root/.test(d.selector);
    if (d.prop === "--" || d.prop.startsWith("--")) tokens.add(d.prop);
    if (d.value.includes("var(--")) varUses++;

    if (d.prop === "font-size") {
      fontSizes.push({ value: d.value, px: toPx(d.value), selector: d.selector, file: rel(file), line: d.line });
      continue;
    }
    if (d.prop === "border-radius") {
      const parts = d.value.split(/[\s/]+/).filter(Boolean).map((p) => ({ raw: p, px: toPx(p) }));
      radii.push({ raw: d.value, parts, selector: d.selector, file: rel(file), line: d.line });
      continue;
    }
    if (/gradient\(/.test(d.value)) effects.push({ kind: "渐变", value: d.value, selector: d.selector, file: rel(file), line: d.line });
    if (d.prop === "backdrop-filter" && d.value !== "none") effects.push({ kind: "毛玻璃", value: d.value, selector: d.selector, file: rel(file), line: d.line });
    if (/box-shadow/.test(d.prop)) {
      if (d.value === "none") continue;
      // 0 0 0 Npx 是焦点环，属于可达性，不算装饰发光
      const focusRing = /:focus/.test(d.selector) && /^\s*(?:inset\s+)?0\s+0\s+0\s+\d/.test(d.value);
      const glow = !focusRing && /(?:^|\s)0\s+0\s+[1-9]\d*px\s/.test(d.value) && !/rgba?\(\s*0\s*,\s*0\s*,\s*0/.test(d.value);
      effects.push({ kind: focusRing ? "焦点环" : glow ? "发光阴影" : "阴影", value: d.value, selector: d.selector, file: rel(file), line: d.line });
    }
    if (d.prop === "text-shadow" && d.value !== "none") effects.push({ kind: "发光阴影", value: d.value, selector: d.selector, file: rel(file), line: d.line });
    if (d.prop === "animation" || d.prop === "animation-name") {
      if (/bounce|pulse|float|shake|wiggle|blink|glow|spin|flash/i.test(d.value)) effects.push({ kind: "装饰动画", value: d.value, selector: d.selector, file: rel(file), line: d.line });
    }
    if (d.prop === "filter" && d.value !== "none" && /blur|drop-shadow/.test(d.value)) effects.push({ kind: "滤镜", value: d.value, selector: d.selector, file: rel(file), line: d.line });

    if (!isRoot) {
      const hexes = d.value.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
      for (const hex of hexes) hardColors.push({ hex, selector: d.selector, file: rel(file), line: d.line });
    }
  }
}

for (const file of htmlFiles) {
  const raw = fs.readFileSync(file, "utf8");
  const text = raw
    .replace(/<!--[\s\S]*?-->/g, (m) => " ".repeat(m.length))
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, (m) => " ".repeat(m.length));
  for (const m of text.matchAll(EMOJI_RE)) {
    if (m[0] === "\uFE0F" || m[0] === "\u200D") continue;
    emojis.push({ char: m[0], file: rel(file), line: lineAt(text, m.index), context: snippet(text, m.index) });
  }
  for (const m of text.matchAll(SYMBOL_RE)) {
    symbols.push({ char: m[0], file: rel(file), line: lineAt(text, m.index), context: snippet(text, m.index) });
  }
}

function snippet(text, index) {
  const start = Math.max(0, index - 40);
  const raw = text.slice(start, index + 40).replace(/\s+/g, " ").trim();
  return raw.length > 90 ? "…" + raw.slice(-89) : raw;
}

/* ---------- 汇总 ---------- */
const sizeMap = new Map();
for (const s of fontSizes) {
  const key = s.px === null ? s.value : `${Number(s.px.toFixed(2))}px`;
  const row = sizeMap.get(key) || { key, px: s.px, count: 0, samples: [] };
  row.count++;
  if (row.samples.length < 3) row.samples.push(`${s.file}:${s.line} ${s.selector}`);
  sizeMap.set(key, row);
}
const sizes = [...sizeMap.values()].sort((a, b) => (a.px ?? 1e9) - (b.px ?? 1e9));
const tooSmall = sizes.filter((s) => s.px !== null && s.px < 12);
const radiusMap = new Map();
for (const r of radii) {
  const key = r.raw.replace(/\s+/g, " ").trim();
  radiusMap.set(key, (radiusMap.get(key) || 0) + 1);
}
const radiusList = [...radiusMap.entries()].sort((a, b) => b[1] - a[1]);

const report = {
  cssFiles: cssFiles.length,
  htmlFiles: htmlFiles.length,
  fontSize: { kinds: sizes.length, min: sizes.find((s) => s.px !== null)?.px ?? null, sizes, tooSmall: tooSmall.length },
  radius: { kinds: radiusList.length, list: radiusList },
  effects: { total: effects.length, byKind: countBy(effects.map((e) => e.kind)), items: effects },
  colors: { hardcoded: hardColors.length, tokens: tokens.size, varUses, items: hardColors },
  emoji: { count: emojis.length, items: emojis },
  symbols: { count: symbols.length, items: symbols },
};

function countBy(arr) {
  const m = {};
  for (const a of arr) m[a] = (m[a] || 0) + 1;
  return m;
}

if (JSON_OUT) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const FONT_LIMIT = 4;
const RADIUS_LIMIT = 4;
const out = [];
out.push(`扫描 ${cssFiles.length} 个 CSS、${htmlFiles.length} 个 HTML —— ${ROOT}`);
out.push("");
out.push(`【字号】${sizes.length} 种（清单上限 ${FONT_LIMIT}），最小 ${report.fontSize.min === null ? "未知" : report.fontSize.min + "px"}（下限 12px）`);
for (const s of sizes) {
  const flag = s.px !== null && s.px < 12 ? "  ← 小于 12px" : "";
  out.push(`  ${String(s.key).padEnd(9)} ×${String(s.count).padEnd(3)} ${s.samples[0] || ""}${flag}`);
}
out.push("");
out.push(`【圆角】${radiusList.length} 种（清单上限 ${RADIUS_LIMIT}）`);
for (const [key, count] of radiusList) out.push(`  ${key.padEnd(14)} ×${count}`);
out.push("");
out.push(`【装饰效果】共 ${effects.length} 条：${Object.entries(report.effects.byKind).map(([k, v]) => `${k} ${v}`).join("、") || "无"}`);
for (const e of effects.slice(0, 12)) out.push(`  ${e.file}:${e.line} ${e.kind} ${e.selector}`);
if (effects.length > 12) out.push(`  …… 另有 ${effects.length - 12} 条，用 --json 看全量`);
out.push("");
out.push(`【颜色】:root 之外硬编码 ${hardColors.length} 处，已定义 ${tokens.size} 个变量，var() 用了 ${varUses} 次`);
for (const c of hardColors.slice(0, 12)) out.push(`  ${c.file}:${c.line} ${c.hex}  ${c.selector}`);
if (hardColors.length > 12) out.push(`  …… 另有 ${hardColors.length - 12} 处`);
out.push("");
out.push(`【emoji】${emojis.length} 个`);
for (const e of emojis) out.push(`  ${e.file}:${e.line} ${e.char}  ${e.context}`);
out.push(`【符号】${symbols.length} 个（箭头等，需人判断是否改成图标）`);
for (const s of symbols.slice(0, 10)) out.push(`  ${s.file}:${s.line} ${s.char}  ${s.context}`);
if (symbols.length > 10) out.push(`  …… 另有 ${symbols.length - 10} 个`);
out.push("");
out.push("—— 改完再跑一次，比这两组数字。清单与判断标准见 DESIGN.md。");
console.log(out.join("\n"));

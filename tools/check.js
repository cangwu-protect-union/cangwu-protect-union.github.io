#!/usr/bin/env node
/* ============================================================
   tools/check.js —— 项目自检，零依赖，只用 node 内置模块
   ------------------------------------------------------------
   用法：node tools/check.js [--staged]
         --staged  额外检查暂存区里有没有 _local/、*.sql 等不该提交的东西

   检查项：
     编码    UTF-8 无 BOM、LF 换行、不是非法 UTF-8
     脚本    JS 能否被解析（不执行）
     页面    HTML 标签栈配平、重复 id、本地引用是否存在、charset/lang
     样式    CSS 大括号配平、url() 本地引用是否存在
     密钥    service_role、secret key、密码、带密码的连接串（publishableKey 放行）
     仓库    已跟踪文件里不该出现的路径

   退出码：0 全过，1 有问题。输出格式 路径:行: 代码: 说明
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const DEFAULT_ROOT = path.resolve(__dirname, "..");
const ARG_ROOT = process.argv.slice(2).find((a) => !a.startsWith("-"));
const ROOT = ARG_ROOT ? path.resolve(ARG_ROOT) : DEFAULT_ROOT;
const SKIP_DIRS = new Set([".git", "node_modules", ".pnpm-store", "_local", "lib", "preview", ".dsh", ".vscode"]);
const TEXT_EXT = new Set([".html", ".htm", ".js", ".css", ".json", ".md", ".yml", ".yaml", ".toml", ".txt"]);
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr", "param"]);

const problems = [];
function bad(file, line, code, msg) {
  problems.push({ file: path.relative(ROOT, file).replace(/\\/g, "/"), line, code, msg });
}

function walk(dir, out) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (name.isDirectory()) {
      if (SKIP_DIRS.has(name.name) || name.name.startsWith(".")) continue;
      walk(path.join(dir, name.name), out);
    } else if (TEXT_EXT.has(path.extname(name.name).toLowerCase())) {
      out.push(path.join(dir, name.name));
    }
  }
  return out;
}

/* ---------- 编码 ---------- */
function checkEncoding(file, buf) {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) bad(file, 1, "encoding", "文件带 UTF-8 BOM");
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    bad(file, 1, "encoding", "不是合法的 UTF-8");
    return null;
  }
  const crlf = text.indexOf("\r\n");
  if (crlf >= 0) bad(file, text.slice(0, crlf).split("\n").length, "encoding", "有 CRLF 换行，项目要求 LF");
  else if (text.indexOf("\r") >= 0) bad(file, text.slice(0, text.indexOf("\r")).split("\n").length, "encoding", "有单独的 CR 字符");
  return text;
}

/* ---------- JS ---------- */
function checkJs(file, text) {
  try {
    new Function(text.replace(/^#![^\n]*\n/, ""));
  } catch (e) {
    const m = /^(\d+)/.exec(e.message);
    bad(file, m ? Number(m[1]) : 1, "js", "语法错误：" + e.message.replace(/\s*\(.*?\)\s*$/, ""));
  }
}

/* ---------- HTML ---------- */
function checkHtml(file, text) {
  const stripped = text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "<$1></$1>");

  if (!/<meta[^>]+charset\s*=\s*["']?utf-8/i.test(stripped)) bad(file, 1, "html", "缺少 <meta charset=\"utf-8\">");
  if (!/<html[^>]*\slang\s*=/i.test(stripped)) bad(file, 1, "html", "<html> 缺少 lang 属性");

  const stack = [];
  const tagRe = /<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
  let m;
  while ((m = tagRe.exec(stripped))) {
    const [, close, rawName, , selfClose] = m;
    const name = rawName.toLowerCase();
    if (VOID.has(name) || selfClose) continue;
    const line = stripped.slice(0, m.index).split("\n").length;
    if (!close) {
      stack.push({ name, line });
    } else {
      const top = stack.pop();
      if (!top) bad(file, line, "html", `多余的结束标签 </${name}>`);
      else if (top.name !== name) bad(file, line, "html", `标签未配平：<${top.name}>（第 ${top.line} 行）被 </${name}> 关闭`);
    }
  }
  for (const rest of stack) bad(file, rest.line, "html", `标签未闭合 <${rest.name}>`);

  const ids = new Map();
  const idRe = /\sid\s*=\s*"([^"]+)"/g;
  while ((m = idRe.exec(stripped))) {
    const line = stripped.slice(0, m.index).split("\n").length;
    if (ids.has(m[1])) bad(file, line, "html", `重复 id "${m[1]}"，首次出现于第 ${ids.get(m[1])} 行`);
    else ids.set(m[1], line);
  }

  checkLocalRefs(file, stripped, /\s(?:href|src)\s*=\s*"([^"]+)"/g);
}

/* ---------- CSS ---------- */
function checkCss(file, text) {
  let depth = 0;
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, "");
  for (let i = 0; i < clean.length; i++) {
    if (clean[i] === "{") depth++;
    else if (clean[i] === "}") {
      depth--;
      if (depth < 0) {
        bad(file, clean.slice(0, i).split("\n").length, "css", "多余的 }");
        depth = 0;
      }
    }
  }
  if (depth > 0) bad(file, clean.split("\n").length, "css", `有 ${depth} 个 { 未闭合`);
  checkLocalRefs(file, clean, /url\(\s*["']?([^"')]+)["']?\s*\)/g);
}

/* ---------- 本地引用 ---------- */
function checkLocalRefs(file, text, re) {
  let m;
  while ((m = re.exec(text))) {
    const ref = m[1].trim();
    if (!ref || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref)) continue;
    const line = text.slice(0, m.index).split("\n").length;
    let target = ref.split("#")[0].split("?")[0];
    try { target = decodeURIComponent(target); } catch { /* 保持原样 */ }
    if (!target) continue;
    const abs = target.startsWith("/") ? path.join(ROOT, target.slice(1)) : path.resolve(path.dirname(file), target);
    const ok = fs.existsSync(abs) || (target.endsWith("/") && fs.existsSync(path.join(abs, "index.html")));
    if (!ok) bad(file, line, "ref", `引用的本地文件不存在：${ref}`);
  }
}

/* ---------- 密钥 ---------- */
const SECRET_RULES = [
  [/service_role/, "service_role 只能留在 _local/，不能出现在公开文件里"],
  [/sb_secret_[A-Za-z0-9_-]{8,}/, "出现 Supabase secret key"],
  [/postgres(?:ql)?:\/\/[^\s"'@/]+:[^\s"'@/]+@/, "出现带密码的数据库连接串"],
  [/(?:^|[^A-Za-z])(?:api[_-]?key|secret[_-]?key|password|passwd)\s*[:=]\s*["'][^"'\s]{8,}["']/i, "疑似硬编码凭据"],
  [/-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----/, "出现私钥"],
  [/\bAKIA[0-9A-Z]{16}\b/, "出现 AWS access key"],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}\b/, "出现 GitHub 令牌"],
  [/\bglpat-[A-Za-z0-9_-]{20,}\b/, "出现 GitLab 令牌"],
];

function checkSecrets(file, text, codeOnly) {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (codeOnly) {
      for (const [re, msg] of SECRET_RULES) {
        if (re.test(line)) bad(file, i + 1, "secret", msg);
      }
    }
    if (/publishableKey/.test(line)) continue;
    const jwt = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\./.exec(line);
    if (jwt) {
      let role = "未知";
      try {
        const payload = Buffer.from(jwt[0].split(".")[1], "base64url").toString("utf8");
        role = JSON.parse(payload).role || "未知";
      } catch { /* 解析不了就按未知处理 */ }
      if (role !== "anon") bad(file, i + 1, "secret", `出现非匿名 JWT（role=${role}）`);
    }
  }
}

/* ---------- 仓库卫生 ---------- */
function git(args) {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 24 });
  } catch {
    return null;
  }
}

function checkRepoTracked() {
  const out = git(["ls-files", "-z"]);
  if (out === null) return;
  for (const p of out.split("\0")) {
    if (!p) continue;
    const full = path.join(ROOT, p);
    if (/^(?:_local|node_modules|\.pnpm-store)\//.test(p) || /\.(?:sql|docx|xlsx|zip|7z|log)$/i.test(p)) {
      bad(full, 1, "repo", "这类文件不该被 git 跟踪，检查 .gitignore");
    }
  }
}

function checkStaged() {
  const out = git(["diff", "--cached", "--name-only", "-z"]);
  if (out === null) return;
  let n = 0;
  for (const p of out.split("\0")) {
    if (!p) continue;
    if (/^_local\//.test(p) || /\.(?:sql|docx|xlsx|zip|7z)$/i.test(p) || /^\.pnpm-store\//.test(p)) {
      bad(path.join(ROOT, p), 1, "staged", "已暂存，但不该提交");
      n++;
    }
  }
  if (n === 0) console.log("暂存区干净");
}

/* ---------- 主流程 ---------- */
const files = walk(ROOT, []).sort();
const SELF = path.join(ROOT, "tools", "check.js");
const CODE = new Set([".js", ".html", ".htm", ".json", ".css"]);
let js = 0, html = 0, css = 0;

for (const file of files) {
  const text = checkEncoding(file, fs.readFileSync(file));
  if (text === null) continue;
  const ext = path.extname(file).toLowerCase();
  if (ext === ".js") { js++; checkJs(file, text); }
  else if (ext === ".html" || ext === ".htm") { html++; checkHtml(file, text); }
  else if (ext === ".css") { css++; checkCss(file, text); }
  // 本文件里的规则字符串本身就是字面量，跳过自查
  if (path.resolve(file) !== SELF) checkSecrets(file, text, CODE.has(ext));
}

checkRepoTracked();
if (process.argv.includes("--staged")) checkStaged();

console.log(`扫描 ${files.length} 个文件：${js} 个 JS、${html} 个 HTML、${css} 个 CSS`);

if (problems.length === 0) {
  console.log("全部通过");
  process.exit(0);
}

problems.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
for (const p of problems) console.log(`  ${p.file}:${p.line}: ${p.code}: ${p.msg}`);
console.log(`共 ${problems.length} 个问题`);
process.exit(1);

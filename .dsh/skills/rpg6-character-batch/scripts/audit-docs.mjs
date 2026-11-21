/* 文档计数审计：角色/技能数一律以 _local/tools/rpg6-stats.js 的标记区间为准。
   技能库里没有手写数字，所以这里不再逐条正则匹配，而是复用 rpg6-stats 的
   computeStats / renderDocument：磁盘内容与现算结果逐字相同才算通过。 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { coverage, findRoot, hasFlag, loadLibrary, loadSeed } from "./lib.mjs";

const argv = process.argv.slice(2);
const root = findRoot(argv);
const { counts } = coverage(loadSeed(root), await loadLibrary(root));
const expected = { characters: counts.libraryCharacters, skills: counts.librarySkills };

const statsFile = path.join(root, "_local", "tools", "rpg6-stats.js");
if (!fs.existsSync(statsFile)) {
  console.log("SKIP 没有 _local/tools/rpg6-stats.js（本地工具不入库），跳过文档计数审计");
  process.exit(0);
}

const require = createRequire(import.meta.url);
const tool = require(statsFile);
const stats = await tool.computeStats();

const drift = [];
if (stats.characters !== expected.characters || stats.skills !== expected.skills) {
  drift.push("rpg6-stats 与技能库不一致：统计 " + stats.characters + "/" + stats.skills +
    "，技能库 " + expected.characters + "/" + expected.skills);
}

const results = [];
for (const doc of tool.DOCS) {
  const rel = path.relative(root, doc.file).replace(/\\/g, "/");
  if (!fs.existsSync(doc.file)) {
    results.push({ rel, status: doc.optional ? "skip" : "missing", detail: "文件不存在" });
    continue;
  }
  const before = fs.readFileSync(doc.file, "utf8");
  const result = tool.renderDocument(before, stats, rel);
  if (result.errors.length) {
    results.push({ rel, status: "bad", detail: result.errors.join("；") });
    continue;
  }
  if (!result.regions) {
    results.push({ rel, status: doc.optional ? "skip" : "bad", detail: "没有 RPG6-STATS 区间" });
    continue;
  }
  if (result.text !== before) {
    const diff = firstDiffLine(before, result.text);
    results.push({
      rel,
      status: "bad",
      detail: (diff ? "第 " + diff.line + " 行" : "内容不同") +
        "，磁盘：" + (diff ? diff.got : "") + "，应为：" + (diff ? diff.want : "")
    });
    continue;
  }
  results.push({ rel, status: "ok", detail: result.regions + " 个区间" });
}

const bad = results.filter((r) => r.status === "bad" || r.status === "missing");
if (hasFlag(argv, "--json")) {
  console.log(JSON.stringify({ expected, stats: { characters: stats.characters, skills: stats.skills, version: stats.version }, drift, results }, null, 2));
  process.exit(bad.length || drift.length ? 1 : 0);
}

console.log("文档计数：技能库 " + expected.characters + " 名角色 / " + expected.skills + " 条技能 · 引擎 " + stats.version);
for (const line of drift) console.log("✗ " + line);
for (const result of results) {
  const mark = result.status === "ok" ? "✓" : result.status === "skip" ? "-" : "✗";
  console.log(mark + " " + result.rel + "：" + result.detail);
}
if (bad.length || drift.length) {
  console.error("\n计数漂移 " + (bad.length + drift.length) + " 处；先跑 node _local/tools/rpg6-stats.js --write，再跑 check.ps1");
  process.exit(1);
}
console.log("\n文档计数一致");

function firstDiffLine(a, b) {
  const left = a.split("\n");
  const right = b.split("\n");
  const n = Math.max(left.length, right.length);
  for (let i = 0; i < n; i++) {
    if (left[i] !== right[i]) {
      return {
        line: i + 1,
        got: (left[i] == null ? "" : left[i]).trim(),
        want: (right[i] == null ? "" : right[i]).trim()
      };
    }
  }
  return null;
}

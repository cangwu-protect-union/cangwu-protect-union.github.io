/* tools/rpg6-bump.mjs —— 升引擎版本：version.js 与 data/config.js 一起改，顺手写回文档里的版本号。
   用法：node tools/rpg6-bump.mjs 6.0-engine.12 [--dry]
   两处必须逐字一致（rpg6-lint 与 check.ps1 -Staged 都会比对）；本脚本只改版本号，不碰结算逻辑。 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const version = args.find((a) => !a.startsWith("--")) || "";
const dry = args.includes("--dry");

if (!/^\d+\.\d+-engine\.\d+$/.test(version)) {
  console.error("用法：node tools/rpg6-bump.mjs 6.0-engine.12 [--dry]");
  process.exit(2);
}

const targets = [
  { file: path.join(root, "rpg6.0", "js", "engine", "version.js"), re: /(ENGINE_VERSION\s*=\s*")[^"]+(")/ },
  { file: path.join(root, "rpg6.0", "data", "config.js"), re: /(engineVersion:\s*")[^"]+(")/ }
];

const seen = [];
for (const target of targets) {
  const rel = path.relative(root, target.file).replace(/\\/g, "/");
  if (!fs.existsSync(target.file)) {
    console.error("找不到 " + rel);
    process.exit(1);
  }
  const before = fs.readFileSync(target.file, "utf8");
  const match = before.match(target.re);
  if (!match) {
    console.error(rel + " 里找不到版本号，脚本要跟着格式改");
    process.exit(1);
  }
  const current = match[0].slice(match[1].length, match[0].length - match[2].length);
  seen.push({ rel, current });
  const after = before.replace(target.re, "$1" + version + "$2");
  if (dry) {
    console.log(rel + "：" + current + " -> " + version + "（--dry，不写盘）");
    continue;
  }
  if (after === before) {
    console.log(rel + "：已经是 " + version);
    continue;
  }
  fs.writeFileSync(target.file, after, "utf8");
  console.log(rel + "：" + current + " -> " + version);
}

if (dry) process.exit(0);

const versions = new Set(seen.map((item) => item.current));
if (versions.size > 1) console.warn("WARN 改之前两处版本号就不一致：" + seen.map((item) => item.rel + "=" + item.current).join("，"));

const statsFile = path.join(root, "_local", "tools", "rpg6-stats.js");
if (!fs.existsSync(statsFile)) {
  console.log("SKIP 没有 _local/tools/rpg6-stats.js，文档里的版本号未写回");
  process.exit(0);
}
const tool = createRequire(import.meta.url)(statsFile);
const stats = await tool.computeStats();
let changed = 0;
for (const doc of tool.DOCS) {
  if (!fs.existsSync(doc.file)) continue;
  const before = fs.readFileSync(doc.file, "utf8");
  const result = tool.renderDocument(before, stats, doc.file);
  if (result.errors.length) {
    console.error("文档区间有问题（" + doc.file + "）：" + result.errors.join("；"));
    process.exit(1);
  }
  if (result.text === before) continue;
  fs.writeFileSync(doc.file, result.text, "utf8");
  changed += 1;
  console.log("写回版本号 " + path.relative(root, doc.file).replace(/\\/g, "/"));
}
console.log("引擎 " + stats.version + "；文档写了 " + changed + " 个文件。改规则要同步 version.js 的注释与 rpg6-battle 的踩坑记录。");

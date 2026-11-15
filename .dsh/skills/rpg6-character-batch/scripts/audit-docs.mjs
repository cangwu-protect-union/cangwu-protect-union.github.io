import fs from "node:fs";
import path from "node:path";
import { coverage, findRoot, hasFlag, loadLibrary, loadSeed } from "./lib.mjs";

const argv = process.argv.slice(2);
const root = findRoot(argv);
const { counts } = coverage(loadSeed(root), loadLibrary(root));
const expectedChars = counts.libraryCharacters;
const expectedSkills = counts.librarySkills;

const checks = [
  {
    file: "rpg6.0/test.html",
    re: /技能库目前覆盖\s*(\d+)\s*名角色/g,
    labels: ["test.html 提示"]
  },
  {
    file: "rpg6.0/游戏说明.md",
    re: /现状：.*?(\d+)\s*名角色\s*\/\s*(\d+)\s*条技能/g,
    labels: ["游戏说明 · 现状"]
  },
  {
    file: "rpg6.0/游戏说明.md",
    re: /现有\s*(\d+)\s*人\s*(\d+)\s*条技能/g,
    labels: ["游戏说明 · 现有"]
  },
  {
    file: "rpg6.0/架构.md",
    re: /(\d+)\s*名角色\s*(\d+)\s*条技能/g,
    labels: ["架构 · battle-skills"]
  },
  {
    file: ".dsh/skills/rpg6-battle/SKILL.md",
    re: /当前\s*(\d+)\s*人\s*\/\s*(\d+)\s*条技能/g,
    labels: ["rpg6-battle skill"]
  }
];

const optional = [
  {
    file: "_local/docs/回合制6.0测试功能-角色机制.md",
    re: /前四批共\s*(\d+)\s*人\s*\/\s*(\d+)\s*条技能/g,
    labels: ["机制文档 · 范围"]
  }
];

const results = [];
for (const item of checks) results.push(check(item, false));
for (const item of optional) results.push(check(item, true));

const bad = results.filter((r) => r.status === "bad" || r.status === "missing");
if (hasFlag(argv, "--json")) {
  console.log(JSON.stringify({ expected: { characters: expectedChars, skills: expectedSkills }, results }, null, 2));
  process.exit(bad.length ? 1 : 0);
}

console.log("文档计数：期望 " + expectedChars + " 名角色 / " + expectedSkills + " 条技能");
for (const result of results) {
  const mark = result.status === "ok" ? "✓" : result.status === "skip" ? "-" : "✗";
  console.log(mark + " " + result.label + (result.detail ? "：" + result.detail : ""));
}
if (bad.length) {
  console.error("\n计数漂移 " + bad.length + " 处；先同步文档，再跑 check.ps1");
  process.exit(1);
}
console.log("\n文档计数一致");

function check(item, optionalFile) {
  const file = path.join(root, item.file);
  if (!fs.existsSync(file)) {
    return { label: item.labels[0], status: optionalFile ? "skip" : "missing", detail: "文件不存在" };
  }
  const text = fs.readFileSync(file, "utf8");
  const found = [...text.matchAll(item.re)];
  if (!found.length) {
    return { label: item.labels[0], status: optionalFile ? "skip" : "missing", detail: "没匹配到计数" };
  }
  const values = found.map((m) => m.slice(1).filter(Boolean).map(Number));
  const expected = values[0].length === 1 ? [expectedChars] : [expectedChars, expectedSkills];
  const actual = values[0];
  const ok = actual.length === expected.length && actual.every((v, i) => v === expected[i]);
  return {
    label: item.labels[0],
    status: ok ? "ok" : "bad",
    detail: ok ? "" : actual.join("/") + "（应为 " + expected.join("/") + "）"
  };
}

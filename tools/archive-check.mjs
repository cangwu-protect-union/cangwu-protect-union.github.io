#!/usr/bin/env node
/* 归档前盘点：这一轮改了什么、哪些 skill 该更新、哪些改动不该混进提交、该跑哪些校验。
   只读，不写仓库（除非给 --out）。

   用法：
     node tools/archive-check.mjs --since=af6aab8
     node tools/archive-check.mjs --since=af6aab8 --out=_local/docs/交接.md
*/
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    since: { type: "string", default: "" },
    out: { type: "string", default: "" },
    title: { type: "string", default: "会话交接" }
  }
});

const root = process.cwd();

function git(...args) {
  try {
    return execFileSync("git", ["-c", "core.quotepath=false"].concat(args), {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024
    }).trimEnd();
  } catch {
    return "";
  }
}

function lines(text) {
  return text ? text.split("\n").filter(Boolean) : [];
}

function unique(list) {
  return Array.from(new Set(list));
}

/* 路径 → 该维护的 skill / 分类。顺序敏感，先生成物与 skill 本体，再具体模块。 */
const AREAS = [
  { skill: "—", label: "生成物", generated: true, match: /(^rpg6\.0\/preview\/|^guitu\/.*\.png$|^quyu\/.*\.png$|\.png$)/ },
  { skill: "—", label: "skill 本体", generated: true, match: /^\.dsh\/skills\// },
  { skill: "rpg6-strategy-lab", match: /^rpg6\.0\/(strategy-lab\/|lab\.html|css\/lab\.css|js\/lab\/|data\/lab-snapshot)/, label: "策略实验室" },
  { skill: "rpg6-battle", match: /^rpg6\.0\/(js\/engine\/|js\/battle\/|data\/battle-skills|test\.html)/, label: "战斗引擎" },
  { skill: "rpg6-character-batch", match: /^rpg6\.0\/data\/characters\.js|^_local\/docs\/回合制6\.0/, label: "角色批次" },
  { skill: "cloudbase-pg", match: /^_local\/sql\//, label: "数据库" },
  { skill: "site-e2e-tests", match: /^_local\/tests\//, label: "端到端测试" },
  { skill: "guitu-deploy", match: /^\.github\/|^tools\/check\.ps1$/, label: "发布" },
  { skill: "—", label: "工具与文档", generated: true, match: /^(tools\/|AGENTS\.md$|README\.md$|改动索引\.md$|\.gitignore$|_local\/tools\/|rpg6\.0\/data\/config\.js$)/ },
  { skill: "site-project", match: /^(guitu\/|quyu\/|suggest\/|js\/|css\/|index\.html|about\.html|projects\.html)/, label: "站点与模块" }
];

function areaOf(file) {
  for (const area of AREAS) if (area.match.test(file)) return area;
  return { skill: "—", label: "其他", generated: true };
}

function shortList(list, limit) {
  if (list.length <= limit) return list;
  return list.slice(0, limit).concat(["… 另有 " + (list.length - limit) + " 个"]);
}

const since = values.since || git("rev-list", "--max-count=1", "--skip=9", "HEAD");
const range = since ? since + "..HEAD" : "HEAD~10..HEAD";
const commits = lines(git("log", "--oneline", range));

const committed = lines(git("diff", "--name-only", range));
const staged = lines(git("diff", "--cached", "--name-only"));
const unstaged = lines(git("diff", "--name-only"));
const untracked = lines(git("ls-files", "--others", "--exclude-standard"));
const working = unique(staged.concat(unstaged, untracked));

const committedSet = new Set(committed);
const touchedAfterCommit = working.filter((file) => committedSet.has(file));
const foreign = working.filter((file) => !committedSet.has(file));

const skillFiles = lines(git("ls-files", ".dsh/skills"));
const changedSkillNames = new Set(
  skillFiles.filter((file) => committedSet.has(file)).map((file) => file.split("/")[2] || "")
);

const byArea = new Map();
for (const file of committed) {
  const area = areaOf(file);
  if (area.generated) continue;
  if (!byArea.has(area.skill)) byArea.set(area.skill, { label: area.label, files: [] });
  byArea.get(area.skill).files.push(file);
}

const missingSkills = Array.from(byArea.keys()).filter((skill) => skill.startsWith("rpg6") && !changedSkillNames.has(skill));
const newSkillFiles = skillFiles.filter((file) => committedSet.has(file) && !git("log", "--oneline", "--max-count=1", since || "HEAD~10", "--", file));

const risky = [];
for (const file of staged) {
  if (/^_local\//.test(file)) risky.push("staged 里有 _local 文件：" + file);
  if (/\.(sql|docx|zip)$/i.test(file)) risky.push("staged 里有迁移脚本或二进制：" + file);
}

const out = [];
out.push("# " + values.title);
out.push("");
out.push("生成时间：" + new Date().toISOString().slice(0, 16).replace("T", " ") + " · 范围 `" + range + "`");
out.push("");
out.push("## 一、本轮的提交");
out.push("");
if (commits.length) for (const line of commits) out.push("- " + line);
else out.push("- （范围里没有提交，检查 --since）");
out.push("");
out.push("## 二、改到了哪些领域");
out.push("");
out.push("| 领域 | skill | 代表文件 | 本次提交里 skill 有更新 |");
out.push("|---|---|---|---|");
for (const [skill, info] of byArea) {
  out.push("| " + info.label + " | `" + skill + "` | " + shortList(info.files, 4).join("<br>") + " | "
    + (changedSkillNames.has(skill) ? "是" : "**否**") + " |");
}
if (!byArea.size) out.push("| — | — | 没有需要更新 skill 的改动 | — |");
out.push("");
if (newSkillFiles.length) {
  out.push("新增或改写的 skill：" + newSkillFiles.map((file) => "`" + file.split("/")[2] + "`").join("、"));
  out.push("");
}
if (missingSkills.length) {
  out.push("**要补的 skill 说明**：" + missingSkills.map((name) => "`" + name + "`").join("、"));
  out.push("");
}
out.push("## 三、工作区");
out.push("");
out.push("- 提交后又改过：" + (touchedAfterCommit.length ? touchedAfterCommit.length + " 个" : "无"));
out.push("- 未提交（staged " + staged.length + " / unstaged " + unstaged.length + " / untracked " + untracked.length + "）");
if (foreign.length) {
  out.push("");
  out.push("**不属于本轮改动的文件**（别混进提交，或单独说明）：");
  for (const file of shortList(foreign, 20)) out.push("- " + file);
}
out.push("");
out.push("## 四、提交前要看的");
out.push("");
if (risky.length) for (const item of risky) out.push("- " + item);
else out.push("- 没有 _local、SQL、docx 被 staged。");
out.push("- `git status --short` 与 `git diff --cached --stat` 各过一遍。");
out.push("");
out.push("## 五、校验命令");
out.push("");
out.push("```");
out.push("node _local/tools/build-docs.js");
out.push("powershell -NoProfile -ExecutionPolicy Bypass -File tools\\check.ps1");
for (const skill of byArea.keys()) {
  if (skill === "rpg6-strategy-lab") out.push("node rpg6.0/strategy-lab/selftest.mjs");
  if (skill === "rpg6-battle") out.push("node _local/tests/engine/run.mjs");
  if (skill === "site-e2e-tests") out.push("node _local/tests/run-all.mjs --group=回合制");
}
out.push("```");
out.push("");
out.push("## 六、交接正文（手工补）");
out.push("");
out.push("- 现在能跑到哪一步：");
out.push("- 这一轮的判断与取舍：");
out.push("- 没做完 / 卡在哪：");
out.push("- 下一轮先做什么：");
out.push("- 复现命令：");

const text = out.join("\n") + "\n";
if (values.out) {
  const file = path.resolve(root, values.out);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, "utf8");
  console.log("已写入 " + path.relative(root, file));
} else {
  process.stdout.write(text);
}

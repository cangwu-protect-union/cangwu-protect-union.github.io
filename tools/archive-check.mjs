#!/usr/bin/env node
/* 归档前盘点：这一轮改了什么、哪些 skill 该更新、哪些改动不该混进提交、
   哪些是待清理的过程产物、该跑哪些校验。只读，不写仓库（除非给 --out）。

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

/* git 不可用时必须立刻报错退出：否则每一项都拿到空字符串，
   输出成一份「本轮没有提交、没有改动」的空白交接，比不跑更坏。
   DSH 文件沙箱里 node 派生不了子进程（EPERM），这个脚本要在普通终端或 full-access 下跑。 */
if (!git("rev-parse", "--is-inside-work-tree")) {
  console.error("git 不可用：无法盘点本轮改动。请在普通终端（或 DSH full-access）下运行本脚本。");
  process.exit(2);
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
  { skill: "rpg6-battle", match: /^rpg6\.0\/(js\/engine\/|js\/battle\/|data\/skills|test\.html)/, label: "战斗引擎" },
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

/* 待清理候选：会话只留交付物，其余过程产物要删。已提交的也在清理范围内，
   但删之前要先 grep 引用，并单独一笔提交说明删了什么。 */
const PROC_EXT = /\.(tmp|temp|bak\d*|log|orig|rej|swp|swo|pid|dmp)$/i;
const PROC_ASCII = /(^|\/)(\$[^/]*|tmp|temp\d*|draft\d*|old\d*|backup|copy|scratch|untitled|test-\d+|try|debug)([.\-/]|$)/i;
const PROC_CN = /草稿|备份|副本|未命名|临时|调试|旧/;

function procReason(file) {
  if (PROC_EXT.test(file)) return "临时或日志扩展名";
  if (PROC_ASCII.test(file)) return "文件名像草稿、备份或一次性脚本";
  if (PROC_CN.test(file)) return "文件名带草稿、旧版本一类字样";
  return "";
}

const base = since || git("rev-list", "--max-count=1", "--skip=9", "HEAD");
const baseTs = Number(git("log", "-1", "--format=%ct", base) || 0) * 1000;

function mtime(file) {
  try {
    return fs.statSync(path.resolve(root, file)).mtimeMs;
  } catch {
    return 0;
  }
}

const candidates = [];
for (const file of committed) {
  if (!fs.existsSync(path.resolve(root, file))) continue;
  const reason = procReason(file);
  if (reason) candidates.push({ file, kind: "已提交", why: reason });
}
for (const file of untracked) {
  const fresh = mtime(file) >= baseTs;
  const reason = procReason(file);
  if (fresh || reason) {
    candidates.push({ file, kind: fresh ? "未跟踪·本会话" : "未跟踪·更早", why: reason || "未进仓库的新文件" });
  }
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
out.push("## 四、待清理候选");
out.push("");
out.push("归档只留交付物，过程产物删掉。逐条确认引用后手删。");
out.push("");
if (candidates.length) {
  out.push("| 文件 | 类别 | 依据 |");
  out.push("|---|---|---|");
  for (const item of candidates.slice(0, 40)) out.push("| " + item.file + " | " + item.kind + " | " + item.why + " |");
  if (candidates.length > 40) out.push("| … 另有 " + (candidates.length - 40) + " 个 | | |");
} else {
  out.push("- 没有待清理候选。");
}
out.push("");
out.push("- `_local/` 被 gitignore，不在此列；交接正文与 SQL 迁移要留。");
out.push("- 已提交的那几项：先 `git grep -n \"<文件名>\"` 确认无引用，再单独一笔提交说明删了什么、为什么。");
out.push("");
out.push("## 五、提交前要看的");
out.push("");
if (risky.length) for (const item of risky) out.push("- " + item);
else out.push("- 没有 _local、SQL、docx 被 staged。");
out.push("- `git status --short` 与 `git diff --cached --stat` 各过一遍。");
out.push("");
out.push("## 六、校验命令");
out.push("");
out.push("```");
out.push("powershell -NoProfile -ExecutionPolicy Bypass -File tools\\check.ps1");
for (const skill of byArea.keys()) {
  if (skill === "rpg6-battle") out.push("node tests/engine/run.mjs");
  if (skill === "site-e2e-tests") out.push("node _local/tests/run-all.mjs --group=回合制");
}
out.push("```");
out.push("");
out.push("## 七、交接正文（手工补）");
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

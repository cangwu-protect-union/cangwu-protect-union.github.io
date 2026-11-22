import fs from "node:fs";
import path from "node:path";
import {
  argValue,
  coverage,
  findRoot,
  hasFlag,
  loadLibrary,
  loadSeed,
  printCounts,
  printTriage,
  statusMark,
  triageRows
} from "./lib.mjs";

const argv = process.argv.slice(2);
const root = findRoot(argv);
const { rows, counts, extraLibrary } = coverage(loadSeed(root), await loadLibrary(root));

if (hasFlag(argv, "--json")) {
  console.log(JSON.stringify({ counts, characters: rows, extraLibrary }, null, 2));
  process.exit(0);
}

if (!hasFlag(argv, "--plan")) {
  printCounts(counts);
  if (extraLibrary.length) {
    console.log("\n库里有、seed 里没有的 id（校验器会警告）：");
    for (const item of extraLibrary) console.log("  - " + item.owner + " · " + item.name + " (" + item.id + ")");
  }
}

const only = argValue(argv, "--character");

/* --plan：按 seed 生成 plan 草稿，技能名、条件、面板、id 占位都已抄好，
   只剩 status/ops/tests/notes 要改成真正的裁定。条件不再手抄，抄错就会被校验器拦。 */
if (hasFlag(argv, "--plan")) {
  if (!only) {
    console.error("--plan 需要 --character <角色名>");
    process.exit(2);
  }
  const row = rows.find((r) => r.name === only);
  if (!row) {
    console.error("seed 里没有角色：" + only);
    process.exit(1);
  }
  const fixture = argValue(argv, "--fixture");
  if (!/^[a-z][a-z0-9_-]*$/.test(fixture)) {
    console.error("--plan 需要 --fixture（小写字母开头的技能文件名）：--fixture " + (fixture || "<拼音>"));
    process.exit(2);
  }
  const configText = fs.readFileSync(path.join(root, "rpg6.0/data/config.js"), "utf8");
  const engineVersion = (configText.match(/engineVersion:\s*"([^"]+)"/) || [])[1] || "";
  const draft = {
    batch: "TODO 写这一批的说明",
    allowExisting: row.inLibrary,
    engine: { version: engineVersion, changes: [] },
    characters: [
      {
        name: row.name,
        fixture,
        gender: row.gender,
        occupation: row.occupation,
        sideJob: row.sideJob || "",
        stats: row.stats,
        skills: row.skills.map((skill, index) => ({
          name: skill.name,
          condition: skill.condition,
          id: fixture + ".skill" + (index + 1),
          target: "enemy",
          cost: { mp: 0 },
          charge: 0,
          cooldown: 0,
          status: "unsupported",
          unsupported: "待确认：照档案写 ops，再改 status",
          ops: [],
          tests: [],
          notes: ""
        }))
      }
    ],
    marks: {},
    summons: {}
  };
  const text = JSON.stringify(draft, null, 2) + "\n";
  const out = argValue(argv, "--out");
  if (out) {
    fs.writeFileSync(path.resolve(out), text, "utf8");
    console.log("plan 草稿写到 " + path.resolve(out) + "（" + row.skills.length + " 条技能；改 id、status、ops、notes）");
  } else {
    console.log(text);
  }
  process.exit(0);
}

if (only) {
  const row = rows.find((r) => r.name === only);
  if (!row) {
    console.error("seed 里没有角色：" + only);
    process.exit(1);
  }
  printCharacter(row);
  process.exit(0);
}

const all = hasFlag(argv, "--all");
if (hasFlag(argv, "--triage")) {
  printTriage(triageRows(rows, all));
  process.exit(0);
}
const list = all ? rows : rows.filter((r) => !r.inLibrary);
console.log("\n" + (all ? "全部角色" : "剩余角色") + "：" + list.length);
for (const row of list) printCharacter(row, all);

function printCharacter(row, compact) {
  console.log(
    "\n" + row.name + "（" + (row.gender || "?") + " / " + (row.occupation || "?") +
    (row.sideJob ? "/" + row.sideJob : "") + "） " +
    row.skills.length + " 技能 · 已接入 " + row.implemented +
    " · unsupported " + row.unsupported + " · 条件不一致 " + row.mismatch +
    " · 未加 " + row.missing
  );
  for (const skill of row.skills) {
    const detail = compact || skill.status !== "implemented"
      ? "（" + skill.condition + "） " + statusMark(skill.status)
      : "";
    console.log("  - " + skill.name + detail);
    if (skill.status === "unsupported" && skill.unsupported) {
      console.log("      原因：" + skill.unsupported);
    }
  }
}

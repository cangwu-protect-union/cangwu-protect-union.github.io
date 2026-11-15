import {
  argValue,
  coverage,
  findRoot,
  hasFlag,
  loadLibrary,
  loadSeed,
  printCounts,
  statusMark
} from "./lib.mjs";

const argv = process.argv.slice(2);
const root = findRoot(argv);
const { rows, counts, extraLibrary } = coverage(loadSeed(root), loadLibrary(root));

if (hasFlag(argv, "--json")) {
  console.log(JSON.stringify({ counts, characters: rows, extraLibrary }, null, 2));
  process.exit(0);
}

printCounts(counts);
if (extraLibrary.length) {
  console.log("\n库里有、seed 里没有的 id（校验器会警告）：");
  for (const item of extraLibrary) console.log("  - " + item.owner + " · " + item.name + " (" + item.id + ")");
}

const only = argValue(argv, "--character");
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

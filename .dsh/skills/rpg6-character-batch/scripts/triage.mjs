import {
  argValue,
  coverage,
  findRoot,
  hasFlag,
  loadLibrary,
  loadSeed,
  statusMark
} from "./lib.mjs";

const GAPS = [
  ["shield", /护盾|破盾/],
  ["revive", /复活|不死|免死|血降至0|血降到0/],
  ["rewind", /记录.*状态|回到此状态|状态快照|反方向的钟/],
  ["extraAction", /额外行动|不消耗回合/],
  ["noBasic", /无法普攻|不能普攻|锁死对方普攻|无法使用普攻|无法普攻\/蓄力/],
  ["noAction", /无法行动/],
  ["breakImmune", /不被击溃|无法被击溃|击溃值锁定|不受击溃/],
  ["stunImmune", /不被眩晕|免疫眩晕|无法被眩晕/],
  ["debuffImmune", /免疫异常|不会脆弱|不会恐慌|免疫.*异常/],
  ["magicVuln", /受到法伤\s*[×xX*]\s*2|法伤.*翻倍|法伤.*×2/],
  ["dynamicStat", /血量上限\/现有血量|受攻击者当前血|失去的血量|视.*血|攻击\/防御.*变为/],
  ["perTurnChoice", /每回合可选择|可选择吃|对方说|猜中|猜.*则/],
  ["externalChallenge", /10秒|说出|念出|口令|绕口令/],
  ["autoBasic", /每标回普攻|每回合普攻|自动普攻|每.*普攻1次/],
  ["debuffDecay", /每标准回合.*[-−]\d+%|每.*回合.*[-−]\d+%/],
  ["deathCount", /每死|死亡次数|死1次/],
  ["damageToMaxHp", /伤害转化|转化为血上限|血上限增加/],
  ["damageAmount", /以下伤害|本次伤害|伤害值/],
  ["reflectCharges", /反弹|反伤/],
  ["summonCount", /每有一个.*(?:伤害|召唤物|法伤)|每有1个.*(?:伤害|召唤物|法伤)|召唤物.*\+/],
  ["dataGap", /[？?]|□/]
];

const argv = process.argv.slice(2);
const root = findRoot(argv);
const { rows } = coverage(loadSeed(root), await loadLibrary(root));

const only = argValue(argv, "--character");
const all = hasFlag(argv, "--all");
const list = only
  ? rows.filter((r) => r.name === only)
  : rows.filter((r) => all || !r.inLibrary);

if (only && !list.length) {
  console.error("seed 里没有角色：" + only);
  process.exit(1);
}

const out = [];
for (const row of list) {
  const skills = [];
  for (const skill of row.skills) {
    const tags = [...new Set(GAPS.filter(([, re]) => re.test(skill.effect || "")).map(([tag]) => tag))];
    let verdict;
    if (skill.status !== "missing") verdict = statusMark(skill.status);
    else if (!tags.length) verdict = "likely existing DSL";
    else if (tags.every((t) => t === "dataGap")) verdict = "data gap";
    else verdict = "needs engine/data: " + tags.join(", ");
    skills.push({ ...skill, tags, verdict });
  }
  out.push({ name: row.name, occupation: row.occupation, sideJob: row.sideJob, skills });
}

if (hasFlag(argv, "--json")) {
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

console.log("缺口分诊（启发式，不是最终结论；逐条回到 DSL/引擎确认）");
for (const row of out) {
  const missing = row.skills.filter((s) => s.status === "missing").length;
  console.log("\n" + row.name + "（" + row.occupation + (row.sideJob ? "/" + row.sideJob : "") +
    "） " + row.skills.length + " 技能 · 未加 " + missing);
  for (const skill of row.skills) {
    console.log("  - " + skill.name + "（" + skill.condition + "） → " + skill.verdict);
    if (skill.status === "missing" && skill.tags.length) {
      console.log("      flags: " + skill.tags.join(", "));
      console.log("      " + oneLine(skill.effect).slice(0, 180));
    }
  }
}

function oneLine(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

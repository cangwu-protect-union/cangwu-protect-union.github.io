/* 引擎测试入口：node tests/engine/run.mjs [--only=core] [--filter=关键词]
   引擎经 js/engine/index.js 以 ESM 加载，全部挂在 globalThis.RPG6B 上；
   技能库经 data/skills/index.js import，挂到 globalThis.RPG6_SKILLS 供测试用例读取。 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import "../../rpg6.0/js/engine/index.js";
import skillsLib from "../../rpg6.0/data/skills/index.js";
import "../../rpg6.0/js/battle/battle-record.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const B = globalThis.RPG6B;
if (!B || !B.battle) throw new Error("引擎没有挂到 globalThis.RPG6B");

globalThis.RPG6_SKILLS = skillsLib;

function arg(name) {
  const hit = process.argv.slice(2).find((a) => a.startsWith("--" + name + "="));
  return hit ? hit.slice(name.length + 3) : "";
}

const only = arg("only");
const filter = arg("filter");

const files = fs.readdirSync(HERE)
  .filter((f) => f.endsWith(".test.mjs"))
  .filter((f) => (only ? f.startsWith(only) : true))
  .sort();

let pass = 0;
const failures = [];

for (const file of files) {
  const mod = await import(pathToFileURL(path.join(HERE, file)).href);
  const cases = mod.cases || [];
  if (!cases.length) continue;
  console.log("\n" + file);
  for (const item of cases) {
    if (filter && !item.name.includes(filter)) continue;
    try {
      await item.run({ B, CHAR: mod.CHAR });
      pass += 1;
      console.log("  ok   " + item.name);
    } catch (err) {
      failures.push({ file, name: item.name, err });
      console.log("  FAIL " + item.name);
      console.log("       " + String(err && err.message ? err.message : err));
    }
  }
}

console.log("\n" + pass + " 通过 / " + failures.length + " 失败");
if (failures.length) {
  for (const f of failures) {
    console.log("  - " + f.file + " · " + f.name);
    if (f.err && f.err.stack) console.log("    " + f.err.stack.split("\n").slice(1, 4).join("\n    "));
  }
  process.exit(1);
}

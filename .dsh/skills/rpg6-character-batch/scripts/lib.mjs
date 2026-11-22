import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";

export function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
}

export function findRoot(argv) {
  const i = argv.indexOf("--root");
  if (i >= 0 && argv[i + 1]) return path.resolve(argv[i + 1]);
  return repoRoot();
}

export function hasFlag(argv, name) {
  return argv.includes(name);
}

export function argValue(argv, name, fallback = "") {
  const i = argv.indexOf(name);
  if (i >= 0 && argv[i + 1] != null && !argv[i + 1].startsWith("--")) return argv[i + 1];
  /* 同时接受 --name=value，省得为写法差异排查一轮 */
  const pref = name + "=";
  const hit = argv.find((a) => a.startsWith(pref));
  return hit ? hit.slice(pref.length) : fallback;
}

function runWindowScript(root, relPaths, globalName) {
  const paths = Array.isArray(relPaths) ? relPaths : [relPaths];
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  for (const rel of paths) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) throw new Error("找不到文件：" + file);
    vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  }
  const value = sandbox.window[globalName];
  if (value == null) throw new Error(paths.join(", ") + " 没有导出 window." + globalName);
  return value;
}

const SEED_FILES = ["rpg6.0/data/seeds/characters.js", "rpg6.0/data/seeds/characters-2.js", "rpg6.0/data/seeds/characters-3.js", "rpg6.0/data/seeds/characters-4.js"];
export const SKILLS_INDEX = "rpg6.0/data/skills/index.js";

export function loadSeed(root) {
  const list = runWindowScript(root, SEED_FILES, "RPG_SEED_CHARACTERS");
  if (!Array.isArray(list)) throw new Error("RPG_SEED_CHARACTERS 不是数组");
  return list;
}

/* 技能库已拆成一个角色一个 ESM 文件、index.js 聚合；Node 里直接 import。 */
export async function loadLibrary(root) {
  const file = path.join(root, SKILLS_INDEX);
  if (!fs.existsSync(file)) throw new Error("找不到文件：" + file);
  const mod = await import(pathToFileURL(file).href);
  return mod.default;
}

export function norm(text) {
  return String(text == null ? "" : text).replace(/\s+/g, "");
}

export function seedStats(character) {
  return {
    atk: String(character.atk),
    def: String(character.def),
    mres: String(character.mres),
    hp: String(character.hp),
    mp: String(character.mp),
    spd: String(character.spd)
  };
}

export function flattenLibrary(lib) {
  const byOwner = {};
  const byId = {};
  const all = [];
  for (const [owner, list] of Object.entries(lib.characters || {})) {
    byOwner[owner] = [];
    for (const skill of list || []) {
      const item = Object.assign({ owner }, skill);
      byId[item.id] = item;
      byOwner[owner].push(item);
      all.push(item);
    }
  }
  return { byOwner, byId, all };
}

/* 递归遍历 ops，把每个 op 交给 fn；plan 校验用它查 summon.key。 */
export function eachOp(list, fn) {
  if (!Array.isArray(list)) return;
  for (const op of list) {
    if (!op || typeof op !== "object") continue;
    fn(op);
    for (const key of ["then", "else", "ops"]) eachOp(op[key], fn);
    for (const key of ["cases", "choices"]) {
      if (!Array.isArray(op[key])) continue;
      for (const item of op[key]) eachOp(item && item.ops, fn);
    }
  }
}

export function coverage(seed, lib) {
  const { byOwner, all: libSkills } = flattenLibrary(lib);
  const rows = [];
  let seedSkillCount = 0;
  let implemented = 0;
  let unsupported = 0;
  let mismatch = 0;
  let missing = 0;
  const seenLibIds = new Set();

  for (const character of seed) {
    const libList = byOwner[character.name] || [];
    const libByName = new Map(libList.map((s) => [norm(s.name), s]));
    const skills = [];
    for (const source of character.skills || []) {
      seedSkillCount += 1;
      const found = libByName.get(norm(source.name));
      let status = "missing";
      if (found) {
        seenLibIds.add(found.id);
        status = found.unsupported ? "unsupported" : "implemented";
        if (norm(found.conditionText) !== norm(source.condition)) status = "mismatch";
      }
      if (status === "implemented") implemented += 1;
      else if (status === "unsupported") unsupported += 1;
      else if (status === "mismatch") mismatch += 1;
      else missing += 1;
      skills.push({
        name: source.name,
        condition: source.condition,
        effect: source.effect || "",
        status,
        libraryId: found ? found.id : "",
        unsupported: found && found.unsupported ? String(found.unsupported) : ""
      });
    }
    rows.push({
      name: character.name,
      gender: character.gender,
      occupation: character.occupation,
      sideJob: character.side_job,
      stats: seedStats(character),
      inLibrary: Object.hasOwn(lib.characters || {}, character.name),
      implemented: skills.filter((s) => s.status === "implemented").length,
      unsupported: skills.filter((s) => s.status === "unsupported").length,
      mismatch: skills.filter((s) => s.status === "mismatch").length,
      missing: skills.filter((s) => s.status === "missing").length,
      skills
    });
  }

  const extraLibrary = libSkills.filter((s) => !seenLibIds.has(s.id)).map((s) => ({
    owner: s.owner,
    id: s.id,
    name: s.name,
    unsupported: s.unsupported || ""
  }));

  const libraryCharacters = Object.keys(lib.characters || {}).length;
  return {
    rows,
    extraLibrary,
    counts: {
      seedCharacters: seed.length,
      libraryCharacters,
      remainingCharacters: seed.length - rows.filter((r) => r.inLibrary).length,
      seedSkills: seedSkillCount,
      librarySkills: libSkills.length,
      implementedSkills: implemented,
      unsupportedSkills: unsupported,
      mismatchSkills: mismatch,
      missingSkills: missing
    }
  };
}

export function printCounts(counts) {
  console.log(
    "角色 " + counts.seedCharacters + " | 已接入 " + counts.libraryCharacters +
    " | 剩余 " + counts.remainingCharacters
  );
  console.log(
    "技能 " + counts.seedSkills + " | 已实现 " + counts.implementedSkills +
    " | unsupported " + counts.unsupportedSkills +
    " | 条件不一致 " + counts.mismatchSkills +
    " | 未加 " + counts.missingSkills
  );
}

export function statusMark(status) {
  if (status === "implemented") return "✓ 已接入";
  if (status === "unsupported") return "× unsupported";
  if (status === "mismatch") return "! 条件不一致";
  return "- 未加";
}

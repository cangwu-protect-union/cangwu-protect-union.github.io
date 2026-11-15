/* 引擎接入：在 Node 里按序加载 12 个引擎文件与技能库。
   顺序不能改，battle.mjs 依赖 root.RPG6B 这个全局。 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, "..", "..", "..");
export const LAB_DIR = path.join(ROOT, "rpg6.0", "strategy-lab");
const ENGINE_DIR = path.join(ROOT, "rpg6.0", "js", "engine");
const require = createRequire(import.meta.url);

export const LOAD_ORDER = [
  "version", "rng", "rules", "traits", "state", "damage", "effect-ops", "timeline",
  "conditions", "skills", "summons", "actions", "battle"
];

let cache = null;

export function loadEngine() {
  if (cache) return cache;
  globalThis.window = globalThis;
  for (const name of LOAD_ORDER) require(path.join(ENGINE_DIR, name + ".js"));
  require(path.join(ROOT, "rpg6.0", "data", "battle-skills.js"));
  const B = globalThis.RPG6B;
  const LIB = globalThis.RPG6_SKILLS;
  B.skills.load(LIB);
  const chars = readCharacters();
  cache = { B, LIB, chars, engineVersion: engineVersionOf(B) };
  return cache;
}

function engineVersionOf(B) {
  try {
    return B.ENGINE_VERSION || (globalThis.RPG_APP && globalThis.RPG_APP.engineVersion) || "unknown";
  } catch {
    return "unknown";
  }
}

function readCharacters() {
  const src = fs.readFileSync(path.join(ROOT, "rpg6.0", "data", "characters.js"), "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.window.RPG_SEED_CHARACTERS || [];
}

/* 参与实验室的角色：技能库里有的才算 */
export function roster(limit) {
  const { LIB, chars } = loadEngine();
  const names = Object.keys(LIB.characters);
  const list = chars.filter((c) => names.indexOf(c.name) >= 0);
  return typeof limit === "number" && limit > 0 ? list.slice(0, limit) : list;
}

export function charByName(name) {
  const hit = roster().find((c) => c.name === name);
  if (!hit) throw new Error("角色不在技能库里：" + name);
  return hit;
}

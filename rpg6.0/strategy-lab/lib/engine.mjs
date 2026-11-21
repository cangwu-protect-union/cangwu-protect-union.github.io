/* 引擎接入：经 js/engine/index.js 与 data/skills/index.js 以 ESM 加载，
   不再维护自己的加载顺序清单。角色档案仍用 vm 沙箱读 data/seeds/。 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import "../../js/engine/index.js";
import skillsLib from "../../data/skills/index.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, "..", "..", "..");
export const LAB_DIR = path.join(ROOT, "rpg6.0", "strategy-lab");

let cache = null;

export function loadEngine() {
  if (cache) return cache;
  const B = globalThis.RPG6B;
  B.skills.load(skillsLib);
  const chars = readCharacters();
  cache = { B, LIB: skillsLib, chars, engineVersion: engineVersionOf(B) };
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
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  for (const name of ["characters.js", "characters-2.js", "characters-3.js", "characters-4.js"]) {
    const file = path.join(ROOT, "rpg6.0", "data", "seeds", name);
    vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  }
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

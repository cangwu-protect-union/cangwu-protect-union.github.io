/* 技能库结构校验（tools/rpg6-lint.js）的自测
   用坏样本断言每条规则都真的会报，并断言 opNames 与 runOp 的 case 集合一致。 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const B = globalThis.RPG6B;
const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const lint = require(path.join(ROOT, "tools", "rpg6-lint.js"));
const SPEC = require(path.join(ROOT, "tools", "rpg6-spec.js"));

/* 一份最小的合法技能，坏样本在它上面改一处 */
function goodSkill() {
  return {
    id: "test.ok",
    name: "测试技能",
    conditionText: "1蓝",
    cost: { mp: 1 },
    charge: 0,
    cooldown: 0,
    target: "enemy",
    ops: [{ op: "damage", type: "phys", value: 100 }]
  };
}

function libWith(skill, extra) {
  return Object.assign({
    version: 1,
    marks: {},
    summons: {},
    characters: { 测试角色: [skill] }
  }, extra || {});
}

function reasons(result) {
  return result.problems.map((p) => p.where + ": " + p.reason).join("\n");
}

function expectProblem(skill, pattern, extra) {
  const result = lint.lintLibrary(libWith(skill, extra), { B });
  assert.ok(result.problems.length, "应该报错，实际 0 条：" + pattern);
  assert.match(reasons(result), pattern);
  return result;
}

export const cases = [
  {
    name: "合法技能不报错",
    run() {
      const result = lint.lintLibrary(libWith(goodSkill()), { B });
      assert.equal(result.problems.length, 0, reasons(result));
    }
  },
  {
    name: "没声明的标记被拦下",
    run() {
      const skill = goodSkill();
      skill.ops = [{ op: "mark", key: "nope" }];
      expectProblem(skill, /没有在本角色的 marks 里声明/);
    }
  },
  {
    name: "声明过的标记放行",
    run() {
      const skill = goodSkill();
      skill.ops = [{ op: "mark", key: "shuati" }];
      const result = lint.lintLibrary(libWith(skill, { marks: { 测试角色: [{ key: "shuati", name: "刷题", max: 3 }] } }), { B });
      assert.equal(result.problems.length, 0, reasons(result));
    }
  },
  {
    name: "未知 op 被拦下",
    run() {
      const skill = goodSkill();
      skill.ops = [{ op: "damgae", value: 1 }];
      expectProblem(skill, /未知 op：damgae/);
    }
  },
  {
    name: "同一个角色块里 id 重复被拦下",
    run() {
      const skill = goodSkill();
      const lib = libWith(skill);
      lib.characters.测试角色.push(JSON.parse(JSON.stringify(skill)));
      const result = lint.lintLibrary(lib, { B });
      assert.match(reasons(result), /id 重复/);
    }
  },
  {
    name: "target 取值非法被拦下",
    run() {
      const skill = goodSkill();
      skill.target = "enemyy";
      expectProblem(skill, /target 取值非法/);
    }
  },
  {
    name: "缺 conditionText 被拦下",
    run() {
      const skill = goodSkill();
      delete skill.conditionText;
      expectProblem(skill, /缺少 conditionText/);
    }
  },
  {
    name: "use 指向不存在的技能被拦下",
    run() {
      const skill = goodSkill();
      skill.ops = [{ op: "use", skillId: "test.missing" }];
      expectProblem(skill, /引用的技能不存在：test\.missing/);
    }
  },
  {
    name: "数值表达式写错键被拦下",
    run() {
      const skill = goodSkill();
      skill.ops = [{ op: "damage", type: "phys", value: { stt: "self.atk" } }];
      expectProblem(skill, /数值表达式不认识这些键/);
    }
  },
  {
    name: "hook 名字写错被拦下",
    run() {
      const skill = goodSkill();
      skill.hooks = { onBattleStart: [{ op: "note", text: "x" }] };
      expectProblem(skill, /引擎不会调用这个钩子/);
    }
  },
  {
    name: "op 上不认识的字段被拦下",
    run() {
      const skill = goodSkill();
      skill.ops = [{ op: "damage", type: "phys", value: 100, noBreakk: true }];
      expectProblem(skill, /这个 op 不认的字段/);
    }
  },
  {
    name: "opNames 与注册表一致",
    run() {
      const names = new Set(B.effectOps.opNames);
      const registered = new Set(Object.keys(B.effectOps._registry || {}));
      assert.deepEqual([...registered].sort(), [...names].sort());
    }
  },
  {
    name: "参数字典与 opNames 一致",
    run() {
      const problems = lint.checkOpNames(B);
      assert.equal(problems.length, 0, problems.map((p) => p.where + ": " + p.reason).join("\n"));
      assert.deepEqual(Object.keys(SPEC.OPS).sort(), B.effectOps.opNames.slice().sort());
    }
  },
  {
    name: "版本号只有一份（version.js 与 data/config.js）",
    run() {
      const problems = lint.checkVersion(B);
      assert.equal(problems.length, 0, problems.map((p) => p.where + ": " + p.reason).join("\n"));
    }
  }
];

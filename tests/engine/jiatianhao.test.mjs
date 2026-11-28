/* 第八批 · 甲天浩：不死窗口、负血、再攀高峰、身残志坚、妙手回春 */
import assert from "node:assert/strict";

const B = globalThis.RPG6B;
const LIB = globalThis.RPG6_SKILLS;
B.skills.load(LIB);

const JIATIANHAO = {
  id: "t-jiatianhao",
  name: "甲天浩",
  gender: "男",
  occupation: "爆发者",
  side_job: "",
  atk: "40",
  def: "10",
  mres: "45",
  hp: "350",
  mp: "15",
  spd: "65",
  skills: [
    { name: "向死而生", condition: "被动" },
    { name: "再攀高峰", condition: "1蓝3蓄力" },
    { name: "身残志坚", condition: "3蓝6蓄力" },
    { name: "妙手回春", condition: "5回合冷却" }
  ]
};

const DUMMY = {
  id: "t-dummy",
  name: "木桩",
  gender: "男",
  occupation: "强攻手",
  side_job: "",
  atk: "10",
  def: "0",
  mres: "0",
  hp: "9999",
  mp: "10",
  spd: "80",
  skills: []
};

function mk(seed) {
  return B.battle.create({ seed: seed == null ? 3 : seed, a: JIATIANHAO, b: DUMMY }).state;
}

function skill(id) {
  return LIB.characters["甲天浩"].find((s) => s.id === id);
}

function ctx(extra) {
  return Object.assign({ sourceUid: "a", targetUid: "b", skillId: "jiatianhao.test", label: "测试" }, extra || {});
}

export const cases = [
  {
    name: "甲天浩·向死而生：血量 ≤0 不判负，可负血、可被选中、可行动",
    run() {
      const state = mk();
      const a = state.units[0];
      const b = state.units[1];
      B.damage.hit(state, { sourceUid: "b", targetUid: "a", type: "true", amount: 400 }, []);
      assert.equal(a.hp, -50);
      assert.ok(a.undying);
      assert.equal(state.phase, "fight");
      assert.equal(B.state.isAlive(a), true);
      assert.equal(B.state.combatantsOf(state, "a").length, 1);
      assert.equal(a.marks.deaths.value, 1);
      assert.equal(B.state.hasStatus(a, "noBreakOut"), true);
      assert.equal(B.state.hasStatus(a, "breakLock"), true);
      B.actions.execute(state, { kind: "basic", type: "attack", target: "b" }, []);
      assert.equal(b.hp, 9999 - 40);
      assert.equal(a.hp, -10);
      assert.equal(b.breakValue, 0);
      B.damage.hit(state, { sourceUid: "b", targetUid: "a", type: "phys", amount: 10 }, []);
      assert.equal(a.breakValue, 0);
    }
  },
  {
    name: "甲天浩·向死而生：第 5 个标准回合结束血量 >0 复活，血上限 −100",
    run() {
      const state = mk();
      const a = state.units[0];
      B.damage.hit(state, { sourceUid: "b", targetUid: "a", type: "true", amount: 400 }, []);
      B.damage.heal(state, { uid: "a", amount: 150, rounding: "none" }, []);
      assert.equal(a.hp, 100);
      state.round = 4;
      B.effectOps.roundEnd(state, []);
      assert.ok(a.undying);
      state.round = 5;
      B.effectOps.roundEnd(state, []);
      assert.equal(a.undying, null);
      assert.equal(a.hp, 100);
      assert.equal(B.state.maxHpOf(a), 250);
      assert.equal(a.marks.deaths.value, 1);
      assert.equal(B.state.hasStatus(a, "undying"), false);
    }
  },
  {
    name: "甲天浩·向死而生：第 5 个标准回合结束血量 ≤0 直接判负",
    run() {
      const state = mk();
      const a = state.units[0];
      B.damage.hit(state, { sourceUid: "b", targetUid: "a", type: "true", amount: 400 }, []);
      state.round = 5;
      B.effectOps.roundEnd(state, []);
      assert.equal(state.phase, "finished");
      assert.equal(state.result, "b");
      assert.equal(a.undying, null);
    }
  },
  {
    name: "甲天浩·向死而生：血上限可以到负数，无法再复活",
    run() {
      const state = mk();
      const a = state.units[0];
      B.state.addMod(a, { stat: "maxHp", mode: "add", value: -400, remain: B.state.PERMANENT, source: "test", label: "测试" });
      assert.equal(B.state.maxHpOf(a), -50);
      B.state.clampHpToMax(a);
      assert.equal(a.hp, -50);
      B.damage.hit(state, { sourceUid: "b", targetUid: "a", type: "true", amount: 1 }, []);
      assert.ok(a.undying);
      state.round = 5;
      B.effectOps.roundEnd(state, []);
      assert.equal(state.phase, "finished");
      assert.equal(state.result, "b");
    }
  },
  {
    name: "甲天浩·再攀高峰：200 普伤 + 每死 1 次 100 真伤",
    run() {
      const state = mk();
      const b = state.units[1];
      B.effectOps.runOps(state, ctx(), skill("jiatianhao.zaipan").ops, []);
      assert.equal(b.hp, 9999 - 200);
      const state2 = mk();
      const b2 = state2.units[1];
      state2.units[0].marks.deaths.value = 2;
      B.effectOps.runOps(state2, ctx(), skill("jiatianhao.zaipan").ops, []);
      assert.equal(b2.hp, 9999 - 200 - 200);
    }
  },
  {
    name: "甲天浩·身残志坚：速度按失血重算、每回合血上限 +10、到期清速度留上限",
    run() {
      const state = mk();
      const a = state.units[0];
      a.hp = 300;
      a.marks.deaths.value = 1;
      B.effectOps.runOps(state, ctx({ targetUid: "a" }), skill("jiatianhao.shencan").ops, []);
      B.effectOps.turnEnd(state, a, []);
      assert.equal(B.state.statOf(a, "spd"), 115);
      assert.equal(B.state.maxHpOf(a), 360);
      a.hp = 250;
      B.effectOps.turnEnd(state, a, []);
      assert.equal(B.state.statOf(a, "spd"), 175);
      assert.equal(B.state.maxHpOf(a), 370);
      B.effectOps.turnEnd(state, a, []);
      assert.equal(B.state.statOf(a, "spd"), 65);
      assert.equal(B.state.maxHpOf(a), 380);
      assert.equal(a.effects.filter((e) => e.key === "shencan").length, 0);
    }
  },
  {
    name: "甲天浩·妙手回春：一次性回 80、速 −15 持续 4 自己回合、5 回合冷却",
    run() {
      const state = mk();
      const a = state.units[0];
      a.hp = 200;
      const ops = skill("jiatianhao.miaoshou").ops;
      B.effectOps.runOps(state, ctx({ targetUid: "a" }), ops, []);
      assert.equal(a.hp, 280);
      assert.equal(B.state.statOf(a, "spd"), 50);
      for (let i = 0; i < 4; i++) B.effectOps.turnEnd(state, a, []);
      assert.equal(B.state.statOf(a, "spd"), 65);
      a.cooldowns["jiatianhao.miaoshou"] = state.round;
      const check = B.conditions.evaluate(state, a, skill("jiatianhao.miaoshou"));
      assert.equal(check.ok, false);
      assert.ok(check.reason.indexOf("冷却") >= 0);
    }
  }
];

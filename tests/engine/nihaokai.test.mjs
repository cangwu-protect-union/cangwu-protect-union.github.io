/* 第八批 · 泥浩恺：noAction、固定反弹、回合开始复燃、职业道德、来自深渊的凝视 */
import assert from "node:assert/strict";

const B = globalThis.RPG6B;
const LIB = globalThis.RPG6_SKILLS;
B.skills.load(LIB);

const NIHAOKAI = {
  id: "t-nihaokai",
  name: "泥浩恺",
  gender: "男",
  occupation: "盾卫",
  side_job: "破阵师",
  atk: "80",
  def: "60",
  mres: "10",
  hp: "1300",
  mp: "10",
  spd: "30",
  skills: [
    { name: "核蔼可氢", condition: "2蓝" },
    { name: "职业道德", condition: "1蓝2蓄力" },
    { name: "扣分!", condition: "1蓝" },
    { name: "来自深渊的凝视", condition: "被动" }
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
  return B.battle.create({ seed: seed == null ? 7 : seed, a: NIHAOKAI, b: DUMMY }).state;
}

function skill(id) {
  return LIB.characters["泥浩恺"].find((s) => s.id === id);
}

function ctx(extra) {
  return Object.assign({ sourceUid: "a", targetUid: "b", skillId: "nihaokai.test", label: "测试" }, extra || {});
}

export const cases = [
  {
    name: "泥浩恺·核蔼可氢：noAction 不消耗行动，可同回合连放",
    run() {
      const state = mk();
      state.units[0].mp = 4;
      assert.equal(state.turnUid, "a");
      const first = B.battle.apply(state, { kind: "skill", skillId: "nihaokai.heai", target: "b" });
      assert.equal(first.state.units[0].actionsLeft, 1);
      assert.equal(first.state.turnUid, "a");
      assert.equal(first.state.phase, "fight");
      const second = B.battle.apply(first.state, { kind: "skill", skillId: "nihaokai.heai", target: "b" });
      assert.equal(second.state.units[0].actionsLeft, 1);
      assert.equal(second.state.turnUid, "a");
      assert.equal(second.state.units[0].mp, 0);
    }
  },
  {
    name: "泥浩恺·核蔼可氢：首用 35 真伤并按实际伤害回血，下一标准回合开始复燃 70",
    run() {
      const state = mk();
      const a = state.units[0];
      const b = state.units[1];
      a.hp = 1200;
      B.effectOps.runOps(state, ctx(), skill("nihaokai.heai").ops, []);
      assert.equal(b.hp, 9999 - 35);
      assert.equal(a.hp, 1235);
      assert.equal(a.scheduled.length, 1);
      assert.equal(a.scheduled[0].atPhase, "roundStart");
      assert.equal(a.scheduled[0].capture.dmg, 70);
      state.round = 2;
      B.effectOps.roundStart(state, []);
      assert.equal(b.hp, 9999 - 35 - 70);
      assert.equal(a.hp, 1300);
      assert.equal(a.scheduled.length, 0);
    }
  },
  {
    name: "泥浩恺·核蔼可氢：复燃可叠加，伤害按 70/140 各自快照",
    run() {
      const state = mk();
      const b = state.units[1];
      const schedule = {
        op: "schedule",
        after: 1,
        atPhase: "roundStart",
        capture: { dmg: { mult: { pow: [2, { counter: "heRepeat", perTarget: false }] }, factor: 35 } },
        ops: [{ op: "damage", who: "target", type: "true", value: { ctx: "dmg" } }]
      };
      B.effectOps.runOps(state, ctx(), [
        { op: "counter", who: "self", key: "heRepeat", delta: 1, perTarget: false },
        schedule
      ], []);
      B.effectOps.runOps(state, ctx(), [
        { op: "counter", who: "self", key: "heRepeat", delta: 1, perTarget: false },
        schedule
      ], []);
      state.round = 2;
      B.effectOps.roundStart(state, []);
      assert.equal(b.hp, 9999 - 70 - 140);
    }
  },
  {
    name: "泥浩恺·扣分!：5 段伤害取消并对攻击者反弹 50 法伤，不加击溃值",
    run() {
      const state = mk();
      const a = state.units[0];
      const b = state.units[1];
      B.effectOps.runOps(state, ctx({ targetUid: "a" }), skill("nihaokai.koufen").ops, []);
      assert.equal(a.reflectFixed.charges, 5);
      const hashBefore = B.state.hash(state);
      for (let i = 0; i < 5; i++) {
        const hpA = a.hp;
        const hpB = b.hp;
        B.damage.hit(state, { sourceUid: "b", targetUid: "a", type: "true", amount: 100 }, []);
        assert.equal(a.hp, hpA);
        assert.equal(b.hp, hpB - 50);
      }
      assert.equal(b.breakValue, 0);
      assert.equal(a.reflectFixed, null);
      assert.notEqual(B.state.hash(state), hashBefore);
      B.damage.hit(state, { sourceUid: "b", targetUid: "a", type: "true", amount: 100 }, []);
      assert.equal(a.hp, 1300 - 100);
    }
  },
  {
    name: "泥浩恺·职业道德：攻 300 起、每自己回合 −55、4 跳回 80，期间不加击溃值",
    run() {
      const state = mk();
      const a = state.units[0];
      const b = state.units[1];
      B.effectOps.runOps(state, ctx(), skill("nihaokai.zhiye").ops, []);
      assert.equal(B.state.statOf(a, "atk"), 300);
      assert.equal(b.buffs.find((x) => x.kind === "fragile").percent, 200);
      assert.equal(B.state.hasStatus(a, "noBreakOut"), true);
      B.damage.hit(state, { sourceUid: "a", targetUid: "b", type: "phys", amount: 10 }, []);
      assert.equal(b.breakValue, 0);
      for (let i = 0; i < 4; i++) B.effectOps.turnEnd(state, a, []);
      assert.equal(B.state.statOf(a, "atk"), 80);
      assert.equal(B.state.hasStatus(a, "noBreakOut"), false);
      B.damage.hit(state, { sourceUid: "a", targetUid: "b", type: "phys", amount: 10 }, []);
      assert.equal(b.breakValue, 1);
    }
  },
  {
    name: "泥浩恺·职业道德：重复释放覆盖，不叠两层 −55",
    run() {
      const state = mk();
      const a = state.units[0];
      const ops = skill("nihaokai.zhiye").ops;
      B.effectOps.runOps(state, ctx(), ops, []);
      B.effectOps.turnEnd(state, a, []);
      assert.equal(B.state.statOf(a, "atk"), 245);
      B.effectOps.runOps(state, ctx(), ops, []);
      assert.equal(B.state.statOf(a, "atk"), 300);
      assert.equal(a.marks.zyRound.value, 0);
      assert.equal(a.effects.filter((e) => e.key === "zhiye").length, 1);
      B.effectOps.turnEnd(state, a, []);
      assert.equal(B.state.statOf(a, "atk"), 245);
    }
  },
  {
    name: "泥浩恺·来自深渊的凝视：每敌方回合抽 1 蓝上限，≤0 后每标准回合 50 强扣",
    run() {
      const state = mk();
      const a = state.units[0];
      const b = state.units[1];
      assert.ok(a.effects.some((e) => e.key === "abyssDrain"));
      B.effectOps.runOps(state, ctx({ sourceUid: "b", targetUid: "b" }), [{ op: "maxMp", who: "self", delta: -7 }], []);
      assert.equal(B.state.maxMpOf(b), 3);
      for (let i = 0; i < 3; i++) B.effectOps.turnEnd(state, b, []);
      assert.equal(B.state.maxMpOf(b), 0);
      assert.equal(a.flags["ctr.abyssDrain.*"], 3);
      const hp = b.hp;
      B.effectOps.roundEnd(state, []);
      assert.equal(b.hp, hp - 50);
    }
  },
  {
    name: "泥浩恺·来自深渊的凝视：被击溃后下一标准回合复原并永久 −2，之后停止",
    run() {
      const state = mk();
      const a = state.units[0];
      const b = state.units[1];
      B.effectOps.runOps(state, ctx({ sourceUid: "b", targetUid: "b" }), [{ op: "maxMp", who: "self", delta: -7 }], []);
      for (let i = 0; i < 3; i++) B.effectOps.turnEnd(state, b, []);
      assert.equal(B.state.maxMpOf(b), 0);
      B.state.enterBreak(a, 2, "test", "击溃");
      B.effectOps.roundStart(state, []);
      assert.equal(B.state.maxMpOf(b), 1);
      assert.equal(a.marks.abyssRestored.value, 1);
      assert.ok(!a.effects.some((e) => e.key === "abyssDrain"));
      assert.ok(!a.effects.some((e) => e.key === "abyssLoss"));
      B.effectOps.roundStart(state, []);
      assert.equal(B.state.maxMpOf(b), 1);
    }
  }
];

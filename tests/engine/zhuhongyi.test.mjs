/* 第八批 · 朱弘毅：强免疫、额外行动、自伤判胜、禁蓄蓝、快照回溯 */
import assert from "node:assert/strict";

const B = globalThis.RPG6B;
const LIB = globalThis.RPG6_SKILLS;
B.skills.load(LIB);

const ZHUHONGYI = {
  id: "t-zhuhongyi",
  name: "朱弘毅",
  gender: "男",
  occupation: "爆发者",
  side_job: "破阵师",
  atk: "50",
  def: "35",
  mres: "0",
  hp: "400",
  mp: "20",
  spd: "80",
  skills: [
    { name: "天下第一", condition: "3蓝3蓄力" },
    { name: "且看世事多艰", condition: "5蓝" },
    { name: "急了", condition: "11蓄力" },
    { name: "这个世界...", condition: "50血" },
    { name: "反方向的钟", condition: "无" }
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
  spd: "100",
  skills: []
};

function mk(seed) {
  return B.battle.create({ seed: seed == null ? 5 : seed, a: ZHUHONGYI, b: DUMMY }).state;
}

function skill(id) {
  return LIB.characters["朱弘毅"].find((s) => s.id === id);
}

function ctx(extra) {
  return Object.assign({ sourceUid: "a", targetUid: "b", skillId: "zhuhongyi.test", label: "测试" }, extra || {});
}

export const cases = [
  {
    name: "朱弘毅·天下第一：非真伤/强扣/异常/属性降低/击溃全免疫，治疗与增益可进",
    run() {
      const state = mk();
      const a = state.units[0];
      B.effectOps.runOps(state, ctx({ targetUid: "a" }), skill("zhuhongyi.tianxia").ops, []);
      assert.equal(B.state.statOf(a, "def"), 9995);
      assert.equal(B.state.statOf(a, "mres"), 100);
      assert.equal(B.state.hasStatus(a, "strongImmune"), true);
      const hp = a.hp;
      B.damage.hit(state, { sourceUid: "b", targetUid: "a", type: "phys", amount: 1000 }, []);
      B.damage.hit(state, { sourceUid: "b", targetUid: "a", type: "magic", amount: 1000 }, []);
      B.damage.directLoss(state, { sourceUid: "b", targetUid: "a", amount: 100 }, []);
      assert.equal(a.hp, hp);
      assert.equal(a.breakValue, 0);
      B.effectOps.runOps(state, ctx({ sourceUid: "b", targetUid: "a" }), [
        { op: "buff", kind: "fragile", percent: 100 },
        { op: "status", kind: "stun", rounds: 2 },
        { op: "stat", stat: "atk", mode: "add", value: -10 }
      ], []);
      assert.equal(a.buffs.length, 0);
      assert.equal(B.state.hasStatus(a, "stun"), false);
      assert.equal(B.state.statOf(a, "atk"), 50);
      B.effectOps.runOps(state, ctx({ sourceUid: "b", targetUid: "a" }), [{ op: "buff", kind: "brave", percent: 50 }], []);
      assert.equal(a.buffs.length, 1);
      B.damage.hit(state, { sourceUid: "b", targetUid: "a", type: "true", amount: 100 }, []);
      assert.equal(a.hp, hp - 100);
    }
  },
  {
    name: "朱弘毅·天下第一：5 回合回 45，到期防御/法抗/强免疫一起恢复",
    run() {
      const state = mk();
      const a = state.units[0];
      a.hp = 300;
      B.effectOps.runOps(state, ctx({ targetUid: "a" }), skill("zhuhongyi.tianxia").ops, []);
      for (let i = 0; i < 5; i++) B.effectOps.roundEnd(state, []);
      assert.equal(a.hp, 400);
      assert.equal(B.state.statOf(a, "def"), 35);
      assert.equal(B.state.statOf(a, "mres"), 0);
      assert.equal(B.state.hasStatus(a, "strongImmune"), false);
    }
  },
  {
    name: "朱弘毅·且看世事多艰：禁普攻/禁蓄蓝/攻防 −25，3 个目标回合",
    run() {
      const state = mk();
      const b = state.units[1];
      B.effectOps.runOps(state, ctx({ sourceUid: "a", targetUid: "b" }), skill("zhuhongyi.shishi").ops, []);
      assert.equal(B.state.hasStatus(b, "noBasic"), true);
      assert.equal(B.state.hasStatus(b, "noMpCharge"), true);
      assert.equal(B.state.statOf(b, "atk"), 0);
      assert.equal(B.state.statOf(b, "def"), 0);
      state.turnUid = "b";
      b.actionsLeft = 1;
      const list = B.actions.list(state);
      const charge = list.find((x) => x.type === "chargeMp");
      assert.equal(charge.enabled, false);
      assert.ok(charge.reason.indexOf("无法蓄蓝") >= 0);
      assert.throws(() => B.actions.execute(state, { kind: "basic", type: "chargeMp" }, []), /无法蓄蓝/);
      assert.throws(() => B.actions.execute(state, { kind: "basic", type: "attack", target: "a" }, []), /无法普攻/);
      for (let i = 0; i < 3; i++) B.effectOps.turnEnd(state, b, []);
      assert.equal(B.state.hasStatus(b, "noBasic"), false);
      assert.equal(B.state.hasStatus(b, "noMpCharge"), false);
      assert.equal(B.state.statOf(b, "atk"), 10);
      assert.equal(B.state.statOf(b, "def"), 0);
    }
  },
  {
    name: "朱弘毅·急了：额外行动 = ceil(血上限/现有血)，1 血共 82 次",
    run() {
      const state = mk();
      const a = state.units[0];
      B.effectOps.runOps(state, ctx({ targetUid: "a" }), skill("zhuhongyi.jile").ops, []);
      a.hp = 400;
      state.turnUid = null;
      state.queue = ["a"];
      B.timeline.beginTurn(state, []);
      assert.equal(a.actionsLeft, 3);
      a.hp = 5;
      state.turnUid = null;
      state.queue = ["a"];
      B.timeline.beginTurn(state, []);
      assert.equal(a.actionsLeft, 82);
    }
  },
  {
    name: "朱弘毅·这个世界...：先结算再扣 50 血，自伤致死判自己胜",
    run() {
      const state = mk();
      const a = state.units[0];
      a.hp = 30;
      state.turnUid = "a";
      a.actionsLeft = 2;
      const result = B.battle.apply(state, { kind: "skill", skillId: "zhuhongyi.shijie", target: "b" });
      assert.equal(result.state.phase, "finished");
      assert.equal(result.state.result, "a");
      const state2 = mk();
      const a2 = state2.units[0];
      a2.hp = 100;
      state2.turnUid = "a";
      a2.actionsLeft = 2;
      const result2 = B.battle.apply(state2, { kind: "skill", skillId: "zhuhongyi.shijie", target: "b" });
      assert.equal(result2.state.phase, "fight");
      assert.equal(result2.state.units[0].hp, 50);
    }
  },
  {
    name: "朱弘毅·反方向的钟：奇数次记录、偶数次回到快照，clock 不重置",
    run() {
      const state = mk();
      const a = state.units[0];
      state.round = 5;
      state.clock = 5;
      a.hp = 300;
      B.effectOps.runOps(state, ctx({ targetUid: "a" }), [{ op: "rewind" }], []);
      assert.equal(a.rewind.pending, true);
      assert.equal(a.rewind.penaltyAtClock, 18);
      a.hp = 100;
      state.round = 8;
      state.clock = 8;
      state.log.push({ type: "test" });
      B.effectOps.runOps(state, ctx({ targetUid: "a" }), [{ op: "rewind" }], []);
      assert.ok(state.pendingRewind);
      const ok = B.state.applyRewind(state, "a");
      assert.equal(ok, true);
      const restored = state.units[0];
      assert.equal(restored.hp, 300);
      assert.equal(state.round, 5);
      assert.equal(state.clock, 8);
      assert.equal(restored.rewind.count, 2);
      assert.equal(restored.rewind.pending, false);
      assert.equal(state.log.some((e) => e.type === "test"), false);
    }
  },
  {
    name: "朱弘毅·反方向的钟：第 13 回合 400 强扣，快照失效且不触发回溯",
    run() {
      const state = mk();
      const a = state.units[0];
      state.round = 5;
      state.clock = 5;
      a.hp = 300;
      B.effectOps.runOps(state, ctx({ targetUid: "a" }), [{ op: "rewind" }], []);
      assert.equal(a.rewind.penaltyAtClock, 18);
      state.clock = 18;
      B.effectOps.roundEnd(state, []);
      assert.equal(a.rewind, null);
      assert.equal(state.phase, "finished");
      assert.equal(state.result, "b");
      assert.equal(state.pendingRewind, undefined);
    }
  },
  {
    name: "朱弘毅·反方向的钟：死亡立即发动并消耗待发的一次",
    run() {
      const state = mk();
      const a = state.units[0];
      state.round = 5;
      state.clock = 5;
      a.hp = 300;
      B.effectOps.runOps(state, ctx({ targetUid: "a" }), [{ op: "rewind" }], []);
      a.hp = 5;
      state.units[1].base.atk = 1000;
      state.turnUid = "b";
      state.units[1].actionsLeft = 1;
      const result = B.battle.apply(state, { kind: "basic", type: "attack", target: "a" });
      assert.equal(result.rewound, true);
      assert.equal(result.state.phase, "fight");
      assert.equal(result.state.units[0].hp, 300);
      assert.equal(result.state.units[0].rewind.count, 2);
      assert.equal(result.state.units[0].rewind.pending, false);
    }
  }
];

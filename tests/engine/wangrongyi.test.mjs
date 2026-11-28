/* 第九批 · 王荣逸「学习氛围」：开关技、每标准回合扣蓝回血、蓝耗尽/手动关闭 */
import assert from "node:assert/strict";

const B = globalThis.RPG6B;
const LIB = globalThis.RPG6_SKILLS;
B.skills.load(LIB);

const WANG = {
  id: "t-wangrongyi",
  name: "王荣逸",
  gender: "女",
  occupation: "斗士",
  side_job: "执旗手",
  atk: "60",
  def: "45",
  mres: "0",
  hp: "360",
  mp: "15",
  spd: "60",
  skills: [
    { name: "刷题", condition: "1蓝" },
    { name: "学习氛围", condition: "无" },
    { name: "习题轰炸", condition: "1蓝1蓄力" },
    { name: "满分嘲讽", condition: "3蓝3蓄力" }
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
  return B.battle.create({ seed: seed == null ? 7 : seed, a: WANG, b: DUMMY }).state;
}

function skill(id) {
  return LIB.characters["王荣逸"].find((s) => s.id === id);
}

function open(state) {
  return B.battle.apply(state, { kind: "skill", skillId: "wangrongyi.xuexi" }).state;
}

/* 一次标准回合末结算（引擎的 roundEnd 钩子；空标准回合也会推进） */
function standardRoundEnd(state) {
  B.effectOps.roundEnd(state, []);
  return state;
}

/* 推进到指定单位的下一个回合：空标准回合会连续推进 */
function advanceToOwnTurn(state, uid) {
  let guard = 0;
  while (state.turnUid !== uid && guard++ < 20) {
    if (state.turnUid) B.timeline.endTurn(state, []);
    B.timeline.beginTurn(state, []);
  }
  return state;
}

export const cases = [
  {
    name: "王荣逸·学习氛围：释放后挂效果，攻防 ×2，消耗 1 行动",
    run() {
      const state = mk();
      assert.equal(state.units[0].mp, 2, "执旗手开局 2 蓝");
      const result = B.battle.apply(state, { kind: "skill", skillId: "wangrongyi.xuexi" });
      const unit = result.state.units[0];
      assert.equal(result.committed.kind, "skill");
      assert.ok(!result.committed.closed, "首次释放是开启");
      assert.equal(B.state.hasEffectKey(unit, "wangrongyi.xuexi"), true);
      assert.equal(B.state.statOf(unit, "atk"), 120);
      assert.equal(B.state.statOf(unit, "def"), 90);
      assert.equal(unit.actionsLeft, 0, "开启消耗 1 行动");
      assert.equal(result.state.turnUid, "b", "行动用完换对方");
    }
  },
  {
    name: "王荣逸·学习氛围：每个标准回合末自己蓝 −1、己方英雄回血 20",
    run() {
      const state = open(mk());
      state.units[0].hp = 300;
      assert.equal(state.units[0].mp, 2);
      standardRoundEnd(state);
      const unit = state.units[0];
      assert.equal(unit.mp, 1, "蓝 2 → 1");
      assert.equal(unit.hp, 320, "回血 20");
      assert.equal(B.state.hasEffectKey(unit, "wangrongyi.xuexi"), true);
    }
  },
  {
    name: "王荣逸·学习氛围：蓝耗尽当回合仍回血，下一标准回合结束效果并恢复攻防",
    run() {
      const state = open(mk());
      const unit = state.units[0];
      unit.mp = 1;
      unit.hp = 300;
      standardRoundEnd(state);
      assert.equal(unit.hp, 320, "蓝耗尽当回合仍回血 20");
      assert.equal(unit.mp, 0, "蓝扣到 0");
      assert.equal(B.state.hasEffectKey(unit, "wangrongyi.xuexi"), true, "效果仍在");

      const hpBefore = unit.hp;
      standardRoundEnd(state);
      assert.equal(unit.hp, hpBefore, "效果结束后不再回血");
      assert.equal(B.state.hasEffectKey(unit, "wangrongyi.xuexi"), false);
      assert.equal(B.state.statOf(unit, "atk"), 60);
      assert.equal(B.state.statOf(unit, "def"), 45);
    }
  },
  {
    name: "王荣逸·学习氛围：再次释放=手动关闭，不消耗行动且不回退已回的血",
    run() {
      let state = open(mk());
      advanceToOwnTurn(state, "a");
      let unit = state.units[0];
      assert.equal(state.turnUid, "a");
      assert.equal(B.state.hasEffectKey(unit, "wangrongyi.xuexi"), true);
      assert.equal(unit.actionsLeft, 1);
      const hpBefore = unit.hp;
      const actionsBefore = unit.actionsLeft;

      const closed = B.battle.apply(state, { kind: "skill", skillId: "wangrongyi.xuexi" });
      unit = closed.state.units[0];
      assert.equal(closed.committed.closed, true);
      assert.equal(closed.committed.noAction, true);
      assert.equal(unit.actionsLeft, actionsBefore, "关闭不消耗行动");
      assert.equal(closed.state.turnUid, "a", "仍在自己的回合");
      assert.equal(B.state.hasEffectKey(unit, "wangrongyi.xuexi"), false);
      assert.equal(B.state.statOf(unit, "atk"), 60);
      assert.equal(B.state.statOf(unit, "def"), 45);
      assert.equal(unit.hp, hpBefore, "已回的血不回退");

      const reopened = B.battle.apply(closed.state, { kind: "skill", skillId: "wangrongyi.xuexi" });
      assert.ok(B.state.hasEffectKey(reopened.state.units[0], "wangrongyi.xuexi"), "关闭后再点技能是开启");
      assert.equal(reopened.state.units[0].actionsLeft, 0, "重新开启消耗 1 行动");
    }
  },
  {
    name: "王荣逸·学习氛围：开启→推进→关闭的动作流回放指纹一致",
    run() {
      const init = mk();
      const actions = [
        { kind: "skill", skillId: "wangrongyi.xuexi" },
        { kind: "basic", type: "pass" },
        { kind: "skill", skillId: "wangrongyi.xuexi" }
      ];
      const replay = B.battle.replay(init, actions);
      let state = B.state.clone(init);
      for (const action of actions) state = B.battle.apply(state, action).state;
      assert.equal(B.state.hash(state), B.state.hash(replay.state));
      assert.equal(replay.hashes[replay.hashes.length - 1], B.state.hash(state));
    }
  },
  {
    name: "王荣逸·学习氛围：开→关→开不叠加，攻防仍是 120/90",
    run() {
      let state = open(mk());
      state.units[0].mp = 15;
      advanceToOwnTurn(state, "a");
      state = B.battle.apply(state, { kind: "skill", skillId: "wangrongyi.xuexi" }).state;
      assert.equal(B.state.hasEffectKey(state.units[0], "wangrongyi.xuexi"), false);
      state = B.battle.apply(state, { kind: "skill", skillId: "wangrongyi.xuexi" }).state;
      assert.equal(B.state.statOf(state.units[0], "atk"), 120, "不是 240");
      assert.equal(B.state.statOf(state.units[0], "def"), 90, "不是 180");
    }
  },
  {
    name: "王荣逸·学习氛围：蓝=0 时开启，第一个标准回合末立即结束",
    run() {
      const base = mk();
      base.units[0].mp = 0;
      base.units[0].hp = 300;
      const state = open(base);
      assert.equal(B.state.statOf(state.units[0], "atk"), 120, "开启时仍先加攻防");
      standardRoundEnd(state);
      const unit = state.units[0];
      assert.equal(unit.hp, 300, "不回血");
      assert.equal(B.state.hasEffectKey(unit, "wangrongyi.xuexi"), false);
      assert.equal(B.state.statOf(unit, "atk"), 60);
      assert.equal(B.state.statOf(unit, "def"), 45);
    }
  },
  {
    name: "王荣逸·学习氛围：真实 timeline 跨空标准回合，每回合末都扣蓝回血",
    run() {
      let state = open(mk());
      const startRound = state.round;
      state.units[0].hp = 200;
      let healCount = 0;
      let mpDecCount = 0;
      let guard = 0;
      while (state.turnUid !== "a" && guard++ < 10) {
        const result = B.battle.apply(state, { kind: "basic", type: "pass" });
        state = result.state;
        for (const event of result.events) {
          if (event.type === "heal" && event.uid === "a") {
            healCount += 1;
            assert.equal(event.amount, 20, "每次回血 20");
          }
          if (event.type === "mp" && event.uid === "a" && event.delta === -1) {
            mpDecCount += 1;
          }
        }
      }
      const crossed = state.round - startRound;
      assert.ok(crossed >= 2, "速度条应跨过空标准回合，实际 " + crossed);
      assert.equal(healCount, crossed, "每个标准回合末都回血");
      assert.equal(mpDecCount, crossed, "每个标准回合末都扣 1 蓝");
      assert.equal(state.units[0].hp, 200 + 20 * crossed);
      assert.equal(state.units[0].mp, 2 - crossed);
    }
  },
  {
    name: "王荣逸·学习氛围：开启扣 1 行动，关闭不扣行动",
    run() {
      const base = mk();
      assert.equal(base.units[0].actionsLeft, 1);
      let state = open(base);
      assert.equal(state.units[0].actionsLeft, 0, "开启扣 1 行动");
      advanceToOwnTurn(state, "a");
      const before = state.units[0].actionsLeft;
      assert.equal(before, 1);
      const closed = B.battle.apply(state, { kind: "skill", skillId: "wangrongyi.xuexi" });
      assert.equal(closed.state.units[0].actionsLeft, before, "关闭不扣行动");
      assert.equal(closed.state.turnUid, "a");
    }
  },
  {
    name: "王荣逸·学习氛围：条件文本与档案一致，lint 通过",
    run() {
      const def = skill("wangrongyi.xuexi");
      assert.ok(def, "技能应存在");
      assert.equal(def.conditionText, "无");
      assert.equal(def.unsupported || "", "", "学习氛围已实现，不应再置灰");
      assert.equal(def.toggleEffect, "wangrongyi.xuexi");
      assert.equal(def.cost.mp, 0);
      assert.equal(def.target, "self");
      const problems = B.skills.validate([WANG]);
      assert.deepEqual(problems, [], "技能库与档案一致");
    }
  }
];

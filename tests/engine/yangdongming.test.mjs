/* 第九批 · 杨冬明「旱葱大祓」：召唤物门槛、清己方召唤物、恐慌与属性持续、
   掷 6 延时、普攻真伤/恐慌/无视嘲讽、自身免击溃、敌方自动击溃、回放一致 */
import assert from "node:assert/strict";

const B = globalThis.RPG6B;
const LIB = globalThis.RPG6_SKILLS;
B.skills.load(LIB);

const YANG = {
  id: "t-yangdongming",
  name: "杨冬明",
  gender: "女",
  occupation: "粉碎者",
  side_job: "召唤师",
  atk: "40",
  def: "60",
  mres: "40",
  hp: "400",
  mp: "30",
  spd: "100",
  skills: [
    { name: "旱葱大祓", condition: "8蓝" }
  ]
};

const DUMMY = {
  id: "t-dummy",
  name: "木桩",
  gender: "男",
  occupation: "强攻手",
  side_job: "",
  atk: "1",
  def: "0",
  mres: "0",
  hp: "5000",
  mp: "10",
  spd: "120",
  skills: []
};

function mk(seed) {
  return B.battle.create({ seed: seed == null ? 5 : seed, a: YANG, b: DUMMY }).state;
}

function skill(id) {
  return LIB.characters["杨冬明"].find((s) => s.id === id);
}

function ownSummons(state, n) {
  const a = state.units[0];
  for (let i = 0; i < n; i++) B.summons.create(state, "yangdongming.voice", a, []);
}

function cast(state) {
  return B.battle.apply(state, { kind: "skill", skillId: "yangdongming.hancongdafu" });
}

function giveTurnToYang(state) {
  state.turnUid = "a";
  state.units[0].actionsLeft = 1;
}

export const cases = [
  {
    name: "旱葱大祓·门槛：己方召唤物 2 个置灰，3 个可用",
    run() {
      const state = mk(1);
      const a = state.units[0];
      a.mp = 8;
      ownSummons(state, 2);
      const two = B.conditions.evaluate(state, a, skill("yangdongming.hancongdafu"));
      assert.equal(two.ok, false);
      assert.ok(two.reason.indexOf("召唤物") >= 0, "提示召唤物数量不足");
      ownSummons(state, 1);
      const three = B.conditions.evaluate(state, a, skill("yangdongming.hancongdafu"));
      assert.equal(three.ok, true);
    }
  },
  {
    name: "旱葱大祓·结算：200 法伤打敌方全体、50% 恐慌、清己方召唤物、速攻加成、持续 6 或 7",
    run() {
      const state = mk(2);
      const a = state.units[0];
      const b = state.units[1];
      a.mp = 8;
      ownSummons(state, 3);
      B.summons.create(state, "lvchangling.dilei", b, []);
      const enemySummon = B.state.summonsOf(state, "b")[0];
      assert.ok(enemySummon);
      const r = cast(state);
      const s = r.state;
      const afterB = B.state.unitOf(s, "b");
      assert.equal(afterB.hp, 5000 - 200, "200 法伤（法抗 0）");
      assert.equal(B.state.summonsOf(s, "b").length, 1, "敌方召唤物保留");
      assert.equal(B.state.summonsOf(s, "b")[0].hp, 300 - 200, "有血召唤物也吃 200 法伤");
      assert.equal(B.state.summonsOf(s, "a").length, 0, "己方召唤物清零");
      const yang = B.state.unitOf(s, "a");
      assert.equal(B.state.statOf(yang, "spd"), 200, "自身速 +100");
      assert.equal(B.state.statOf(yang, "atk"), 70, "自身攻 +30");
      const panic = afterB.buffs.filter((x) => x.kind === "panic");
      assert.equal(panic.length, 1);
      assert.equal(panic[0].percent, 50);
      const dice = r.events.find((e) => e.type === "dice");
      assert.ok(dice, "有掷骰事件");
      const expect = dice.value === 6 ? 7 : 6;
      const effect = yang.effects.find((e) => e.key === "yangdongming.hancongdafu");
      assert.ok(effect, "持续效果在身");
      assert.equal(effect.remain, expect);
      assert.equal(panic[0].remain, expect);
      const spdMod = yang.mods.find((m) => m.stat === "spd" && m.value === 100);
      assert.ok(spdMod);
      assert.equal(spdMod.remain, expect);
      const atkMod = yang.mods.find((m) => m.stat === "atk" && m.value === 30);
      assert.ok(atkMod);
      assert.equal(atkMod.remain, expect);
      assert.equal(B.state.effectHasFlag(yang, "autoBreakAtCap"), true);
      assert.equal(B.state.effectHasFlag(yang, "ignoreTaunt"), true);
      assert.equal(B.state.effectHasFlag(yang, "breakImmune"), true);
    }
  },
  {
    name: "旱葱大祓·掷 6：持续 7；推进第 6 回合仍在，第 7 回合到期",
    run() {
      const state = mk(3);
      const a = state.units[0];
      a.mp = 8;
      ownSummons(state, 3);
      const orig = B.rng.dice;
      B.rng.dice = function () { return 6; };
      let r;
      try {
        r = cast(state);
      } finally {
        B.rng.dice = orig;
      }
      let s = r.state;
      let yang = B.state.unitOf(s, "a");
      const effect = yang.effects.find((e) => e.key === "yangdongming.hancongdafu");
      assert.equal(effect.remain, 7, "掷出 6 → 7 回合");
      const panic = B.state.unitOf(s, "b").buffs.find((x) => x.kind === "panic");
      assert.equal(panic.remain, 7);
      for (let i = 0; i < 6; i++) B.effectOps.roundEnd(s, []);
      yang = B.state.unitOf(s, "a");
      assert.ok(yang.effects.find((e) => e.key === "yangdongming.hancongdafu"), "第 6 回合仍在");
      assert.equal(B.state.statOf(yang, "spd"), 200);
      B.effectOps.roundEnd(s, []);
      yang = B.state.unitOf(s, "a");
      assert.equal(yang.effects.find((e) => e.key === "yangdongming.hancongdafu"), undefined, "第 7 回合到期");
      assert.equal(B.state.statOf(yang, "spd"), 100, "速度加成到期");
      assert.equal(B.state.statOf(yang, "atk"), 40, "攻击加成到期");
    }
  },
  {
    name: "旱葱大祓·普攻强化：真伤（不看防御法抗）、命中 +10% 恐慌与 50% 取最大、无视嘲讽",
    run() {
      const state = mk(4);
      const a = state.units[0];
      const b = state.units[1];
      a.mp = 8;
      ownSummons(state, 3);
      B.summons.create(state, "lvchangling.dilei", b, []);
      const enemySummon = B.state.summonsOf(state, "b")[0];
      const r = cast(state);
      const s = r.state;
      b.def = 40;
      b.mres = 90;
      giveTurnToYang(s);
      const events = [];
      B.actions.execute(s, { kind: "basic", type: "attack", target: "b" }, events);
      const hit = events.find((e) => e.type === "damage" && e.skillId === "basic.attack");
      assert.ok(hit, "有普攻伤害事件");
      assert.equal(hit.damageType, "true", "普攻变真伤");
      assert.equal(hit.amount, 70, "真伤 = 攻击 70，不看防御法抗");
      const panics = B.state.unitOf(s, "b").buffs.filter((x) => x.kind === "panic");
      assert.ok(panics.some((x) => x.percent === 10), "命中附加 10% 恐慌");
      const maxPanic = Math.max.apply(null, panics.map((x) => x.percent));
      assert.equal(maxPanic, 50, "与 50% 取最大，不叠加");
      const mult = B.rules.multiplier(B.state.unitOf(s, "b"), B.state.unitOf(s, "a"), "phys");
      assert.equal(mult, 0.5, "恐慌仍按 50% 生效");
      /* 无视嘲讽：敌方英雄嘲讽 2、召唤物 0，效果期间可打召唤物 */
      giveTurnToYang(s);
      B.state.unitOf(s, "b").taunt = 2;
      const events2 = [];
      B.actions.execute(s, { kind: "basic", type: "attack", target: enemySummon.uid }, events2);
      const hit2 = events2.find((e) => e.type === "damage" && e.uid === enemySummon.uid);
      assert.ok(hit2, "无视嘲讽，能打到低嘲讽召唤物");
    }
  },
  {
    name: "旱葱大祓·无视嘲讽只对普攻生效：单攻技能仍被拒，到期后普攻恢复限制",
    run() {
      const state = mk(9);
      const a = state.units[0];
      const b = state.units[1];
      a.mp = 8;
      ownSummons(state, 3);
      B.summons.create(state, "lvchangling.dilei", b, []);
      const summon = B.state.summonsOf(state, "b")[0];
      const r = cast(state);
      const s = r.state;
      B.state.unitOf(s, "b").taunt = 2;
      /* 单攻技能仍按静态嘲讽：打低嘲讽召唤物被拒 */
      assert.throws(function () {
        B.skills.resolveTarget(s, B.state.unitOf(s, "a"), skill("yangdongming.zhuguang"), summon.uid);
      }, /必须选择嘲讽最高的目标/);
      /* 同一次效果里普攻放行 */
      giveTurnToYang(s);
      const events = [];
      B.actions.execute(s, { kind: "basic", type: "attack", target: summon.uid }, events);
      assert.ok(events.some((e) => e.type === "damage" && e.uid === summon.uid), "普攻打低嘲讽召唤物放行");
      /* 效果到期后，普攻恢复嘲讽限制 */
      for (let i = 0; i < 7; i++) B.effectOps.roundEnd(s, []);
      const yang = B.state.unitOf(s, "a");
      assert.equal(yang.effects.find((e) => e.key === "yangdongming.hancongdafu"), undefined, "效果已到期");
      giveTurnToYang(s);
      assert.throws(function () {
        B.actions.execute(s, { kind: "basic", type: "attack", target: summon.uid }, []);
      }, /必须选择嘲讽最高的目标/);
    }
  },
  {
    name: "旱葱大祓·自身免击溃：效果期间击溃值到 5 也不进入击溃状态",
    run() {
      const state = mk(5);
      const a = state.units[0];
      a.mp = 8;
      ownSummons(state, 3);
      const r = cast(state);
      const s = r.state;
      const yang = B.state.unitOf(s, "a");
      yang.breakValue = 5;
      const st = B.state.enterBreak(yang, B.rules.breakRounds(5), "test", "击溃");
      assert.equal(st.remain, 0, "免疫击溃");
      assert.equal(B.state.hasStatus(yang, "break"), false);
    }
  },
  {
    name: "旱葱大祓·敌方自动击溃：击溃值到 5 立即击溃 8 回合、击溃值清零、不消耗行动",
    run() {
      const state = mk(6);
      const a = state.units[0];
      const b = state.units[1];
      a.mp = 8;
      ownSummons(state, 3);
      const r = cast(state);
      const s = r.state;
      const enemy = B.state.unitOf(s, "b");
      enemy.breakValue = 4;
      const yang = B.state.unitOf(s, "a");
      yang.actionsLeft = 1;
      const events = [];
      B.effectOps.runOps(s, { sourceUid: "a", targetUid: "b", skillId: "test", label: "测试" },
        [{ op: "damage", who: "target", type: "true", value: 10 }], events);
      assert.equal(enemy.breakValue, 0, "击溃值清零");
      const status = enemy.statuses.find((x) => x.kind === "break");
      assert.ok(status, "进入击溃状态");
      assert.equal(status.remain, 8, "击溃时长按 5 计算 = 8 标准回合");
      assert.equal(yang.actionsLeft, 1, "不消耗杨冬明行动");
      const auto = events.find((e) => e.type === "statusAdd" && e.source === "autoBreak");
      assert.ok(auto, "自动击溃事件");
    }
  },
  {
    name: "旱葱大祓·效果在身时技能置灰（forbidEffect）",
    run() {
      const state = mk(7);
      const a = state.units[0];
      a.mp = 30;
      ownSummons(state, 3);
      const r = cast(state);
      const s = r.state;
      const yang = B.state.unitOf(s, "a");
      const check = B.conditions.evaluate(s, yang, skill("yangdongming.hancongdafu"));
      assert.equal(check.ok, false);
      assert.ok(check.reason.indexOf("旱葱大祓") >= 0 || check.reason.indexOf("无法使用") >= 0, "提示效果在身");
    }
  },
  {
    name: "旱葱大祓·回放：释放、普攻、自动击溃的动作流 hash 与逐步 apply 一致",
    run() {
      const init = mk(8);
      const a = init.units[0];
      const b = init.units[1];
      a.mp = 30;
      ownSummons(init, 3);
      B.summons.create(init, "lvchangling.dilei", b, []);
      b.breakValue = 3;
      const actions = [];
      let state = init;
      let r = B.battle.apply(state, { kind: "skill", skillId: "yangdongming.hancongdafu" });
      state = r.state;
      actions.push(r.committed);
      assert.equal(B.state.unitOf(state, "b").breakValue, 4, "释放后击溃值 4");
      /* 木桩跳过自己的回合，直到又轮到杨冬明普攻触发自动击溃 */
      let guard = 0;
      while (state.turnUid !== "a") {
        guard += 1;
        if (guard > 10) throw new Error("等不到杨冬明回合");
        r = B.battle.apply(state, { kind: "basic", type: "pass" });
        state = r.state;
        actions.push(r.committed);
      }
      r = B.battle.apply(state, { kind: "basic", type: "attack", target: "b" });
      state = r.state;
      actions.push(r.committed);
      assert.ok(B.state.unitOf(state, "b").statuses.find((x) => x.kind === "break"), "普攻触发自动击溃");
      const replay = B.battle.replay(init, actions);
      assert.equal(B.state.hash(replay.state), B.state.hash(state), "回放指纹一致");
    }
  }
];

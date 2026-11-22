/* 第七批 · 引擎新能力 E1–E11 用例（run.mjs 自动加载） */
import assert from "node:assert/strict";

const B = globalThis.RPG6B;
const LIB = globalThis.RPG6_SKILLS;

function charOf(name, job, sideJob, stats) {
  const s = stats || {};
  return {
    id: "t-" + name,
    name: name,
    gender: "男",
    occupation: job || "强攻手",
    side_job: sideJob || "",
    atk: String(s.atk == null ? 100 : s.atk),
    def: String(s.def == null ? 0 : s.def),
    mres: String(s.mres == null ? 0 : s.mres),
    hp: String(s.hp == null ? 500 : s.hp),
    mp: String(s.mp == null ? 10 : s.mp),
    spd: String(s.spd == null ? 60 : s.spd),
    skills: []
  };
}

function mk(a, b, seed) {
  return B.battle.create({ seed: seed == null ? 7 : seed, a: a, b: b }).state;
}

function runOps(state, uid, ops, events) {
  B.effectOps.runOps(state, {
    sourceUid: uid,
    targetUid: B.state.otherUid(state, uid),
    skillId: "test",
    label: "测试"
  }, ops, events || []);
  return events || [];
}

export const cases = [
  {
    name: "E1 群体上限 limit：只打前 N 个，不足 N 个全打",
    run() {
      B.skills.load(LIB);
      const state = mk(charOf("甲", "强攻手", "", { hp: 500, spd: 10 }), charOf("乙", "强攻手", "", { hp: 500, spd: 99 }));
      const hero = state.units[1];
      for (let i = 0; i < 3; i++) B.summons.create(state, "yangshuhan.tomb", hero, []);
      const summons = B.state.summonsOf(state, "b");
      assert.equal(summons.length, 3);
      runOps(state, "a", [{ op: "damage", who: { of: "allEnemies", limit: 2 }, type: "true", value: 100, noBreak: true }]);
      assert.equal(hero.hp, 400);
      assert.equal(summons[0].hp, 1100);
      assert.equal(summons[1].hp, 1200, "第 3 个目标不应被打");
      assert.equal(summons[2].hp, 1200);
      const state2 = mk(charOf("甲", "强攻手", "", { hp: 500, spd: 10 }), charOf("乙", "强攻手", "", { hp: 500, spd: 99 }));
      B.summons.create(state2, "yangshuhan.tomb", state2.units[1], []);
      runOps(state2, "a", [{ op: "damage", who: { of: "allEnemies", limit: 3 }, type: "true", value: 100, noBreak: true }]);
      assert.equal(state2.units[1].hp, 400);
      assert.equal(B.state.summonsOf(state2, "b")[0].hp, 1100, "不足 3 个时全打");
    }
  },
  {
    name: "E2 untilRecast：属性生效、removeEffect 回滚并清掉效果",
    run() {
      B.skills.load(LIB);
      const state = mk(charOf("甲", "粉碎者", "", { def: 15, hp: 300, spd: 10 }), charOf("乙", "强攻手", "", { spd: 99 }));
      const unit = state.units[0];
      const baseDef = B.state.statOf(unit, "def");
      runOps(state, "a", [
        { op: "stat", who: "self", stat: "def", mode: "add", value: 45, duration: null, untilRecast: "k1" },
        { op: "maxHp", who: "self", delta: 300, untilRecast: "k1" },
        { op: "tick", who: "self", permanent: true, key: "k1", ops: [] }
      ]);
      assert.equal(B.state.statOf(unit, "def"), baseDef + 45);
      assert.equal(B.state.maxHpOf(unit), 600);
      assert.equal(B.state.hasEffectKey(unit, "k1"), true);
      runOps(state, "a", [{ op: "removeEffect", who: "self", key: "k1" }]);
      assert.equal(B.state.statOf(unit, "def"), baseDef, "防御应回滚");
      assert.equal(B.state.maxHpOf(unit), 300, "血上限应回滚");
      assert.equal(B.state.hasEffectKey(unit, "k1"), false, "效果应被清掉");
    }
  },
  {
    name: "E3 伤害转血上限：不扣血、上限等量增加；强扣不转换；到期恢复",
    run() {
      B.skills.load({
        characters: {
          "转换甲": [{
            id: "t.conv", name: "转换", conditionText: "被动", passive: true, target: "self",
            cost: { mp: 0 }, charge: 0, cooldown: 0, ops: [],
            hooks: {
              battleStart: [{ op: "tick", who: "self", duration: { unit: "enemyRound", count: 3 }, key: "t.conv.effect", ops: [] }],
              beforeDamage: [{ op: "if", cond: { effect: "t.conv.effect" }, then: [{ op: "convert", to: "maxHp" }] }]
            }
          }]
        },
        marks: {}, summons: {}
      });
      const state = mk(charOf("转换甲", "强攻手", "", { hp: 500, spd: 10 }), charOf("乙", "强攻手", "", { spd: 99 }));
      const unit = state.units[0];
      const maxBefore = B.state.maxHpOf(unit);
      const events = [];
      B.damage.hit(state, { sourceUid: "b", targetUid: "a", type: "true", amount: 100, skillId: "test" }, events);
      assert.equal(unit.hp, 500, "不扣血");
      assert.equal(B.state.maxHpOf(unit), maxBefore + 100, "上限等量增加");
      assert.equal(events.some((e) => e.type === "convertMaxHp"), true, "要有 convertMaxHp 事件");
      assert.equal(events.some((e) => e.type === "damage"), false, "不能当普通伤害结算");
      assert.equal(unit.breakValue, 0, "不加击溃值");
      B.damage.directLoss(state, { sourceUid: "b", targetUid: "a", amount: 50 }, events);
      assert.equal(unit.hp, 450, "强扣不转换");
      const enemy = state.units[1];
      B.effectOps.turnEnd(state, enemy, events);
      B.effectOps.turnEnd(state, enemy, events);
      B.effectOps.turnEnd(state, enemy, events);
      assert.equal(B.state.hasEffectKey(unit, "t.conv.effect"), false, "3 个敌方回合后到期");
      B.damage.hit(state, { sourceUid: "b", targetUid: "a", type: "true", amount: 100, skillId: "test" }, events);
      assert.equal(unit.hp, 350, "到期后恢复正常扣血");
      assert.equal(events.some((e) => e.type === "damage"), true);
    }
  },
  {
    name: "E4 decay：百分比逐次递减，减到 0 移除，多个来源各自衰减",
    run() {
      B.skills.load(LIB);
      const state = mk(charOf("甲"), charOf("乙"));
      const unit = state.units[0];
      const events = [];
      runOps(state, "a", [
        { op: "buff", who: "self", kind: "brave", percent: 100, duration: 99, label: "来源一" },
        { op: "buff", who: "self", kind: "brave", percent: 60, duration: 99, label: "来源二" }
      ], events);
      runOps(state, "a", [{ op: "decay", who: "self", kind: "brave", delta: 20 }], events);
      assert.equal(unit.buffs.length, 2);
      assert.equal(unit.buffs[0].percent, 80);
      assert.equal(unit.buffs[1].percent, 40, "不同来源各自衰减");
      runOps(state, "a", [{ op: "decay", who: "self", kind: "brave", delta: 50 }], events);
      assert.equal(unit.buffs.length, 1, "减到 0 的那条被移除");
      assert.equal(unit.buffs[0].percent, 30);
      const gone = events.some((e) => e.type === "buffExpire");
      assert.equal(gone, true);
      const decayed = events.filter((e) => e.type === "buffDecay");
      assert.equal(decayed.length >= 2, true);
    }
  },
  {
    name: "E5 item：不消耗行动、每回合限 1 次、库存 0 不列入口",
    run() {
      B.skills.load({
        characters: {
          "苹果甲": [{
            id: "t.apple", name: "苹果", conditionText: "被动", passive: true, target: "self",
            cost: { mp: 0 }, charge: 0, cooldown: 0, ops: [],
            items: [{
              id: "t.eat", label: "吃苹果", requires: [{ mark: "fruit", gte: 1 }], oncePerRound: true,
              ops: [
                { op: "heal", who: "self", value: 90, rounding: "none" },
                { op: "mark", who: "self", key: "fruit", delta: -1 }
              ]
            }]
          }]
        },
        marks: { "苹果甲": [{ key: "fruit", name: "苹果库存", max: 5, init: 2 }] },
        summons: {}
      });
      const state = mk(charOf("苹果甲", "强攻手", "", { hp: 500, spd: 10 }), charOf("乙", "强攻手", "", { spd: 99 }));
      const unit = state.units[0];
      B.damage.directLoss(state, { sourceUid: "b", targetUid: "a", amount: 100 }, []);
      assert.equal(unit.hp, 400, "先压血，避免回血被上限钳制");
      const entry = B.battle.available(state).find((x) => x.kind === "item");
      assert.ok(entry, "有库存时应列出入口");
      assert.equal(entry.enabled, true);
      const actionsBefore = unit.actionsLeft;
      const applied = B.battle.apply(state, { kind: "item", key: "t.eat" });
      assert.equal(applied.state.units[0].actionsLeft, actionsBefore, "不消耗行动");
      assert.equal(applied.state.units[0].hp, 490);
      assert.equal(B.state.markOf(applied.state.units[0], "fruit"), 1);
      const entry2 = B.battle.available(applied.state).find((x) => x.kind === "item");
      assert.ok(entry2, "每回合限 1 次：仍列出但置灰");
      assert.equal(entry2.enabled, false);
      assert.match(entry2.reason, /本回合已经用过/);
      runOps(applied.state, "a", [{ op: "markClear", who: "self", key: "fruit" }]);
      const entry3 = B.battle.available(applied.state).find((x) => x.kind === "item");
      assert.equal(entry3, undefined, "库存 0 不列入口");
    }
  },
  {
    name: "E6 enemyRound：只在对手英雄回合走格，被跳过的回合也算",
    run() {
      B.skills.load({
        characters: {
          "计时甲": [{
            id: "t.timer", name: "计时", conditionText: "被动", passive: true, target: "self",
            cost: { mp: 0 }, charge: 0, cooldown: 0, ops: [],
            hooks: { battleStart: [{ op: "tick", who: "self", duration: { unit: "enemyRound", count: 3 }, key: "t.timer.effect", ops: [] }] }
          }]
        },
        marks: {}, summons: {}
      });
      const state = mk(charOf("计时甲", "强攻手", "", { spd: 10 }), charOf("乙", "强攻手", "", { spd: 99 }));
      const unit = state.units[0];
      const remainOf = () => {
        const eff = unit.effects.find((e) => e.key === "t.timer.effect");
        return eff ? eff.remain : 0;
      };
      assert.equal(remainOf(), 3);
      B.effectOps.turnEnd(state, unit, []);
      assert.equal(remainOf(), 3, "己方回合不走格");
      B.effectOps.turnEnd(state, state.units[1], []);
      assert.equal(remainOf(), 2, "敌方英雄回合走一格");
      B.effectOps.skippedTurn(state, state.units[1], []);
      assert.equal(remainOf(), 1, "被跳过的敌方回合也算");
      B.effectOps.skippedTurn(state, unit, []);
      assert.equal(remainOf(), 1, "被跳过的己方回合不算");
    }
  },
  {
    name: "E7 dispel scope:status 与 scope:debuff 互不影响",
    run() {
      B.skills.load(LIB);
      const state = mk(charOf("甲"), charOf("乙"));
      const unit = state.units[0];
      runOps(state, "a", [
        { op: "buff", who: "self", kind: "fragile", percent: 50, duration: 3 },
        { op: "buff", who: "self", kind: "brave", percent: 50, duration: 3 },
        { op: "status", who: "self", kind: "stun", rounds: 2 },
        { op: "status", who: "self", kind: "daze", rounds: 2 }
      ]);
      runOps(state, "a", [{ op: "dispel", who: "self", scope: "status" }]);
      assert.equal(unit.statuses.length, 0, "异常状态全清");
      assert.equal(unit.buffs.length, 2, "不影响 Buff");
      runOps(state, "a", [{ op: "dispel", who: "self", scope: "debuff" }]);
      assert.equal(unit.buffs.length, 1, "只清脆弱");
      assert.equal(unit.buffs[0].kind, "brave", "勇猛不是 Debuff 不清");
    }
  },
  {
    name: "E8 forbidEffect：有该效果时置灰，无效果时可用",
    run() {
      B.skills.load({
        characters: {
          "禁甲": [{
            id: "t.forbid", name: "禁", conditionText: "1蓝", target: "self",
            cost: { mp: 1 }, charge: 0, cooldown: 0, forbidEffect: "t.x", ops: []
          }]
        },
        marks: {}, summons: {}
      });
      const state = mk(charOf("禁甲", "强攻手", "", { mp: 10, spd: 10 }), charOf("乙", "强攻手", "", { spd: 99 }));
      const unit = state.units[0];
      unit.mp = 10;
      const skill = B.skills.find("t.forbid");
      assert.equal(B.conditions.evaluate(state, unit, skill).ok, true);
      runOps(state, "a", [{ op: "tick", who: "self", permanent: true, key: "t.x", label: "剃发为僧", ops: [] }]);
      const blocked = B.conditions.evaluate(state, unit, skill);
      assert.equal(blocked.ok, false);
      assert.match(blocked.reason, /剃发为僧/);
      runOps(state, "a", [{ op: "removeEffect", who: "self", key: "t.x" }]);
      assert.equal(B.conditions.evaluate(state, unit, skill).ok, true);
    }
  },
  {
    name: "E9 mark.delta 表达式：按骰值加层，数字行为不变",
    run() {
      B.skills.load({
        characters: { "骰甲": [] },
        marks: { "骰甲": [{ key: "m", name: "层数", max: 99, init: 0 }] },
        summons: {}
      });
      const state = mk(charOf("骰甲"), charOf("乙"));
      const unit = state.units[0];
      const events = [];
      runOps(state, "a", [
        { op: "roll", who: "self", key: "r", perTarget: false },
        { op: "mark", who: "self", key: "m", delta: { counter: "r", perTarget: false } }
      ], events);
      const dice = events.find((e) => e.type === "dice");
      assert.equal(B.state.markOf(unit, "m"), dice.value, "按骰值加层");
      runOps(state, "a", [{ op: "mark", who: "self", key: "m", delta: 3 }], events);
      assert.equal(B.state.markOf(unit, "m"), dice.value + 3, "数字 delta 行为不变");
    }
  },
  {
    name: "E10 cost.maxMp：判蓝上限、永久扣上限、当前蓝钳制、可反复释放到不足",
    run() {
      B.skills.load({
        characters: {
          "枪甲": [{
            id: "t.gun", name: "机枪射手", conditionText: "5蓝上限", target: "enemy",
            cost: { maxMp: 5 }, charge: 0, cooldown: 0,
            ops: [{ op: "damage", who: "target", type: "true", value: 10, times: 5 }]
          }]
        },
        marks: {}, summons: {}
      });
      const state = mk(charOf("枪甲", "强攻手", "", { mp: 10, spd: 10 }), charOf("乙", "强攻手", "", { hp: 500, spd: 99 }));
      const unit = state.units[0];
      unit.mp = 10;
      const skill = B.skills.find("t.gun");
      assert.equal(B.conditions.evaluate(state, unit, skill).ok, true);
      B.skills.execute(state, unit, { kind: "skill", skillId: "t.gun", target: "b" }, []);
      assert.equal(B.state.maxMpOf(unit), 5, "释放后蓝上限 −5");
      assert.equal(unit.mp, 5, "当前蓝钳到新上限");
      assert.equal(state.units[1].hp, 450, "5 段 10 真伤");
      B.skills.execute(state, unit, { kind: "skill", skillId: "t.gun", target: "b" }, []);
      assert.equal(B.state.maxMpOf(unit), 0);
      assert.equal(unit.mp, 0);
      const blocked = B.conditions.evaluate(state, unit, skill);
      assert.equal(blocked.ok, false, "蓝上限不足置灰");
      assert.match(blocked.reason, /蓝上限不足/);
    }
  },
  {
    name: "E11 dispel scope:marked：清带标记的修正与持续效果，不误清普通修正",
    run() {
      B.skills.load({
        characters: {
          "清甲": [{
            id: "t.qing", name: "文学巨作", conditionText: "2蓝", target: "self",
            cost: { mp: 2 }, charge: 0, cooldown: 0,
            ops: [{ op: "dispel", who: "self", scope: "marked" }]
          }],
          "王甲": [{
            id: "t.wangba", name: "王霸之气", conditionText: "被动", passive: true, target: "self",
            cost: { mp: 0 }, charge: 0, cooldown: 0, ops: [],
            hooks: {
              battleStart: [
                { op: "stat", who: "allEnemies", stat: "atk", mode: "add", value: -20, duration: 99, debuff: true },
                { op: "tick", who: "allEnemies", duration: 99, debuff: true, label: "王霸之气", ops: [{ op: "damage", who: "target", type: "true", value: 25, noBreak: true }] }
              ]
            }
          }]
        },
        marks: {}, summons: {}
      });
      const state = mk(charOf("清甲", "强攻手", "", { atk: 100, mp: 10, spd: 10 }), charOf("王甲", "强攻手", "", { spd: 99 }));
      const unit = state.units[0];
      unit.mp = 10;
      const reduced = B.state.statOf(unit, "atk");
      assert.equal(reduced, 80, "开局攻 −20 生效");
      assert.equal(B.state.hasEffectKey(unit, "lvchangling.tifa"), false);
      const tickCount = unit.effects.filter((e) => e.debuff).length;
      assert.equal(tickCount, 1);
      runOps(state, "a", [{ op: "stat", who: "self", stat: "mres", mode: "add", value: -10, duration: null }]);
      B.skills.execute(state, unit, { kind: "skill", skillId: "t.qing", target: "a" }, []);
      assert.equal(B.state.statOf(unit, "atk"), 100, "带标记的削弱被清、攻击回基础值");
      assert.equal(unit.effects.filter((e) => e.debuff).length, 0, "带标记的持续效果被清");
      assert.equal(B.state.statOf(unit, "mres"), -10, "没标记的修正不被误清");
    }
  }
];

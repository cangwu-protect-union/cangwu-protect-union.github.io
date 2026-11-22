/* M2 · 效果系统：19 个 op、持续效果计时、反射、打断、延迟结算 */
import assert from "node:assert/strict";

const B = globalThis.RPG6B;

const CHAR = {
  liuwenzhe: { id: "t-liuwenzhe", name: "刘文哲", occupation: "强攻手", side_job: "", atk: "125", def: "30", mres: "10", hp: "625", mp: "10", spd: "45" },
  lishuo: { id: "t-lishuo", name: "李硕", occupation: "粉碎者", side_job: "", atk: "65", def: "40", mres: "30", hp: "360", mp: "15", spd: "100" },
  jiangyuxuan: { id: "t-jiangyuxuan", name: "江雨轩", occupation: "盾卫", side_job: "", atk: "90", def: "70", mres: "0", hp: "910", mp: "5", spd: "35" },
  wangluor: { id: "t-wangluor", name: "王泺然", occupation: "重装", side_job: "嘲讽手", atk: "65", def: "15", mres: "60", hp: "855", mp: "3", spd: "50" },
  zhengwanwan: { id: "t-zhengwanwan", name: "郑湾湾", occupation: "斗士", side_job: "嘲讽手", atk: "120", def: "70", mres: "20", hp: "880", mp: "30", spd: "120" },
  dummy: { id: "t-dummy", name: "木桩", occupation: "强攻手", side_job: "", atk: "10", def: "0", mres: "0", hp: "9999", mp: "10", spd: "80" }
};

function mk(a, b, seed) {
  return B.battle.create({ seed: seed == null ? 20261114 : seed, a: a || CHAR.liuwenzhe, b: b || CHAR.dummy }).state;
}

function ctx(extra) {
  return Object.assign({ sourceUid: "a", targetUid: "b", skillId: "test", label: "测试" }, extra || {});
}

export const cases = [
  {
    name: "强扣不减免、不加击溃值、不加眩晕值",
    run() {
      const state = mk();
      const before = state.units[1].hp;
      B.effectOps.runOps(state, ctx(), [{ op: "directLoss", value: 100 }], []);
      assert.equal(state.units[1].hp, before - 100);
      assert.equal(state.units[1].breakValue, 0);
      assert.equal(state.units[1].stunValue, 0);
    }
  },
  {
    name: "Buff 伤害不加击溃值、不清蓄力",
    run() {
      const state = mk(CHAR.liuwenzhe, CHAR.lishuo);
      const target = state.units[1];
      target.charge = { skillId: "x", amount: 2 };
      B.effectOps.runOps(state, ctx({ skillId: "dot" }), [{ op: "damage", type: "true", value: 50, fromBuff: true }], []);
      assert.equal(target.hp, 310);
      assert.equal(target.breakValue, 0);
      assert.notEqual(target.charge, null);
    }
  },
  {
    name: "持续效果：5 回合各结算一次，第 6 回合消失",
    run() {
      const state = mk(CHAR.liuwenzhe, CHAR.dummy);
      const startHp = state.units[1].hp;
      B.effectOps.runOps(state, ctx({ skillId: "yuzhou" }), [
        { op: "tick", duration: { unit: "standard", count: 5 }, unstoppable: true, label: "宇宙的奥秘", ops: [{ op: "directLoss", value: 100 }] }
      ], []);
      for (let i = 0; i < 5; i++) B.effectOps.roundEnd(state, []);
      assert.equal(state.units[1].hp, startHp - 500);
      assert.equal(state.units[1].effects.length, 0);
      B.effectOps.roundEnd(state, []);
      assert.equal(state.units[1].hp, startHp - 500);
    }
  },
  {
    name: "当回合挂上的持续效果，当回合结束就结算第一跳",
    run() {
      const state = mk();
      const startHp = state.units[1].hp;
      B.effectOps.runOps(state, ctx(), [
        { op: "tick", duration: { unit: "standard", count: 3 }, ops: [{ op: "directLoss", value: 30 }] }
      ], []);
      B.effectOps.roundEnd(state, []);
      assert.equal(state.units[1].hp, startHp - 30);
    }
  },
  {
    name: "持续 1 回合的 Debuff 在当回合结束就过期",
    run() {
      const state = mk();
      B.effectOps.runOps(state, ctx(), [{ op: "buff", kind: "fragile", percent: 75, duration: { unit: "standard", count: 1 } }], []);
      assert.equal(state.units[1].buffs.length, 1);
      B.effectOps.roundEnd(state, []);
      assert.equal(state.units[1].buffs.length, 0);
    }
  },
  {
    name: "四类 Buff 的乘算：脆弱叠加、坚强取最大",
    run() {
      const state = mk(CHAR.liuwenzhe, CHAR.lishuo);
      const a = state.units[0];
      const b = state.units[1];
      B.effectOps.runOps(state, ctx({ targetUid: "a" }), [{ op: "buff", kind: "brave", percent: 30, duration: 5 }], []);
      B.effectOps.runOps(state, ctx({ targetUid: "a" }), [{ op: "buff", kind: "panic", percent: 10, duration: 5 }], []);
      B.effectOps.runOps(state, ctx({ targetUid: "b" }), [
        { op: "buff", kind: "fragile", percent: 20, duration: 5 },
        { op: "buff", kind: "fragile", percent: 30, duration: 5 },
        { op: "buff", kind: "strong", percent: 40, duration: 5 },
        { op: "buff", kind: "strong", percent: 10, duration: 5 }
      ], []);
      const mul = B.rules.multiplier(a, b);
      assert.ok(Math.abs(mul - (1 + 0.3 - 0.1) * (1 + 0.2 + 0.3 - 0.4)) < 1e-9);
    }
  },
  {
    name: "反射：伤害归零，来源吃双倍并眩晕 3 回合",
    run() {
      const state = mk(CHAR.jiangyuxuan, CHAR.liuwenzhe);
      const tank = state.units[0];
      const attacker = state.units[1];
      tank.charge = { skillId: "feifei", amount: 1 };
      B.effectOps.runOps(state, ctx({ sourceUid: "a", targetUid: "a", skillId: "feifei" }), [{ op: "reflect", factor: 2, stunRounds: 3 }], []);
      B.damage.hit(state, { sourceUid: "b", targetUid: "a", type: "true", amount: 100 }, []);
      assert.equal(tank.hp, 910);
      assert.equal(attacker.hp, 425);
      assert.equal(B.state.hasStatus(attacker, "stun"), true);
      assert.equal(attacker.statuses.find((s) => s.kind === "stun").remain, 3);
    }
  },
  {
    name: "反射也把 Debuff 弹回来源",
    run() {
      const state = mk(CHAR.jiangyuxuan, CHAR.liuwenzhe);
      const tank = state.units[0];
      tank.charge = { skillId: "feifei", amount: 1 };
      B.effectOps.runOps(state, ctx({ sourceUid: "a", targetUid: "a", skillId: "feifei" }), [{ op: "reflect", factor: 2 }], []);
      B.effectOps.runOps(state, ctx({ sourceUid: "b", targetUid: "a", skillId: "debuff" }), [{ op: "buff", kind: "fragile", percent: 50, duration: 3 }], []);
      assert.equal(tank.buffs.length, 0);
      assert.equal(state.units[1].buffs.length, 1);
    }
  },
  {
    name: "打断：拆掉带「不可打断」的持续效果",
    run() {
      const state = mk(CHAR.zhengwanwan, CHAR.lishuo);
      const target = state.units[1];
      B.effectOps.runOps(state, ctx({ sourceUid: "b", targetUid: "b", skillId: "yuzhou" }), [
        { op: "tick", duration: 5, unstoppable: true, label: "宇宙的奥秘", ops: [{ op: "directLoss", value: 100 }] }
      ], []);
      assert.equal(target.effects.length, 1);
      B.effectOps.runOps(state, ctx({ sourceUid: "a", targetUid: "b", skillId: "paihou" }), [{ op: "interrupt" }], []);
      assert.equal(target.effects.length, 0);
    }
  },
  {
    name: "延迟结算：到指定回合才触发，只触发一次",
    run() {
      const state = mk();
      const caster = state.units[0];
      const target = state.units[1];
      B.effectOps.runOps(state, ctx(), [{ op: "schedule", after: 2, ops: [{ op: "directLoss", value: 50 }] }], []);
      assert.equal(caster.scheduled[0].atRound, 3);
      B.effectOps.roundEnd(state, []);
      assert.equal(caster.scheduled.length, 1);
      state.round = 3;
      B.effectOps.roundEnd(state, []);
      assert.equal(target.hp, 9999 - 50);
      assert.equal(caster.scheduled.length, 0);
    }
  },
  {
    name: "五回合 245 加第 6 回合 100 群伤（三角板）",
    run() {
      const state = mk(CHAR.zhengwanwan, CHAR.dummy);
      const target = state.units[1];
      B.effectOps.runOps(state, ctx({ sourceUid: "a", targetUid: "b", skillId: "sanjiaoban" }), [
        { op: "tick", duration: 5, label: "三角板暴风雨", ops: [{ op: "damage", type: "true", value: 245, noBreak: true }] },
        { op: "schedule", after: 5, label: "三角板收尾", ops: [{ op: "damage", type: "true", value: 100, noBreak: true }] }
      ], []);
      for (let round = 1; round <= 5; round++) {
        state.round = round;
        B.effectOps.roundEnd(state, []);
      }
      assert.equal(target.hp, 9999 - 245 * 5);
      state.round = 6;
      B.effectOps.roundEnd(state, []);
      assert.equal(target.hp, 9999 - 245 * 5 - 100);
    }
  },
  {
    name: "骰子分支：按掷出的点数走对应 ops",
    run() {
      const state = mk(CHAR.liuwenzhe, CHAR.liuwenzhe);
      const cuts = [0, 0];
      for (let i = 0; i < 12; i++) {
        const s = mk(CHAR.liuwenzhe, CHAR.dummy, 100 + i);
        const events = [];
        B.effectOps.runOps(s, ctx({ sourceUid: "a", targetUid: "b" }), [{
          op: "dice",
          sides: 6,
          cases: [
            { in: [1, 3], ops: [{ op: "directLoss", value: 10 }] },
            { in: [4, 6], ops: [{ op: "directLoss", value: 20 }] }
          ]
        }], events);
        const roll = events.find((e) => e.type === "dice").value;
        const loss = 9999 - s.units[1].hp;
        assert.equal(loss, roll <= 3 ? 10 : 20);
        cuts[roll <= 3 ? 0 : 1] += 1;
      }
      assert.ok(cuts[0] > 0 && cuts[1] > 0, "两个分支都应被覆盖");
    }
  },
  {
    name: "面板修改：set 覆盖，add 相加，mul 最后乘",
    run() {
      const state = mk();
      const unit = state.units[1];
      assert.equal(B.state.statOf(unit, "atk"), 10);
      B.state.addMod(unit, { stat: "atk", mode: "add", value: 10, remain: 5 });
      B.state.addMod(unit, { stat: "atk", mode: "mul", value: 2, remain: 5 });
      assert.equal(B.state.statOf(unit, "atk"), 40);
      B.state.addMod(unit, { stat: "atk", mode: "set", value: 0, remain: 5 });
      assert.equal(B.state.statOf(unit, "atk"), 20);
    }
  },
  {
    name: "回血：按现有血量比例、取整到十位、再加 30（大聪明）",
    run() {
      const state = mk(CHAR.lishuo, CHAR.dummy);
      const self = state.units[0];
      self.hp = 200;
      B.effectOps.runOps(state, ctx({ sourceUid: "a", targetUid: "a" }), [{
        op: "heal",
        who: "self",
        value: { hpPercent: "self.current", percent: 40 },
        rounding: "ten",
        bonus: 30
      }], []);
      assert.equal(self.hp, 310);
    }
  },
  {
    name: "回血：按已损失血量比例、取整到个位（干饭人）",
    run() {
      const state = mk(CHAR.jiangyuxuan, CHAR.dummy);
      const self = state.units[0];
      self.hp = 500;
      B.effectOps.runOps(state, ctx({ sourceUid: "a", targetUid: "a" }), [{
        op: "heal",
        who: "self",
        value: { hpPercent: "self.lost", percent: 25 },
        rounding: "int"
      }], []);
      assert.equal(self.hp, 603);
    }
  },
  {
    name: "回血不超过上限",
    run() {
      const state = mk(CHAR.lishuo, CHAR.dummy);
      const self = state.units[0];
      self.hp = 350;
      B.effectOps.runOps(state, ctx({ sourceUid: "a", targetUid: "a" }), [{ op: "heal", who: "self", value: 500 }], []);
      assert.equal(self.hp, 360);
    }
  },
  {
    name: "清 Debuff 不动 Buff，也不动正向修正",
    run() {
      const state = mk(CHAR.zhengwanwan, CHAR.liuwenzhe);
      const self = state.units[0];
      B.effectOps.runOps(state, ctx({ sourceUid: "a", targetUid: "a" }), [
        { op: "buff", kind: "fragile", percent: 50, duration: 5 },
        { op: "buff", kind: "panic", percent: 20, duration: 5 },
        { op: "buff", kind: "brave", percent: 30, duration: 5 },
        { op: "status", kind: "stun", rounds: 3 },
        { op: "stat", stat: "atk", mode: "add", value: -20, duration: 5 }
      ], []);
      assert.equal(self.buffs.length, 3);
      assert.equal(self.mods.length, 1);
      B.effectOps.runOps(state, ctx({ sourceUid: "a", targetUid: "a" }), [{ op: "dispel", scope: "debuff" }], []);
      assert.equal(self.buffs.length, 1);
      assert.equal(self.buffs[0].kind, "brave");
      assert.equal(self.statuses.length, 0);
      assert.equal(self.mods.length, 0);
    }
  },
  {
    name: "蓝上限削减后当前蓝被压到新上限",
    run() {
      const state = mk(CHAR.liuwenzhe, CHAR.lishuo);
      const target = state.units[1];
      target.mp = 15;
      B.effectOps.runOps(state, ctx({ sourceUid: "a", targetUid: "b" }), [{ op: "maxMp", delta: -3 }], []);
      assert.equal(B.state.maxMpOf(target), 12, "蓝上限只取整到个位，不凑 5");
      assert.equal(target.mp, 12);
    }
  },
  {
    name: "条件：蓝不足、冷却中、蓄力不足三种提示",
    run() {
      const state = mk(CHAR.liuwenzhe, CHAR.lishuo);
      const unit = state.units[0];
      const skill = { id: "s1", name: "测", cost: { mp: 3 }, charge: 2, cooldown: 4 };
      unit.mp = 1;
      let check = B.conditions.evaluate(state, unit, skill);
      assert.equal(check.ok, false);
      assert.match(check.reason, /缺 2 蓝/);
      unit.mp = 5;
      unit.cooldowns.s1 = 1;
      state.round = 2;
      check = B.conditions.evaluate(state, unit, skill);
      assert.match(check.reason, /冷却/);
      delete unit.cooldowns.s1;
      check = B.conditions.evaluate(state, unit, skill);
      assert.equal(check.ok, true);
      assert.equal(check.needsCharge, true);
      assert.equal(check.canRelease, false);
      unit.charge = { skillId: "s1", amount: 2 };
      check = B.conditions.evaluate(state, unit, skill);
      assert.equal(check.needsCharge, false);
      assert.equal(check.canRelease, true);
    }
  },
  {
    name: "note 只留日志，不改状态；未知 op 直接报错",
    run() {
      const state = mk();
      const events = [];
      const before = B.state.hash(state);
      B.effectOps.runOps(state, ctx(), [{ op: "note", text: "无法打断" }], events);
      assert.equal(events[0].type, "note");
      assert.equal(B.state.hash(state), before);
      assert.throws(() => B.effectOps.runOps(state, ctx(), [{ op: "bogus" }], []), /未知的 op/);
    }
  },
  {
    name: "回放仍然稳定：带持续效果的一串动作",
    run() {
      const created = B.battle.create({ seed: 7, a: CHAR.liuwenzhe, b: CHAR.dummy });
      const init = B.state.clone(created.state);
      const actions = [
        { kind: "basic", type: "attack", target: "b" },
        { kind: "basic", type: "chargeMp" },
        { kind: "basic", type: "attack", target: "a" }
      ];
      let state = init;
      const committed = [];
      for (const action of actions) {
        const r = B.battle.apply(state, action);
        state = r.state;
        committed.push(r.committed);
      }
      const again = B.battle.replay(init, committed);
      assert.equal(B.state.hash(again.state), B.state.hash(state));
    }
  }
];

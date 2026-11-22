/* M1 · 内核：取整、三种伤害、速度条、行动队列、状态指纹 */
import assert from "node:assert/strict";

const B = globalThis.RPG6B;

export const CHAR = {
  liuwenzhe: { id: "t-liuwenzhe", name: "刘文哲", occupation: "强攻手", side_job: "", atk: "125", def: "30", mres: "10", hp: "625", mp: "10", spd: "45" },
  lishuo: { id: "t-lishuo", name: "李硕", occupation: "粉碎者", side_job: "", atk: "65", def: "40", mres: "30", hp: "360", mp: "15", spd: "100" },
  xieyuchen: { id: "t-xieyuchen", name: "谢雨辰", occupation: "冲锋手", side_job: "", atk: "100", def: "0", mres: "0", hp: "290", mp: "5", spd: "150" },
  jiangyuxuan: { id: "t-jiangyuxuan", name: "江雨轩", occupation: "盾卫", side_job: "", atk: "90", def: "70", mres: "0", hp: "910", mp: "5", spd: "35" },
  wangluor: { id: "t-wangluor", name: "王泺然", occupation: "重装", side_job: "嘲讽手", atk: "65", def: "15", mres: "60", hp: "855", mp: "3", spd: "50" },
  zhengwanwan: { id: "t-zhengwanwan", name: "郑湾湾", occupation: "斗士", side_job: "嘲讽手", atk: "120", def: "70", mres: "20", hp: "880", mp: "30", spd: "120" },
  yuzy: { id: "t-yuzy", name: "于梓越", occupation: "冲锋手", side_job: "", atk: "70", def: "10", mres: "0", hp: "320", mp: "2", spd: "120" },
  burst: { id: "t-burst", name: "爆发者样本", occupation: "爆发者", side_job: "", atk: "100", def: "10", mres: "10", hp: "900", mp: "10", spd: "45" },
  dummy: { id: "t-dummy", name: "木桩", occupation: "强攻手", side_job: "", atk: "10", def: "0", mres: "0", hp: "9999", mp: "10", spd: "80" }
};

function mk(a, b, seed) {
  return B.battle.create({ seed: seed == null ? 20261114 : seed, a: a, b: b });
}

export const cases = [
  {
    name: "round5 向上取整到 5 的倍数",
    run() {
      assert.equal(B.rules.round5(58.5), 60);
      assert.equal(B.rules.round5(2), 5);
      assert.equal(B.rules.round5(0), 0);
      assert.equal(B.rules.round5(120), 120);
      assert.equal(B.rules.round5(9.9), 10);
      assert.equal(B.rules.round5(-3), 0);
    }
  },
  {
    name: "三种伤害公式",
    run() {
      assert.equal(B.rules.phys(125, 40), 85);
      assert.equal(B.rules.magic(65, 10), 58.5);
      assert.equal(B.rules.trueDamage(320), 320);
      assert.equal(B.rules.phys(10, 40), 0);
    }
  },
  {
    name: "法伤按法抗百分比减免，越界收敛",
    run() {
      assert.equal(B.rules.magic(50, 100), 0);
      assert.equal(B.rules.magic(50, 120), 0);
      assert.equal(B.rules.magic(50, -10), 55);
      assert.equal(B.rules.magic(70, 30), 49);
    }
  },
  {
    name: "速度条：45 速的推演",
    run() {
      const r1 = B.rules.gaugeStep(100, 45, true);
      assert.deepEqual(r1, { gauge: 0, actions: 1 });
      const r2 = B.rules.gaugeStep(0, 45, false);
      assert.deepEqual(r2, { gauge: 45, actions: 0 });
      const r4 = B.rules.gaugeStep(90, 45, false);
      assert.deepEqual(r4, { gauge: 35, actions: 1 });
    }
  },
  {
    name: "速度条：150 速能连动两次",
    run() {
      assert.deepEqual(B.rules.gaugeStep(50, 150, false), { gauge: 0, actions: 2 });
      assert.deepEqual(B.rules.gaugeStep(0, 150, false), { gauge: 50, actions: 1 });
    }
  },
  {
    name: "开局：血量满、蓝 0、速度条扣光、速度低者先手",
    run() {
      const { state } = mk(CHAR.liuwenzhe, CHAR.lishuo);
      const a = state.units[0];
      assert.equal(a.hp, 625);
      assert.equal(a.mp, 0);
      assert.equal(a.gauge, 0);
      assert.equal(state.round, 1);
      assert.equal(state.turnUid, "a");
      assert.equal(a.actionsLeft, 1);
      assert.deepEqual(state.order, ["a", "b"]);
    }
  },
  {
    name: "普攻：125 攻打 40 防 = 85，加 1 击溃值、不加眩晕值",
    run() {
      const { state } = mk(CHAR.liuwenzhe, CHAR.lishuo);
      const r = B.battle.apply(state, { kind: "basic", type: "attack", target: "b" });
      const target = r.state.units[1];
      assert.equal(target.hp, 275);
      assert.equal(target.breakValue, 1);
      assert.equal(target.stunValue, 0, "默认伤害不计眩晕值");
      assert.equal(r.state.turnUid, "b");
      const dmg = r.events.find((e) => e.type === "damage");
      assert.equal(dmg.amount, 85);
    }
  },
  {
    name: "粉碎者普攻走法伤：65 攻打 10 法抗 = 60",
    run() {
      const { state } = mk(CHAR.liuwenzhe, CHAR.lishuo);
      const first = B.battle.apply(state, { kind: "basic", type: "attack", target: "b" });
      const second = B.battle.apply(first.state, { kind: "basic", type: "attack", target: "a" });
      const dmg = second.events.find((e) => e.type === "damage");
      assert.equal(dmg.damageType, "magic");
      assert.equal(dmg.amount, 60);
      assert.equal(second.state.units[0].hp, 565);
    }
  },
  {
    name: "行动用完就换人",
    run() {
      const { state } = mk(CHAR.liuwenzhe, CHAR.lishuo);
      const r = B.battle.apply(state, { kind: "basic", type: "attack", target: "b" });
      assert.equal(r.state.units[0].actionsLeft, 0);
      assert.equal(r.state.units[1].actionsLeft, 1);
      assert.equal(r.state.turnUid, "b");
    }
  },
  {
    name: "蓄蓝 +1 并消耗行动",
    run() {
      const { state } = mk(CHAR.liuwenzhe, CHAR.lishuo);
      const r = B.battle.apply(state, { kind: "basic", type: "chargeMp" });
      assert.equal(r.state.units[0].mp, 1);
      assert.equal(r.state.turnUid, "b");
    }
  },
  {
    name: "击溃值不足 3 不能击溃",
    run() {
      const { state } = mk(CHAR.liuwenzhe, CHAR.lishuo);
      state.units[1].breakValue = 2;
      assert.throws(() => B.battle.apply(state, { kind: "basic", type: "break", target: "b" }), /击溃值不足/);
    }
  },
  {
    name: "击溃值 3 造成 4 标准回合击溃，并把击溃值清零",
    run() {
      const { state } = mk(CHAR.liuwenzhe, CHAR.lishuo);
      state.units[1].breakValue = 3;
      const r = B.battle.apply(state, { kind: "basic", type: "break", target: "b" });
      const added = r.events.find((e) => e.type === "statusAdd" && e.kind === "break");
      assert.equal(added.remain, 4);
      assert.ok(r.state.units[1].statuses.some((s) => s.kind === "break"));
      assert.equal(B.state.canAct(r.state.units[1]), false);
      assert.equal(r.state.units[1].breakValue, 0);
    }
  },
  {
    name: "击溃状态期间击溃值固定为 0，伤害也不加",
    run() {
      const { state } = mk(CHAR.liuwenzhe, CHAR.lishuo);
      state.units[1].breakValue = 5;
      B.state.enterBreak(state.units[1], 8, "test", "击溃");
      assert.equal(state.units[1].breakValue, 0);
      for (let i = 0; i < 3; i++) {
        B.damage.hit(state, { sourceUid: "a", targetUid: "b", type: "true", amount: 10 }, []);
      }
      assert.equal(state.units[1].breakValue, 0);
      assert.equal(state.units[1].stunValue, 0, "默认伤害不计眩晕值");
    }
  },
  {
    name: "击溃状态结束后击溃值从 0 重新累计",
    run() {
      const { state } = mk(CHAR.liuwenzhe, CHAR.lishuo);
      const target = state.units[1];
      target.breakValue = 3;
      B.state.enterBreak(target, 2, "test", "击溃");
      target.statuses = [];
      B.damage.hit(state, { sourceUid: "a", targetUid: "b", type: "true", amount: 10 }, []);
      assert.equal(target.breakValue, 1);
    }
  },
  {
    name: "击溃值默认封顶 5；眩晕值只在 damage 标了 addStun 时才加",
    run() {
      const { state } = mk(CHAR.liuwenzhe, CHAR.dummy);
      for (let i = 0; i < 6; i++) {
        B.damage.hit(state, { sourceUid: "a", targetUid: "b", type: "phys", amount: 1 }, []);
      }
      assert.equal(state.units[1].breakValue, 5);
      assert.equal(state.units[1].stunValue, 0, "默认伤害不计眩晕值");
      for (let i = 0; i < 6; i++) {
        B.damage.hit(state, { sourceUid: "a", targetUid: "b", type: "phys", amount: 1, noBreak: true, addStun: true }, []);
      }
      assert.equal(state.units[1].stunValue, 5, "addStun 的伤害计眩晕值，封顶 5");
    }
  },
  {
    name: "眩晕时防御与法抗视为 0",
    run() {
      const { state } = mk(CHAR.liuwenzhe, CHAR.lishuo);
      const target = state.units[1];
      assert.equal(B.state.defOf(target), 40);
      B.state.addStatus(target, { kind: "stun", remain: 3 });
      assert.equal(B.state.defOf(target), 0);
      assert.equal(B.state.mresOf(target), 0);
      assert.equal(B.state.canAct(target), false);
    }
  },
  {
    name: "重装蓄力不被伤害打断，强攻手会被打断",
    run() {
      const tank = mk(CHAR.wangluor, CHAR.liuwenzhe).state;
      tank.units[0].charge = { skillId: "x", amount: 1 };
      B.damage.hit(tank, { sourceUid: "b", targetUid: "a", type: "true", amount: 100 }, []);
      assert.notEqual(tank.units[0].charge, null);

      const fighter = mk(CHAR.liuwenzhe, CHAR.lishuo).state;
      fighter.units[0].charge = { skillId: "x", amount: 1 };
      B.damage.hit(fighter, { sourceUid: "b", targetUid: "a", type: "true", amount: 100 }, []);
      assert.equal(fighter.units[0].charge, null);
    }
  },
  {
    name: "嘲讽合计：重装+嘲讽手 4、斗士+嘲讽手 2、冲锋手 1",
    run() {
      assert.equal(B.state.makeUnit(CHAR.wangluor, "a").taunt, 4);
      assert.equal(B.state.makeUnit(CHAR.zhengwanwan, "a").taunt, 2);
      assert.equal(B.state.makeUnit(CHAR.yuzy, "a").taunt, 1);
      assert.equal(B.state.makeUnit(CHAR.lishuo, "a").taunt, 0);
    }
  },
  {
    name: "嘲讽手开局 0 蓝，每个自身回合 +1",
    run() {
      const { state } = mk(CHAR.wangluor, CHAR.lishuo);
      assert.equal(state.units[0].mp, 1);
      const r = B.battle.apply(state, { kind: "basic", type: "chargeMp" });
      assert.equal(r.state.units[0].mp, 2);
    }
  },
  {
    name: "爆发者每个角色回合 2 点行动",
    run() {
      const { state } = mk(CHAR.burst, CHAR.lishuo);
      assert.equal(state.units[0].actionsLeft, 2);
      const r1 = B.battle.apply(state, { kind: "basic", type: "attack", target: "b" });
      assert.equal(r1.state.turnUid, "a");
      assert.equal(r1.state.units[0].actionsLeft, 1);
      const r2 = B.battle.apply(r1.state, { kind: "basic", type: "attack", target: "b" });
      assert.equal(r2.state.turnUid, "b");
    }
  },
  {
    name: "斗士半血以下攻防速 +50%，结果向下取 5 的倍数",
    run() {
      const unit = B.state.makeUnit(CHAR.zhengwanwan, "a");
      assert.equal(B.state.statOf(unit, "atk"), 120);
      unit.hp = 500;
      assert.equal(B.state.statOf(unit, "atk"), 120);
      unit.hp = 400;
      assert.equal(B.state.statOf(unit, "atk"), 180);
      assert.equal(B.state.statOf(unit, "def"), 105);
      assert.equal(B.state.statOf(unit, "spd"), 180);
      assert.equal(B.state.statOf(unit, "mres"), 20, "半血加成不碰法抗");

      const heavy = B.state.makeUnit({
        id: "t-heavy", name: "重甲", occupation: "斗士", side_job: "",
        atk: "210", def: "105", mres: "0", hp: "200", mp: "5", spd: "100"
      }, "c");
      heavy.hp = 90;
      assert.equal(B.state.statOf(heavy, "def"), 155, "105×1.5=157.5，下取到 5 的倍数");
    }
  },
  {
    name: "同速开局用种子定先后，且可复现",
    run() {
      const x = { ...CHAR.dummy, id: "x", name: "甲" };
      const y = { ...CHAR.dummy, id: "y", name: "乙" };
      const orders = new Set();
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const s1 = mk(x, y, seed).state;
        const s2 = mk(x, y, seed).state;
        assert.deepEqual(s1.order, s2.order);
        orders.add(s1.order.join(""));
      }
      assert.equal(orders.size, 2);
    }
  },
  {
    name: "深拷贝互不影响，指纹随状态变化",
    run() {
      const { state } = mk(CHAR.liuwenzhe, CHAR.lishuo);
      const copy = B.state.clone(state);
      assert.equal(B.state.hash(copy), B.state.hash(state));
      copy.units[0].hp -= 5;
      assert.notEqual(B.state.hash(copy), B.state.hash(state));
      assert.equal(state.units[0].hp, 625);
    }
  },
  {
    name: "回放：同一串动作算出同一状态",
    run() {
      const created = mk(CHAR.liuwenzhe, CHAR.lishuo);
      const init = B.state.clone(created.state);
      const actions = [
        { kind: "basic", type: "attack", target: "b" },
        { kind: "basic", type: "attack", target: "a" },
        { kind: "basic", type: "chargeMp" }
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
      assert.equal(again.hashes.length, actions.length + 1);
    }
  },
  {
    name: "非法动作直接报错，不产生半截状态",
    run() {
      const { state } = mk(CHAR.liuwenzhe, CHAR.lishuo);
      const before = B.state.hash(state);
      assert.throws(() => B.battle.apply(state, { kind: "basic", type: "attack", target: "a" }), /不能以自己为目标/);
      assert.throws(() => B.battle.apply(state, { kind: "basic", type: "attack", target: "c" }), /目标非法/);
      assert.throws(() => B.battle.apply(state, { kind: "skill", skillId: "nope" }), /技能不存在/);
      assert.equal(B.state.hash(state), before);
    }
  }
];

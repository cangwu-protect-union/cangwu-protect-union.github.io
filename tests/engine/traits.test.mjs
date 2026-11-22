/* M3 · 职业与副业：8 主业 + 6 副业，全部按职业介绍表落地 */
import assert from "node:assert/strict";

const B = globalThis.RPG6B;

const CHAR = {
  liuwenzhe: { id: "t-lwz", name: "刘文哲", occupation: "强攻手", side_job: "", atk: "125", def: "30", mres: "10", hp: "625", mp: "10", spd: "45" },
  lishuo: { id: "t-ls", name: "李硕", occupation: "粉碎者", side_job: "", atk: "65", def: "40", mres: "30", hp: "360", mp: "15", spd: "100" },
  xieyuchen: { id: "t-xyc", name: "谢雨辰", occupation: "冲锋手", side_job: "", atk: "100", def: "0", mres: "0", hp: "290", mp: "5", spd: "150" },
  jiangyuxuan: { id: "t-jyx", name: "江雨轩", occupation: "盾卫", side_job: "", atk: "90", def: "70", mres: "0", hp: "910", mp: "5", spd: "35" },
  wangluor: { id: "t-wlr", name: "王泺然", occupation: "重装", side_job: "嘲讽手", atk: "65", def: "15", mres: "60", hp: "855", mp: "3", spd: "50" },
  zhengwanwan: { id: "t-zww", name: "郑湾湾", occupation: "斗士", side_job: "嘲讽手", atk: "120", def: "70", mres: "20", hp: "880", mp: "30", spd: "120" },
  yuzy: { id: "t-yzy", name: "于梓越", occupation: "冲锋手", side_job: "", atk: "70", def: "10", mres: "0", hp: "320", mp: "2", spd: "120" },
  healer: { id: "t-healer", name: "医师样本", occupation: "医师", side_job: "", atk: "130", def: "10", mres: "10", hp: "1200", mp: "10", spd: "60" },
  bomber: { id: "t-bomber", name: "爆破手样本", occupation: "强攻手", side_job: "爆破手", atk: "100", def: "10", mres: "10", hp: "700", mp: "10", spd: "40" },
  dummy: { id: "t-dummy", name: "木桩", occupation: "强攻手", side_job: "", atk: "10", def: "0", mres: "0", hp: "9999", mp: "10", spd: "80" }
};

function unit(char) {
  return B.state.makeUnit(char, "a");
}

export const cases = [
  {
    name: "8 个主业的普攻类型",
    run() {
      assert.equal(unit(CHAR.jiangyuxuan).trait.basicType, "phys");
      assert.equal(unit(CHAR.wangluor).trait.basicType, "magic");
      assert.equal(unit(CHAR.liuwenzhe).trait.basicType, "phys");
      assert.equal(unit(CHAR.lishuo).trait.basicType, "magic");
      assert.equal(unit(CHAR.xieyuchen).trait.basicType, "phys");
      assert.equal(unit(CHAR.healer).trait.basicType, "magic");
    }
  },
  {
    name: "8 个主业的嘲讽与行动数",
    run() {
      assert.deepEqual(Object.keys(B.traits.JOBS).sort(), ["冲锋手", "医师", "盾卫", "粉碎者", "爆发者", "强攻手", "斗士", "重装"].sort());
      assert.equal(unit(CHAR.jiangyuxuan).taunt, 2);
      assert.equal(unit(CHAR.wangluor).taunt, 4);
      assert.equal(unit(CHAR.liuwenzhe).taunt, 1);
      assert.equal(unit(CHAR.lishuo).taunt, 0);
      assert.equal(unit(CHAR.healer).taunt, 1);
      assert.equal(B.traits.actionsPerTurn({ trait: { actionsPerTurn: 2 } }), 2);
      assert.equal(B.traits.actionsPerTurn({ trait: {} }), 1);
    }
  },
  {
    name: "6 个副业的嘲讽与开局蓝",
    run() {
      const flag = unit({ ...CHAR.dummy, occupation: "强攻手", side_job: "执旗手" });
      assert.equal(flag.taunt, 0);
      assert.equal(flag.mp, 2);
      const breaker = unit({ ...CHAR.dummy, side_job: "破阵师" });
      assert.equal(breaker.taunt, 0);
      assert.equal(breaker.mp, 2);
      const summoner = unit({ ...CHAR.dummy, side_job: "召唤师" });
      assert.equal(summoner.taunt, 0);
      assert.equal(summoner.mp, 2);
      const bomber = unit(CHAR.bomber);
      assert.equal(bomber.taunt, 2);
      const shooter = unit({ ...CHAR.dummy, occupation: "盾卫", side_job: "射手" });
      assert.equal(shooter.taunt, 0);
      assert.equal(shooter.trait.ignoreTaunt, true);
      const taunter = unit(CHAR.zhengwanwan);
      assert.equal(taunter.taunt, 2);
      assert.equal(taunter.mp, 0);
    }
  },
  {
    name: "副业开局蓝为负时兜底为 0",
    run() {
      const taunter = unit({ ...CHAR.dummy, occupation: "强攻手", side_job: "嘲讽手" });
      assert.equal(taunter.mp, 0);
    }
  },
  {
    name: "七名角色的嘲讽合计",
    run() {
      const expect = [
        [CHAR.wangluor, 4],
        [CHAR.zhengwanwan, 2],
        [CHAR.jiangyuxuan, 2],
        [CHAR.liuwenzhe, 1],
        [CHAR.xieyuchen, 1],
        [CHAR.yuzy, 1],
        [CHAR.lishuo, 0]
      ];
      for (const [char, taunt] of expect) {
        assert.equal(unit(char).taunt, taunt, char.name);
      }
    }
  },
  {
    name: "盾卫与重装的蓄力都不因为伤害被打断",
    run() {
      assert.equal(B.traits.chargeUnbreakable(unit(CHAR.wangluor)), true);
      assert.equal(B.traits.chargeUnbreakable(unit(CHAR.jiangyuxuan)), true);
      assert.equal(B.traits.chargeUnbreakable(unit(CHAR.liuwenzhe)), false);
    }
  },
  {
    name: "蓄力抗打断：盾卫/重装受伤后力还在，强攻手被清空",
    run() {
      const shield = B.battle.create({ seed: 3, a: CHAR.jiangyuxuan, b: CHAR.liuwenzhe }).state;
      shield.units[0].charge = { skillId: "x", amount: 2 };
      const shieldEvents = [];
      B.damage.hit(shield, { sourceUid: "b", targetUid: "a", type: "true", amount: 10 }, shieldEvents);
      assert.deepEqual(shield.units[0].charge, { skillId: "x", amount: 2 });
      assert.equal(shieldEvents.some((e) => e.type === "chargeLost"), false);

      const heavy = B.battle.create({ seed: 3, a: CHAR.wangluor, b: CHAR.liuwenzhe }).state;
      heavy.units[0].charge = { skillId: "x", amount: 2 };
      B.damage.hit(heavy, { sourceUid: "b", targetUid: "a", type: "true", amount: 10 }, []);
      assert.deepEqual(heavy.units[0].charge, { skillId: "x", amount: 2 });

      const attacker = B.battle.create({ seed: 3, a: CHAR.liuwenzhe, b: CHAR.jiangyuxuan }).state;
      attacker.units[0].charge = { skillId: "x", amount: 2 };
      const attackerEvents = [];
      B.damage.hit(attacker, { sourceUid: "b", targetUid: "a", type: "true", amount: 10 }, attackerEvents);
      assert.equal(attacker.units[0].charge, null);
      assert.equal(attackerEvents.some((e) => e.type === "chargeLost"), true);
    }
  },
  {
    name: "医师普攻自己：真伤并回复同等血量",
    run() {
      const { state } = B.battle.create({ seed: 3, a: CHAR.healer, b: CHAR.dummy });
      assert.equal(state.turnUid, "a");
      const r = B.battle.apply(state, { kind: "basic", type: "attack", target: "a" });
      const dmg = r.events.find((e) => e.type === "damage");
      const heal = r.events.find((e) => e.type === "heal");
      assert.equal(dmg.damageType, "true");
      assert.equal(dmg.amount, 130);
      assert.equal(heal.amount, 130);
      assert.equal(r.state.units[0].hp, 1200);
    }
  },
  {
    name: "医师普攻敌人仍是法伤",
    run() {
      const { state } = B.battle.create({ seed: 3, a: CHAR.healer, b: CHAR.lishuo });
      const r = B.battle.apply(state, { kind: "basic", type: "attack", target: "b" });
      const dmg = r.events.find((e) => e.type === "damage");
      assert.equal(dmg.damageType, "magic");
      assert.equal(dmg.amount, 95);
    }
  },
  {
    name: "爆破手普攻按技能处理：力不足时蓄力，够了才打",
    run() {
      const first = B.battle.create({ seed: 5, a: CHAR.bomber, b: CHAR.dummy }).state;
      const r1 = B.battle.apply(first, { kind: "basic", type: "attack", target: "b" });
      assert.equal(r1.state.units[1].hp, 9999);
      assert.deepEqual(r1.state.units[0].charge, { skillId: "basic.attack", amount: 1 });
      assert.equal(r1.committed.charged, true);

      const second = B.battle.create({ seed: 5, a: CHAR.bomber, b: CHAR.dummy }).state;
      second.units[0].charge = { skillId: "basic.attack", amount: 1 };
      second.units[0].flags.chargedThisTurn = true;
      const r2 = B.battle.apply(second, { kind: "basic", type: "attack", target: "b" });
      assert.equal(r2.state.units[1].hp, 9999 - 100);
      assert.equal(r2.state.units[0].charge, null);
      assert.equal(r2.committed.charged, false);
    }
  },
  {
    name: "斗士半血加成只影响攻防速，不碰法抗",
    run() {
      const zww = unit(CHAR.zhengwanwan);
      zww.hp = 400;
      assert.equal(B.state.statOf(zww, "atk"), 180);
      assert.equal(B.state.statOf(zww, "def"), 105);
      assert.equal(B.state.statOf(zww, "spd"), 180);
      assert.equal(B.state.statOf(zww, "mres"), 20);
      assert.equal(B.state.statOf(zww, "maxHp"), 880);
    }
  },
  {
    name: "未知职业不崩，退化为基础值并标记 known=false",
    run() {
      const odd = unit({ ...CHAR.dummy, occupation: "未知职业", side_job: "" });
      assert.equal(odd.trait.known, false);
      assert.equal(odd.taunt, 0);
      assert.equal(odd.trait.basicType, "phys");
      assert.equal(B.traits.actionsPerTurn(odd), 1);
    }
  },
  {
    name: "嘲讽手每自身回合回蓝、其他职业没有",
    run() {
      const { state } = B.battle.create({ seed: 9, a: CHAR.wangluor, b: CHAR.lishuo });
      assert.equal(state.units[0].mp, 1);
      const r = B.battle.apply(state, { kind: "basic", type: "attack", target: "b" });
      const next = r.state;
      assert.equal(next.units[0].mp, 1);
      assert.equal(next.units[1].mp, 0);
    }
  }
];

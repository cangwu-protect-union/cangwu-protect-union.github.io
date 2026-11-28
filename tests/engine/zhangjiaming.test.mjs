/* 张家铭·卫委壮观：每段伤害主动闪避（花防/法抗）、普攻群攻 */
import assert from "node:assert/strict";

const B = globalThis.RPG6B;
const LIB = globalThis.RPG6_SKILLS;
B.skills.load(LIB);

const ZHANGJIAMING = {
  id: "t-zhangjiaming",
  name: "张家铭",
  gender: "男",
  occupation: "爆破手",
  side_job: "强攻手",
  atk: "130",
  def: "60",
  mres: "20",
  hp: "700",
  mp: "5",
  spd: "40",
  skills: [
    { name: "小行星撞击", condition: "2蓄力" },
    { name: "塞进垃圾桶", condition: "1蓝3蓄力" },
    { name: "秋风扫落叶", condition: "1蓝1蓄力" },
    { name: "卫委壮观", condition: "被动" }
  ]
};

const DUMMY = {
  id: "t-dummy",
  name: "木桩",
  gender: "男",
  occupation: "强攻手",
  side_job: "",
  atk: "200",
  def: "0",
  mres: "0",
  hp: "9999",
  mp: "10",
  spd: "80",
  skills: []
};

function mk(seed) {
  return B.battle.create({ seed: seed == null ? 3 : seed, a: ZHANGJIAMING, b: DUMMY }).state;
}

/* 直接换手：让指定 uid 行动，绕过速度条，便于逐次验证受击询问 */
function forceTurn(state, uid) {
  state.turnUid = uid;
  state.queue = [];
  B.state.unitOf(state, uid).actionsLeft = 1;
  return state;
}

function dummyHit(state) {
  forceTurn(state, "b");
  return B.battle.apply(state, { kind: "basic", type: "attack", target: "a" });
}

function respond(state, choice) {
  const pend = state.pendingResponse;
  return B.battle.apply(state, { kind: "respond", id: pend.id, uid: pend.responderUid, choice: choice });
}

function optionKeys(pend) {
  return (pend.options || []).map(function (opt) { return opt.key; });
}

/* 独立技能库：测试多段/群攻/守卫，张家铭技能仍用真实数据 */
const MULTI_LIB = {
  version: LIB.version,
  marks: LIB.marks,
  summons: LIB.summons,
  panels: LIB.panels || {},
  basicAtk: LIB.basicAtk || {},
  characters: Object.assign({}, LIB.characters, {
    "测试多段": [
      {
        id: "test.multi",
        name: "测试多段",
        conditionText: "1蓝",
        cost: { mp: 1 },
        charge: 0,
        cooldown: 0,
        target: "enemy",
        ops: [{ op: "damage", who: "target", type: "true", value: 10, times: 2, noBreak: true }]
      },
      {
        id: "test.multi5",
        name: "测试五段",
        conditionText: "1蓝",
        cost: { mp: 1 },
        charge: 0,
        cooldown: 0,
        target: "enemy",
        ops: [{ op: "damage", who: "target", type: "true", value: 10, times: 5, noBreak: true }]
      },
      {
        id: "test.hit1",
        name: "测试单击",
        conditionText: "1蓝",
        cost: { mp: 1 },
        charge: 0,
        cooldown: 0,
        target: "enemy",
        ops: [{ op: "damage", who: "target", type: "phys", value: 100, noBreak: true }]
      },
      {
        id: "test.dot",
        name: "测试持续伤害",
        conditionText: "1蓝",
        cost: { mp: 1 },
        charge: 0,
        cooldown: 0,
        target: "enemy",
        ops: [{
          op: "tick",
          duration: { unit: "standard", count: 3 },
          label: "测试DoT",
          ops: [{ op: "damage", who: "target", type: "true", value: 10, noBreak: true }]
        }]
      }
    ],
    "测试群攻": [
      {
        id: "test.group",
        name: "测试群攻",
        conditionText: "被动",
        passive: true,
        target: "self",
        ops: [],
        basicGroupWhen: [{ stat: "def", gt: 0 }]
      },
      {
        id: "test.groupHit",
        name: "测试群攻命中",
        conditionText: "被动",
        passive: true,
        target: "self",
        ops: [],
        hooks: { basicHit: [{ op: "directLoss", who: "target", value: 30 }] }
      }
    ],
    "测试守卫": [
      {
        id: "test.guardDodge",
        name: "测试闪避",
        conditionText: "被动",
        passive: true,
        target: "self",
        ops: [],
        activeDodge: { costDef: 15, costMres: 10 }
      },
      {
        id: "test.guardRoll",
        name: "测试掷骰",
        conditionText: "被动",
        passive: true,
        target: "self",
        ops: [],
        rollDodge: { sides: 6, values: [1, 2, 3, 4, 5, 6] }
      }
    ]
  })
};

const MULTI_CHAR = {
  id: "t-multi",
  name: "测试多段",
  gender: "男",
  occupation: "强攻手",
  side_job: "",
  atk: "10",
  def: "0",
  mres: "0",
  hp: "1000",
  mp: "10",
  spd: "10"
};

const GROUP_CHAR = {
  id: "t-group",
  name: "测试群攻",
  gender: "男",
  occupation: "强攻手",
  side_job: "",
  atk: "100",
  def: "60",
  mres: "20",
  hp: "1000",
  mp: "10",
  spd: "10"
};

const GUARD_CHAR = {
  id: "t-guard",
  name: "测试守卫",
  gender: "男",
  occupation: "强攻手",
  side_job: "",
  atk: "10",
  def: "60",
  mres: "20",
  hp: "1000",
  mp: "10",
  spd: "40"
};

function withMultiLib(fn) {
  B.skills.load(MULTI_LIB);
  try {
    return fn();
  } finally {
    B.skills.load(LIB);
  }
}

export const cases = [
  {
    name: "卫委壮观·每段伤害都问：挂起不扣行动/血/蓝，选项含 def/mres/none，选不闪后正常扣血",
    run() {
      const init = mk();
      const first = dummyHit(init);
      assert.equal(first.pending, true);
      const pend = first.state.pendingResponse;
      assert.equal(pend.kind, "dodge");
      assert.deepEqual(optionKeys(pend), ["def", "mres", "none"]);
      assert.equal(pend.defaultChoice, "none");
      assert.equal(first.state.units[1].actionsLeft, 1, "挂起不消耗行动");
      assert.equal(first.state.units[0].hp, 700, "挂起不扣血");
      assert.equal(first.state.units[0].mp, 0, "挂起不扣蓝");
      assert.equal(first.state.units[1].hp, 9999);

      const done = respond(first.state, "none");
      assert.equal(done.pending, undefined);
      assert.equal(done.state.units[0].hp, 700 - 140, "木桩 200 攻 − 60 防 = 140 普伤");
    }
  },
  {
    name: "卫委壮观·花防御闪避：防御永久 −15、血不变、事件 dodge、不加击溃值；连扣到不足后选项不再含 def",
    run() {
      let state = mk();
      for (let k = 0; k < 4; k++) {
        const first = dummyHit(state);
        assert.equal(first.pending, true);
        const done = respond(first.state, "def");
        assert.equal(done.state.units[0].hp, 700, "闪避后不扣血");
        assert.equal(B.state.defOf(done.state.units[0]), 60 - 15 * (k + 1), "防御永久递减");
        assert.equal(done.state.units[0].breakValue, 0, "取消该段不加击溃值");
        assert.ok(done.events.some((e) => e.type === "dodge"), "应记 dodge 事件");
        state = done.state;
      }
      assert.equal(B.state.defOf(state.units[0]), 0);
      const fifth = dummyHit(state);
      assert.equal(fifth.pending, true);
      assert.deepEqual(optionKeys(fifth.state.pendingResponse), ["mres", "none"], "防御不足 15 后不再给 def");
    }
  },
  {
    name: "卫委壮观·花法抗闪避：法抗永久 −10、该段伤害取消",
    run() {
      const first = dummyHit(mk());
      assert.equal(first.pending, true);
      const done = respond(first.state, "mres");
      assert.equal(done.pending, undefined);
      assert.equal(B.state.mresOf(done.state.units[0]), 10);
      assert.equal(done.state.units[0].hp, 700, "伤害被取消");
      assert.equal(B.state.defOf(done.state.units[0]), 60, "防御没有变化");
      assert.ok(done.events.some((e) => e.type === "dodge"));
    }
  },
  {
    name: "卫委壮观·多段伤害：2 段连续挂起 resp1/resp2，各 respond 一次，回放指纹一致",
    run() {
      withMultiLib(() => {
        const init = B.battle.create({ seed: 5, a: MULTI_CHAR, b: ZHANGJIAMING }).state;
        init.units[0].mp = 10;
        assert.equal(init.turnUid, "a", "速度 10 的测试角色先动");
        const action = { kind: "skill", skillId: "test.multi", target: "b" };

        const first = B.battle.apply(init, action);
        assert.equal(first.pending, true);
        assert.equal(first.state.pendingResponse.id, "resp1");

        const second = respond(first.state, "none");
        assert.equal(second.pending, true);
        assert.equal(second.state.pendingResponse.id, "resp2");

        const third = respond(second.state, "none");
        assert.equal(third.pending, undefined);
        assert.equal(B.state.unitOf(third.state, "b").hp, 700 - 20, "2 段各 10 真伤");

        const actions = [first.committed, second.committed, third.committed];
        const replay = B.battle.replay(init, actions);
        assert.equal(B.state.hash(replay.state), B.state.hash(third.state));
      });
    }
  },
  {
    name: "卫委壮观·群攻：防/法抗不为 0 时普攻打敌方全体，普攻项 group=true",
    run() {
      const state = mk();
      const tomb = B.summons.create(state, "yangshuhan.tomb", state.units[1], [], {});
      assert.ok(tomb, "召唤物应创建成功");

      const charge = B.battle.apply(state, { kind: "basic", type: "attack", target: "b" });
      assert.equal(charge.state.units[0].charge.amount, 1, "第一次普攻是蓄力");
      forceTurn(charge.state, "a");
      const list = B.actions.list(charge.state);
      const attackItem = list.find((item) => item.type === "attack");
      assert.equal(attackItem.group, true, "普攻项应标记 group");

      const done = B.battle.apply(charge.state, { kind: "basic", type: "attack", target: "b" });
      assert.equal(done.committed.group, true);
      assert.ok(done.state.units[1].hp < 9999, "敌方英雄掉血");
      assert.ok(B.state.unitOf(done.state, tomb.uid).hp < 1200, "召唤物也掉血");
      assert.equal(done.state.units[0].charge, null, "蓄力已消费");
    }
  },
  {
    name: "卫委壮观·群攻：防御与法抗都降到 0 后普攻只打单体",
    run() {
      const state = mk();
      const tomb = B.summons.create(state, "yangshuhan.tomb", state.units[1], [], {});
      const zjm = state.units[0];
      B.state.addMod(zjm, { stat: "def", mode: "add", value: -60, remain: B.state.PERMANENT, source: "test", label: "测试" });
      B.state.addMod(zjm, { stat: "mres", mode: "add", value: -20, remain: B.state.PERMANENT, source: "test", label: "测试" });
      assert.equal(B.state.defOf(zjm), 0);
      assert.equal(B.state.mresOf(zjm), 0);
      zjm.charge = { skillId: "basic.attack", amount: 1 };
      forceTurn(state, "a");
      const attackItem = B.actions.list(state).find((item) => item.type === "attack");
      assert.equal(attackItem.group, false);

      const done = B.battle.apply(state, { kind: "basic", type: "attack", target: "b" });
      assert.equal(done.committed.hits, 1);
      assert.equal(done.committed.group, undefined);
      assert.ok(done.state.units[1].hp < 9999, "单体目标掉血");
      assert.equal(B.state.unitOf(done.state, tomb.uid).hp, 1200, "召唤物未受击");
    }
  },
  {
    name: "卫委壮观·回放：含 respond 的动作流重算，最终指纹一致",
    run() {
      const init = mk();
      /* 真实流程：张家铭先蓄力，把回合交给木桩 */
      const first = B.battle.apply(init, { kind: "basic", type: "attack", target: "b" });
      assert.equal(first.pending, undefined);
      const second = B.battle.apply(first.state, { kind: "basic", type: "attack", target: "a" });
      assert.equal(second.pending, true);
      const third = respond(second.state, "def");
      assert.equal(third.pending, undefined);

      const actions = [first.committed, second.committed, third.committed];
      assert.deepEqual(actions.map((a) => a.kind), ["basic", "basic", "respond"]);
      const replay = B.battle.replay(init, actions);
      assert.equal(replay.hashes.length, 4);
      assert.equal(B.state.hash(replay.state), B.state.hash(third.state));
    }
  },
  {
    name: "卫委壮观·属性不足不询问：防 <15、法抗 <10 时受击不再挂起",
    run() {
      const state = mk();
      const zjm = state.units[0];
      B.state.addMod(zjm, { stat: "def", mode: "add", value: -50, remain: B.state.PERMANENT, source: "test", label: "测试" });
      B.state.addMod(zjm, { stat: "mres", mode: "add", value: -15, remain: B.state.PERMANENT, source: "test", label: "测试" });
      assert.equal(B.state.defOf(zjm), 10);
      assert.equal(B.state.mresOf(zjm), 5);

      const result = dummyHit(state);
      assert.equal(result.pending, undefined);
      assert.equal(result.state.pendingResponse, null);
      assert.ok(result.state.units[0].hp < 700, "直接结算伤害");
      assert.equal(B.state.defOf(result.state.units[0]), 10, "攻击后防御不变");
      assert.equal(B.state.mresOf(result.state.units[0]), 5, "攻击后法抗不变");
    }
  },
  {
    name: "卫委壮观·跨标准回合持续伤害：每个标准回合都重新挂起，不复用上一回合响应",
    run() {
      withMultiLib(() => {
        const init = B.battle.create({ seed: 9, a: MULTI_CHAR, b: ZHANGJIAMING }).state;
        init.units[0].mp = 10;
        const cast = B.battle.apply(init, { kind: "skill", skillId: "test.dot", target: "b" });
        assert.equal(cast.pending, undefined);
        assert.equal(cast.state.units[1].effects.length, 1, "应挂上持续伤害");
        const pass = { kind: "basic", type: "pass" };
        const keys = [];
        let s = cast.state;
        let pendings = 0;
        for (let guard = 0; guard < 30 && pendings < 3; guard++) {
          if (s.pendingResponse) {
            const pend = s.pendingResponse;
            assert.equal(pend.kind, "dodge");
            assert.equal(pend.responderUid, "b");
            keys.push(pend.key);
            pendings += 1;
            s = respond(s, "none").state;
            continue;
          }
          if (!s.turnUid) break;
          s = B.battle.apply(s, pass).state;
        }
        assert.equal(pendings, 3, "应连续询问 3 次");
        assert.equal(new Set(keys).size, 3, "三次询问 key 应各不相同：" + keys.join(","));
        assert.equal(B.state.unitOf(s, "b").hp, 700 - 30, "3 个标准回合各 −10");
        assert.equal(B.state.unitOf(s, "b").effects.length, 0, "3 回合后持续伤害到期");
      });
    }
  },
  {
    name: "卫委壮观·固定反弹：反弹伤害也逐次询问，不复用上一段响应",
    run() {
      const init = mk();
      init.units[1].base.def = 30;
      init.units[1].reflectFixed = {
        charges: 2, value: 50, type: "magic", noBreak: true, label: "扣分!", skillId: "nihaokai.koufen"
      };
      init.units[0].charge = { skillId: "zhangjiaming.xiaoxingxing", amount: 2 };
      const cast = { kind: "skill", skillId: "zhangjiaming.xiaoxingxing", target: "b" };

      const first = B.battle.apply(init, cast);
      assert.equal(first.pending, true, "反弹伤害应触发询问");
      const key1 = first.state.pendingResponse.key;
      const after1 = respond(first.state, "none");
      assert.equal(after1.pending, undefined);
      assert.equal(after1.state.units[0].hp, 700 - 40, "反弹 50 法伤，法抗 20 → 40");

      const s = after1.state;
      forceTurn(s, "a");
      s.units[0].charge = { skillId: "zhangjiaming.xiaoxingxing", amount: 2 };
      const second = B.battle.apply(s, cast);
      assert.equal(second.pending, true, "第二段反弹应再次询问");
      assert.notEqual(second.state.pendingResponse.key, key1);
      const after2 = respond(second.state, "none");
      assert.equal(after2.state.units[0].hp, 700 - 80);
    }
  },
  {
    name: "卫委壮观·五段伤害：连续挂起 5 次，逐段 respond",
    run() {
      withMultiLib(() => {
        const init = B.battle.create({ seed: 11, a: MULTI_CHAR, b: ZHANGJIAMING }).state;
        init.units[0].mp = 10;
        let res = B.battle.apply(init, { kind: "skill", skillId: "test.multi5", target: "b" });
        let count = 0;
        while (res.pending) {
          count += 1;
          res = respond(res.state, "none");
        }
        assert.equal(count, 5);
        assert.equal(B.state.unitOf(res.state, "b").hp, 700 - 50);
      });
    }
  },
  {
    name: "卫委壮观·群攻：basicHit 被动只触发一次，不按目标数重复",
    run() {
      withMultiLib(() => {
        const state = B.battle.create({ seed: 12, a: GROUP_CHAR, b: DUMMY }).state;
        const tomb = B.summons.create(state, "yangshuhan.tomb", state.units[1], [], {});
        assert.ok(tomb, "召唤物应创建成功");
        assert.equal(state.turnUid, "a");
        const done = B.battle.apply(state, { kind: "basic", type: "attack", target: "b" });
        assert.equal(done.pending, undefined);
        assert.equal(done.committed.group, true);
        const losses = done.events.filter((e) => e.type === "directLoss");
        assert.equal(losses.length, 1, "basicHit 强扣只应触发一次");
        assert.equal(B.state.unitOf(done.state, "b").hp, 9999 - 100 - 30);
        assert.equal(B.state.unitOf(done.state, tomb.uid).hp, 1200 - 100);
      });
    }
  },
  {
    name: "卫委壮观·与防护层：选不闪继续走防护层，选闪避跳过防护层",
    run() {
      withMultiLib(() => {
        function setup() {
          const state = B.battle.create({ seed: 13, a: MULTI_CHAR, b: ZHANGJIAMING }).state;
          state.units[0].mp = 10;
          state.units[1].effects.push({
            id: "g1", remain: B.state.PERMANENT, unit: "standard", label: "测试护盾",
            skillId: "test.guard", sourceUid: "a", targetUid: "b", ops: [],
            guard: { remaining: 1, ops: [], blockedActionId: "" }
          });
          return state;
        }
        const hit = { kind: "skill", skillId: "test.hit1", target: "b" };

        const first = B.battle.apply(setup(), hit);
        assert.equal(first.pending, true);
        const none = respond(first.state, "none");
        assert.ok(none.events.some((e) => e.type === "guardBlock"), "选不闪应继续到防护层");
        assert.equal(none.state.units[1].hp, 700, "防护层挡住伤害");

        const first2 = B.battle.apply(setup(), hit);
        const def = respond(first2.state, "def");
        assert.ok(def.events.some((e) => e.type === "dodge"), "选防御应记 dodge");
        assert.ok(!def.events.some((e) => e.type === "guardBlock"), "选防御应在防护层之前返回");
        assert.equal(def.state.units[1].effects.length, 1, "防护层不被消耗");
        assert.equal(def.state.units[1].effects[0].guard.remaining, 1);
      });
    }
  },
  {
    name: "卫委壮观·与掷骰闪避：选不闪继续掷骰，选闪避跳过掷骰",
    run() {
      withMultiLib(() => {
        const hit = { kind: "skill", skillId: "test.hit1", target: "b" };
        function setup() {
          const state = B.battle.create({ seed: 14, a: MULTI_CHAR, b: GUARD_CHAR }).state;
          state.units[0].mp = 10;
          return state;
        }

        const first = B.battle.apply(setup(), hit);
        assert.equal(first.pending, true);
        const none = respond(first.state, "none");
        assert.ok(none.events.some((e) => e.type === "dice"), "选不闪应继续掷骰");
        assert.equal(none.state.units[1].hp, 1000, "掷骰永远闪避，血不变");

        const first2 = B.battle.apply(setup(), hit);
        const def = respond(first2.state, "def");
        assert.ok(!def.events.some((e) => e.type === "dice"), "选防御不应再掷骰");
        assert.equal(def.state.units[1].hp, 1000);
      });
    }
  },
  {
    name: "卫委壮观·群攻点敌方召唤物：跳过嘲讽限制，英雄与召唤物一起掉血；非群攻仍按嘲讽拒绝",
    run() {
      /* 群攻：张家铭 60 防 > 0，点嘲讽 0 的召唤物也应成功 */
      const state = mk();
      const tomb = B.summons.create(state, "yangshuhan.tomb", state.units[1], [], {});
      assert.ok(tomb, "召唤物应创建成功");
      assert.equal(tomb.taunt, 0);
      state.units[0].charge = { skillId: "basic.attack", amount: 1 };
      forceTurn(state, "a");
      const done = B.battle.apply(state, { kind: "basic", type: "attack", target: tomb.uid });
      assert.equal(done.pending, undefined);
      assert.equal(done.committed.group, true);
      assert.ok(B.state.unitOf(done.state, "b").hp < 9999, "敌方英雄应掉血");
      assert.ok(B.state.unitOf(done.state, tomb.uid).hp < 1200, "召唤物应掉血");

      /* 非群攻：防/法抗归 0 后点同一个召唤物，应被嘲讽拦下 */
      const state2 = mk();
      const tomb2 = B.summons.create(state2, "yangshuhan.tomb", state2.units[1], [], {});
      B.state.addMod(state2.units[0], { stat: "def", mode: "add", value: -60, remain: B.state.PERMANENT, source: "test", label: "测试" });
      B.state.addMod(state2.units[0], { stat: "mres", mode: "add", value: -20, remain: B.state.PERMANENT, source: "test", label: "测试" });
      assert.equal(B.state.defOf(state2.units[0]), 0);
      assert.equal(B.state.mresOf(state2.units[0]), 0);
      state2.units[0].charge = { skillId: "basic.attack", amount: 1 };
      forceTurn(state2, "a");
      assert.throws(
        () => B.battle.apply(state2, { kind: "basic", type: "attack", target: tomb2.uid }),
        /嘲讽最高/
      );
    }
  }
];

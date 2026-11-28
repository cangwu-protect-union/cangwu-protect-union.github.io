/* 响应框架：ask op、pendingResponse、respond 重放式恢复（battle-20）
   用独立技能库，不污染全局 RPG6_SKILLS；每条用例结束后恢复。 */
import assert from "node:assert/strict";

const B = globalThis.RPG6B;
const LIB = globalThis.RPG6_SKILLS;

const TEST_LIB = {
  characters: {
    "测试甲": [
      {
        id: "test.ask", name: "测试询问", conditionText: "1蓝", cost: { mp: 1 }, charge: 0, cooldown: 0, target: "enemy",
        ops: [
          {
            op: "ask", kind: "answer", key: "q", prompt: "选一个", options: ["甲", "乙"], default: "甲",
            then: [{ op: "heal", who: "self", value: 80 }],
            else: [{ op: "damage", who: "target", type: "true", value: 150 }]
          }
        ]
      },
      {
        id: "test.guess", name: "测试猜数", conditionText: "1蓝", cost: { mp: 1 }, charge: 0, cooldown: 0, target: "enemy",
        ops: [
          { op: "roll", key: "n", sides: 6 },
          {
            op: "ask", kind: "guess", key: "g", sides: 6, value: { counter: "n" }, prompt: "猜数", default: 0,
            then: [{ op: "heal", who: "self", value: 50 }],
            else: [{ op: "damage", who: "target", type: "true", value: 100 }]
          }
        ]
      },
      {
        id: "test.ask2", name: "测试双问", conditionText: "1蓝", cost: { mp: 1 }, charge: 0, cooldown: 0, target: "enemy",
        ops: [
          {
            op: "ask", kind: "answer", key: "q", options: ["甲", "乙"], default: "甲",
            then: [{ op: "heal", who: "self", value: 10 }],
            else: [{ op: "damage", who: "target", type: "true", value: 20 }]
          },
          {
            op: "ask", kind: "answer", key: "q", options: ["甲", "乙"], default: "甲",
            then: [{ op: "heal", who: "self", value: 30 }],
            else: [{ op: "damage", who: "target", type: "true", value: 40 }]
          }
        ]
      }
    ]
  },
  marks: {}, summons: {}, panels: {}, basicAtk: {}
};

const CHA = { id: "t-a", name: "测试甲", gender: "男", occupation: "强攻手", side_job: "", atk: "100", def: "0", mres: "0", hp: "1000", mp: "10", spd: "90" };
const CHB = { id: "t-b", name: "测试乙", gender: "男", occupation: "强攻手", side_job: "", atk: "100", def: "0", mres: "0", hp: "1000", mp: "10", spd: "100" };

export const CHAR = { tA: CHA, tB: CHB };

function withTestLib(fn) {
  B.skills.load(TEST_LIB);
  try {
    return fn();
  } finally {
    B.skills.load(LIB);
  }
}

/* 双方蓝都设成 10、测试甲先掉 100 血，便于验证回血与扣蓝 */
function mk() {
  const created = B.battle.create({ seed: 7, a: CHA, b: CHB });
  const state = created.state;
  state.units[0].mp = 10;
  state.units[1].mp = 10;
  state.units[0].hp = 900;
  return state;
}

const ASK = { kind: "skill", skillId: "test.ask", target: "b" };
const GUESS = { kind: "skill", skillId: "test.guess", target: "b" };
const ASK2 = { kind: "skill", skillId: "test.ask2", target: "b" };

function pendResponse(state) {
  const pend = state.pendingResponse;
  return { kind: "respond", id: pend.id, uid: pend.responderUid, choice: pend.defaultChoice };
}

export const cases = [
  {
    name: "ask 挂起：不扣行动/蓝/血，不写日志，actions 为空",
    run() {
      withTestLib(() => {
        const state = mk();
        const result = B.battle.apply(state, ASK);
        assert.equal(result.pending, true);
        const p = result.state.pendingResponse;
        assert.ok(p, "pendingResponse 应该存在");
        assert.equal(p.kind, "answer");
        assert.equal(p.responderUid, "b");
        assert.equal(p.requesterUid, "a");
        assert.deepEqual(p.options, ["甲", "乙"]);
        assert.equal(p.defaultChoice, "甲");
        assert.equal(result.state.units[0].actionsLeft, 1);
        assert.equal(result.state.units[0].mp, 10);
        assert.equal(result.state.units[1].hp, 1000);
        assert.equal(result.state.rng, state.rng);
        assert.equal(result.state.log.length, state.log.length);
        assert.deepEqual(B.actions.list(result.state), []);
        assert.throws(
          () => B.battle.apply(result.state, { kind: "basic", type: "attack", target: "b" }),
          /等待对方选择/
        );
        assert.equal(result.committed, ASK);
      });
    }
  },
  {
    name: "respond 校验：uid / id / 选项 / 无 pending",
    run() {
      withTestLib(() => {
        const init = mk();
        const pendingState = B.battle.apply(init, ASK).state;
        const id = pendingState.pendingResponse.id;
        assert.throws(
          () => B.battle.apply(pendingState, { kind: "respond", id: id, uid: "a", choice: "甲" }),
          /不该由你提交/
        );
        assert.throws(
          () => B.battle.apply(pendingState, { kind: "respond", id: "resp999", uid: "b", choice: "甲" }),
          /已经过期/
        );
        assert.throws(
          () => B.battle.apply(pendingState, { kind: "respond", id: id, uid: "b", choice: "丙" }),
          /选择不合法/
        );
        assert.throws(
          () => B.battle.apply(init, { kind: "respond", id: "resp1", uid: "b", choice: "甲" }),
          /没有需要提交的选择/
        );
      });
    }
  },
  {
    name: "respond「甲」：回血 80、扣 1 蓝、清 pending、actions 为 [skill, respond]",
    run() {
      withTestLib(() => {
        const init = mk();
        const first = B.battle.apply(init, ASK);
        const pend = first.state.pendingResponse;
        const second = B.battle.apply(first.state, {
          kind: "respond", id: pend.id, uid: pend.responderUid, choice: "甲"
        });
        assert.equal(second.pending, undefined);
        assert.equal(second.state.pendingResponse, null);
        assert.equal(second.state.units[0].hp, 980);
        assert.equal(second.state.units[1].hp, 1000);
        assert.equal(second.state.units[0].mp, 9);
        assert.equal(second.state.units[0].actionsLeft, 0);
        assert.equal(second.committed.kind, "respond");
        assert.equal(second.committed.choice, "甲");
        assert.equal(first.committed.kind, "skill");
        assert.deepEqual(second.state.responses[pend.key], "甲");
      });
    }
  },
  {
    name: "respond「乙」：对方受 150 真伤",
    run() {
      withTestLib(() => {
        const init = mk();
        const first = B.battle.apply(init, ASK);
        const pend = first.state.pendingResponse;
        const second = B.battle.apply(first.state, {
          kind: "respond", id: pend.id, uid: pend.responderUid, choice: "乙"
        });
        assert.equal(second.state.units[0].hp, 900);
        assert.equal(second.state.units[1].hp, 850);
        assert.equal(second.state.units[0].mp, 9);
      });
    }
  },
  {
    name: "回放：actions [skill, respond] 重算，最终指纹一致",
    run() {
      withTestLib(() => {
        const init = mk();
        const first = B.battle.apply(init, ASK);
        const second = B.battle.apply(first.state, pendResponse(first.state));
        const actions = [first.committed, second.committed];
        assert.deepEqual(actions.map((a) => a.kind), ["skill", "respond"]);
        const replay = B.battle.replay(init, actions);
        assert.equal(replay.hashes.length, 3);
        assert.equal(B.state.hash(replay.state), B.state.hash(second.state));
      });
    }
  },
  {
    name: "猜数：猜中回血 50，猜错受 100 真伤，回放一致",
    run() {
      withTestLib(() => {
        const init = mk();
        const probe = B.state.clone(init);
        const n = B.rng.dice(probe, 6);
        assert.ok(n >= 1 && n <= 6);
        const first = B.battle.apply(init, GUESS);
        assert.equal(first.pending, true);
        assert.equal(first.state.pendingResponse.kind, "guess");
        const pend = first.state.pendingResponse;
        const hit = B.battle.apply(first.state, {
          kind: "respond", id: pend.id, uid: pend.responderUid, choice: n
        });
        assert.equal(hit.state.units[0].hp, 950);
        assert.equal(hit.state.units[1].hp, 1000);
        assert.equal(B.state.unitOf(hit.state, "a").flags["ctr.n.b"], n);
        const replay = B.battle.replay(init, [first.committed, hit.committed]);
        assert.equal(B.state.hash(replay.state), B.state.hash(hit.state));

        const init2 = mk();
        const first2 = B.battle.apply(init2, GUESS);
        const pend2 = first2.state.pendingResponse;
        const wrong = n >= 6 ? 5 : n + 1;
        const miss = B.battle.apply(first2.state, {
          kind: "respond", id: pend2.id, uid: pend2.responderUid, choice: wrong
        });
        assert.equal(miss.state.units[0].hp, 900);
        assert.equal(miss.state.units[1].hp, 900);
        assert.throws(
          () => B.battle.apply(first2.state, {
            kind: "respond", id: pend2.id, uid: pend2.responderUid, choice: 7
          }),
          /选择不合法/
        );
      });
    }
  },
  {
    name: "resumeAction 键序不同不影响指纹",
    run() {
      withTestLib(() => {
        const init = mk();
        const pendingState = B.battle.apply(init, ASK).state;
        const one = B.state.clone(pendingState);
        const two = B.state.clone(pendingState);
        one.pendingResponse.resumeAction = { kind: "skill", skillId: "test.ask", target: "b" };
        two.pendingResponse.resumeAction = { target: "b", skillId: "test.ask", kind: "skill" };
        assert.equal(B.state.hash(one), B.state.hash(two));
        const other = B.state.clone(pendingState);
        other.pendingResponse.resumeAction = { kind: "skill", skillId: "test.guess", target: "b" };
        assert.notEqual(B.state.hash(one), B.state.hash(other));
      });
    }
  },
  {
    name: "同一动作两个同 key 的 ask：依次挂起 resp1/resp2，各执行一次",
    run() {
      withTestLib(() => {
        const init = mk();
        const first = B.battle.apply(init, ASK2);
        assert.equal(first.pending, true);
        assert.equal(first.state.pendingResponse.id, "resp1");
        assert.ok(first.state.pendingResponse.key.slice(-3) === ":a1");
        const second = B.battle.apply(first.state, pendResponse(first.state));
        assert.equal(second.pending, true);
        assert.equal(second.state.pendingResponse.id, "resp2");
        assert.ok(second.state.pendingResponse.key.slice(-3) === ":a2");
        assert.equal(Object.keys(second.state.responses).length, 1);
        const third = B.battle.apply(second.state, pendResponse(second.state));
        assert.equal(third.pending, undefined);
        assert.equal(third.state.pendingResponse, null);
        assert.equal(third.state.units[0].hp, 940);
        assert.equal(third.state.units[0].mp, 9);
        assert.equal(Object.keys(third.state.responses).length, 2);
        const actions = [first.committed, second.committed, third.committed];
        assert.deepEqual(actions.map((a) => a.kind), ["skill", "respond", "respond"]);
        const replay = B.battle.replay(init, actions);
        assert.equal(B.state.hash(replay.state), B.state.hash(third.state));
      });
    }
  }
];

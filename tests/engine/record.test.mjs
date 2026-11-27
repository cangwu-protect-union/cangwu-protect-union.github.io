/* M6 · 战报：种子 + 动作序列的可复现性 */
import assert from "node:assert/strict";

const B = globalThis.RPG6B;
const REC = globalThis.BattleRecord;
if (REC && globalThis.RPG6_SKILLS) B.skills.load(globalThis.RPG6_SKILLS);

const SHEET = {
  "刘文哲": [["拟玛使勒", "1蓝"], ["致命打只因", "1蓝4蓄力"], ["以德服人", "被动"]],
  "李硕": [["虚晃亿枪", "1蓝"], ["宇宙的奥秘", "6蓝"], ["大聪明", "2蓄力"]]
};

const A = {
  id: "t-lwz", name: "刘文哲", occupation: "强攻手", side_job: "",
  atk: "125", def: "30", mres: "10", hp: "625", mp: "10", spd: "45",
  skills: SHEET["刘文哲"].map(([name, condition]) => ({ name, condition }))
};
const B2 = {
  id: "t-ls", name: "李硕", occupation: "粉碎者", side_job: "",
  atk: "65", def: "40", mres: "30", hp: "360", mp: "15", spd: "100",
  skills: SHEET["李硕"].map(([name, condition]) => ({ name, condition }))
};

function playToEnd(seed) {
  const created = B.battle.create({ seed, a: A, b: B2 });
  let state = created.state;
  const actions = [];
  for (let i = 0; i < 80 && state.phase !== "finished"; i++) {
    const uid = state.turnUid;
    if (!uid) break;
    const action = { kind: "basic", type: "attack", target: uid === "a" ? "b" : "a" };
    const result = B.battle.apply(state, action);
    state = result.state;
    actions.push(result.committed);
  }
  return { state, actions };
}

export const cases = [
  {
    name: "战报字段齐：种子、双方 id、动作、回合、指纹",
    run() {
      const { state, actions } = playToEnd(777);
      const record = REC.build(state, { a: A, b: B2 }, actions);
      assert.equal(record.seed, state.seed);
      assert.equal(record.character_a, "t-lwz");
      assert.equal(record.character_b, "t-ls");
      assert.equal(record.name_a, "刘文哲");
      assert.equal(record.steps, actions.length);
      assert.equal(record.rounds, state.round);
      assert.equal(record.result, state.result);
      assert.equal(record.final_hash, B.state.hash(state));
      assert.match(record.id, /^b[a-z0-9]{6,}$/);
    }
  },
  {
    name: "回放：同种子同动作复现同一状态，指纹一致",
    run() {
      const { state, actions } = playToEnd(777);
      const record = REC.build(state, { a: A, b: B2 }, actions);
      const replayed = REC.replay(record, { a: A, b: B2 });
      assert.equal(replayed.match, true);
      assert.equal(B.state.hash(replayed.state), B.state.hash(state));
      assert.equal(replayed.state.result, state.result);
      assert.equal(replayed.state.round, state.round);
    }
  },
  {
    name: "逐步回放：每一步都有一份状态，末步等于结局",
    run() {
      const { state, actions } = playToEnd(777);
      const record = REC.build(state, { a: A, b: B2 }, actions);
      const list = REC.states(record, { a: A, b: B2 });
      assert.equal(list.length, actions.length + 1);
      assert.equal(B.state.hash(list[list.length - 1]), B.state.hash(state));
      assert.equal(list[0].units[1].hp, 360);
    }
  },
  {
    name: "动作被截断时校验不通过，不会假装回放成功",
    run() {
      const { state, actions } = playToEnd(777);
      const record = REC.build(state, { a: A, b: B2 }, actions);
      record.actions = record.actions.slice(0, record.actions.length - 1);
      const replayed = REC.replay(record, { a: A, b: B2 });
      assert.equal(replayed.match, false);
    }
  },
  {
    name: "认输战报：末步是认输，回放一致且走到终局",
    run() {
      const created = B.battle.create({ seed: 777, a: A, b: B2 });
      const first = B.battle.apply(created.state, { kind: "basic", type: "chargeMp" });
      const end = B.battle.apply(first.state, { kind: "surrender" });
      const actions = [first.committed, end.committed];
      const record = REC.build(end.state, { a: A, b: B2 }, actions);
      assert.equal(record.result, "a");
      assert.equal(record.actions[record.actions.length - 1].kind, "surrender");
      const replayed = REC.replay(record, { a: A, b: B2 });
      assert.equal(replayed.match, true);
      assert.equal(replayed.state.result, end.state.result);
      const list = REC.states(record, { a: A, b: B2 });
      assert.equal(list.length, actions.length + 1);
      assert.equal(list[list.length - 1].phase, "finished");
    }
  },
  {
    name: "胜负文案与角色名对应",
    run() {
      const { state, actions } = playToEnd(777);
      const record = REC.build(state, { a: A, b: B2 }, actions);
      const text = REC.resultText(record, { a: A, b: B2 });
      assert.ok(text === "刘文哲 获胜" || text === "李硕 获胜" || text === "平局");
    }
  }
];

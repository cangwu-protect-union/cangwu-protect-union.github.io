/* 韩东晓·我帅不帅？ / 抽象艺术：answer/guess 响应、flag 记录回合、roundStart 掷骰、n 次普攻 */
import assert from "node:assert/strict";

const B = globalThis.RPG6B;
const LIB = globalThis.RPG6_SKILLS;
B.skills.load(LIB);

const HANDONGXIAO = {
  id: "t-handongxiao",
  name: "韩东晓",
  gender: "男",
  occupation: "粉碎者",
  side_job: "射手",
  atk: "85",
  def: "30",
  mres: "50",
  hp: "430",
  mp: "20",
  spd: "90",
  skills: [
    { name: "我帅不帅？", condition: "1蓝" },
    { name: "我是天才！", condition: "3蓄力" },
    { name: "抽象艺术", condition: "4蓝2蓄力" },
    { name: "机枪射手", condition: "5蓝上限" }
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
  hp: "9999",
  mp: "10",
  spd: "120",
  skills: []
};

function mk(seed) {
  return B.battle.create({ seed: seed == null ? 7 : seed, a: HANDONGXIAO, b: DUMMY }).state;
}

function skill(id) {
  return LIB.characters["韩东晓"].find((s) => s.id === id);
}

function unit(state, uid) {
  return B.state.unitOf(state, uid);
}

function respond(state, choice) {
  const pend = state.pendingResponse;
  return B.battle.apply(state, { kind: "respond", id: pend.id, uid: pend.responderUid, choice: choice });
}

/* 按正常速度条推进到指定单位行动；遇到挂起就原样返回 */
function advanceTo(state, uid) {
  let s = state;
  for (let guard = 0; guard < 60; guard++) {
    if (s.pendingResponse) return s;
    if (s.turnUid === uid) return s;
    if (!s.turnUid) { B.timeline.beginTurn(s, []); continue; }
    s = B.battle.apply(s, { kind: "basic", type: "pass" }).state;
  }
  throw new Error("advanceTo 超时：" + uid);
}

/* 读 roll 写进 flags 的计数器（key 可能带 perTarget 后缀，如 ctr.absN.a） */
function counterValue(u, name) {
  const key = Object.keys(u.flags || {}).find((k) => k.indexOf("ctr." + name + ".") === 0);
  return key == null ? null : u.flags[key];
}

/* 挂起态是动作前状态的克隆，roll 的结果被丢弃；重放会从同一 seed 重掷，这里同口径推一次 */
function pendingGuessValue(state) {
  const probe = B.state.clone(state);
  return B.rng.dice(probe, 6);
}

function sayHandsomeAt(state) {
  const a = unit(state, "a");
  a.mp = Math.max(a.mp, 10);
  const cast = B.battle.apply(state, { kind: "skill", skillId: "handongxiao.woshuai" });
  if (!cast.pending) throw new Error("我帅不帅？应挂起");
  const done = respond(cast.state, "帅");
  if (done.pending) throw new Error("说帅后不应再挂起");
  return done.state;
}

function chargeAbstract(state) {
  const res = B.battle.apply(state, { kind: "charge", skillId: "handongxiao.chouxiang" });
  assert.equal(res.pending, undefined);
  assert.equal(res.committed.kind, "charge", "应记一次蓄力");
  return res.state;
}

/* 真实流程：回合 1 说帅 → 回合 2 蓄 1（gap=1）→ 回合 3 蓄 2（once 跳过条件）
   → 回合 4 释放（跳过条件）→ 下一标准回合开始猜数 */
function realAbstractToGuess(seed) {
  let s = mk(seed);
  s.units[0].mp = 10;
  s = sayHandsomeAt(s);
  s = advanceTo(s, "a");
  const a2 = unit(s, "a");
  assert.equal(a2.stats.turns, a2.flags.handsomeTurn + 1, "回合 2 gap=1");
  s = chargeAbstract(s);
  assert.equal(unit(s, "a").charge.amount, 1, "回合 2 蓄到 1 层");
  s = advanceTo(s, "a");
  s = chargeAbstract(s);
  assert.equal(unit(s, "a").charge.amount, 2, "回合 3 once 跳过条件，蓄到 2 层");
  s = advanceTo(s, "a");
  const cast = B.battle.apply(s, { kind: "skill", skillId: "handongxiao.chouxiang" });
  assert.equal(cast.pending, undefined, "蓄满待释放后直接释放，不再要求说帅");
  assert.ok(unit(cast.state, "a").effects.some((e) => e.key === "handongxiao.chouxiang"), "应挂上持续效果");
  return advanceToGuess(cast.state);
}

/* 与 advanceTo 相同，但把路上每个 pass 动作记进 actions，供回放 */
function recordAdvance(state, uid, actions) {
  let s = state;
  for (let guard = 0; guard < 80; guard++) {
    if (s.pendingResponse) return s;
    if (s.turnUid === uid) return s;
    if (!s.turnUid) { B.timeline.beginTurn(s, []); continue; }
    const res = B.battle.apply(s, { kind: "basic", type: "pass" });
    actions.push(res.committed);
    s = res.state;
  }
  throw new Error("recordAdvance 超时：" + uid);
}

/* 推进到下一次 roundStart 猜数挂起（对方可能一个回合有多次行动，逐次 pass 直到弹窗） */
function advanceToGuess(state) {
  let s = state;
  for (let guard = 0; guard < 30; guard++) {
    if (s.pendingResponse) {
      assert.equal(s.pendingResponse.kind, "guess");
      return s;
    }
    if (!s.turnUid) { B.timeline.beginTurn(s, []); continue; }
    const res = B.battle.apply(s, { kind: "basic", type: "pass" });
    if (res.pending) {
      assert.equal(res.state.pendingResponse.kind, "guess");
      return res.state;
    }
    s = res.state;
  }
  throw new Error("等不到猜数挂起");
}

export const cases = [
  {
    name: "我帅不帅·说帅：挂起 answer（帅/不帅，默认帅）；说帅回 80 血、写 handsomeTurn=当前回合序号、扣 1 行动；回放一致",
    run() {
      const s = mk(1);
      s.units[0].hp = 200;
      s.units[0].mp = 1;
      const first = B.battle.apply(s, { kind: "skill", skillId: "handongxiao.woshuai" });
      assert.equal(first.pending, true);
      const pend = first.state.pendingResponse;
      assert.equal(pend.kind, "answer");
      assert.deepEqual(pend.options, ["帅", "不帅"]);
      assert.equal(pend.defaultChoice, "帅");
      assert.equal(pend.prompt, "我帅不帅？");
      assert.equal(unit(first.state, "a").hp, 200, "挂起不结算");
      assert.equal(unit(first.state, "a").mp, 1, "挂起不扣蓝");
      assert.equal(unit(first.state, "a").actionsLeft, 1, "挂起不扣行动");

      const done = respond(first.state, "帅");
      assert.equal(done.pending, undefined);
      const a = unit(done.state, "a");
      assert.equal(a.hp, 280, "回 80 血");
      assert.equal(a.mp, 0, "扣 1 蓝");
      assert.equal(a.stats.turns, 1);
      assert.equal(a.flags.handsomeTurn, a.stats.turns, "记录当前己方回合序号");
      assert.equal(a.actionsLeft, 0, "行动扣 1");
      assert.equal(done.state.turnUid, "b", "回合交给对方");

      const replay = B.battle.replay(s, [first.committed, done.committed]);
      assert.equal(B.state.hash(replay.state), B.state.hash(done.state), "回放指纹一致");
    }
  },
  {
    name: "我帅不帅·不帅：对方受 150 物理伤害（减防御、向 5 取整），自身不回血、不写 flag",
    run() {
      const s = mk(2);
      s.units[0].hp = 200;
      s.units[0].mp = 1;
      s.units[1].base.def = 25;
      assert.equal(B.state.defOf(s.units[1]), 25);
      const first = B.battle.apply(s, { kind: "skill", skillId: "handongxiao.woshuai" });
      assert.equal(first.state.pendingResponse.kind, "answer");
      const done = respond(first.state, "不帅");
      assert.equal(done.pending, undefined);
      assert.equal(unit(done.state, "a").hp, 200, "不回血");
      assert.equal(unit(done.state, "a").flags.handsomeTurn, undefined, "不写 handsomeTurn");
      assert.equal(unit(done.state, "b").hp, 9999 - 125, "150 物理 − 25 防 = 125");
    }
  },
  {
    name: "抽象艺术前置：从 0 蓄第一层时未说帅置灰；同一己方回合（gap 0）仍置灰；下一个己方回合可用",
    run() {
      const abstract = skill("handongxiao.chouxiang");
      const s = mk(3);
      s.units[0].mp = 10;
      const noFlag = B.conditions.evaluate(s, s.units[0], abstract);
      assert.equal(noFlag.ok, false);
      assert.match(noFlag.reason, /说你帅/);

      const first = B.battle.apply(s, { kind: "skill", skillId: "handongxiao.woshuai" });
      const said = respond(first.state, "帅").state;
      const a1 = unit(said, "a");
      a1.mp = 10;
      const sameTurn = B.conditions.evaluate(said, a1, abstract);
      assert.equal(sameTurn.ok, false, "同一己方回合 gap 0 不满足");
      assert.match(sameTurn.reason, /说你帅/);

      const next = advanceTo(said, "a");
      const a2 = unit(next, "a");
      a2.mp = 10;
      const ok = B.conditions.evaluate(next, a2, abstract);
      assert.equal(ok.ok, true, "下一个己方回合 gap 1 可用");
    }
  },
  {
    name: "抽象艺术·once：已有蓄力时跳过说帅条件；蓄力被清空后从 0 重蓄需再次满足「说帅」",
    run() {
      const abstract = skill("handongxiao.chouxiang");
      let s = mk(31);
      s.units[0].mp = 10;
      s = sayHandsomeAt(s);
      s = advanceTo(s, "a");
      const a2 = unit(s, "a");
      a2.mp = 10;
      assert.equal(B.conditions.evaluate(s, a2, abstract).ok, true, "回合 2 从 0 蓄第一层，gap=1 通过");
      s = chargeAbstract(s);
      assert.equal(unit(s, "a").charge.amount, 1);

      s = advanceTo(s, "a");
      const a3 = unit(s, "a");
      a3.mp = 10;
      assert.equal(B.conditions.evaluate(s, a3, abstract).ok, true, "已有 1 层蓄力，once 跳过条件");

      B.damage.clearCharge(s, a3, "test", []);
      assert.equal(a3.charge, null, "蓄力被清空");
      const again = B.conditions.evaluate(s, a3, abstract);
      assert.equal(again.ok, false, "清空后从 0 蓄需要再次说帅");
      assert.match(again.reason, /说你帅/);
    }
  },
  {
    name: "抽象艺术·猜中：说帅、两次蓄力后释放挂效果；下一标准回合开始询问 guess，猜中移除效果、对方不掉血",
    run() {
      const guessState = realAbstractToGuess(4);
      assert.ok(unit(guessState, "a").effects.some((e) => e.key === "handongxiao.chouxiang"), "应挂上持续效果");
      const pend = guessState.pendingResponse;
      assert.equal(pend.kind, "guess");
      assert.equal(pend.prompt, "猜一个数（1–6）");
      assert.equal(pend.defaultChoice, 0);
      const n = pendingGuessValue(guessState);
      const bBefore = unit(guessState, "b").hp;
      const done = respond(guessState, n);
      assert.equal(done.pending, undefined);
      assert.ok(!unit(done.state, "a").effects.some((e) => e.key === "handongxiao.chouxiang"), "猜中移除效果");
      assert.equal(unit(done.state, "b").hp, bBefore, "猜中不掉血");
    }
  },
  {
    name: "抽象艺术·没猜中：respond 非 n 时对方受 n 次普攻（无击溃值），效果保留；下一个标准回合再次询问",
    run() {
      const guessState = realAbstractToGuess(5);
      const n = pendingGuessValue(guessState);
      const wrong = n === 6 ? 1 : n + 1;
      const bBefore = unit(guessState, "b").hp;
      const done = respond(guessState, wrong);
      assert.equal(done.pending, undefined);
      assert.ok(unit(done.state, "a").effects.some((e) => e.key === "handongxiao.chouxiang"), "没猜中效果保留");
      const b = unit(done.state, "b");
      assert.equal(b.breakValue, 0, "n 次普攻不加击溃值");
      assert.equal(b.hp, bBefore - 85 * n, "n 次粉碎者法伤普攻，每次 85");

      let s = done.state;
      assert.equal(s.turnUid, "a", "猜完轮到韩东晓");
      const againState = advanceToGuess(s);
      assert.equal(againState.pendingResponse.kind, "guess", "下一个标准回合再次询问");
    }
  },
  {
    name: "回放：说帅→蓄 1→蓄 2→释放→猜数 的真实动作流重算，最终指纹一致",
    run() {
      /* 蓝用蓄蓝能攒够，这里直接给足（只给资源，不预置蓄力/flag） */
      const init = mk(6);
      init.units[0].mp = 20;
      const actions = [];

      const cast = B.battle.apply(init, { kind: "skill", skillId: "handongxiao.woshuai" });
      assert.equal(cast.pending, true);
      actions.push(cast.committed);
      const answered = respond(cast.state, "帅");
      assert.equal(answered.pending, undefined);
      actions.push(answered.committed);
      let s = answered.state;

      s = recordAdvance(s, "a", actions);
      const c1 = B.battle.apply(s, { kind: "charge", skillId: "handongxiao.chouxiang" });
      assert.equal(c1.committed.kind, "charge");
      actions.push(c1.committed);
      assert.equal(unit(c1.state, "a").charge.amount, 1);

      s = recordAdvance(c1.state, "a", actions);
      const c2 = B.battle.apply(s, { kind: "charge", skillId: "handongxiao.chouxiang" });
      assert.equal(c2.committed.kind, "charge");
      actions.push(c2.committed);
      assert.equal(unit(c2.state, "a").charge.amount, 2);

      s = recordAdvance(c2.state, "a", actions);
      const rel = B.battle.apply(s, { kind: "skill", skillId: "handongxiao.chouxiang" });
      assert.equal(rel.pending, undefined);
      actions.push(rel.committed);
      assert.ok(unit(rel.state, "a").effects.some((e) => e.key === "handongxiao.chouxiang"));

      let guessish = null;
      s = rel.state;
      for (let guard = 0; guard < 60 && !guessish; guard++) {
        const res = B.battle.apply(s, { kind: "basic", type: "pass" });
        actions.push(res.committed);
        if (res.pending) guessish = res;
        else s = res.state;
      }
      assert.ok(guessish && guessish.state.pendingResponse.kind === "guess", "应出现猜数挂起");
      const n = pendingGuessValue(guessish.state);
      const guessed = respond(guessish.state, n);
      assert.equal(guessed.pending, undefined);
      actions.push(guessed.committed);

      const kinds = actions.map((a) => a.kind);
      assert.equal(kinds.filter((k) => k === "respond").length, 2, "动作流应含 answer 与 guess 两次响应");
      assert.equal(kinds.filter((k) => k === "charge").length, 2, "两次蓄力");
      const replay = B.battle.replay(init, actions);
      assert.equal(B.state.hash(replay.state), B.state.hash(guessed.state), "回放指纹一致");
    }
  },
  {
    name: "默认/超时：answer 默认「帅」、guess 默认 0；引擎里 respond 0 视为未猜中走 else",
    run() {
      const s = mk(7);
      s.units[0].mp = 1;
      const ans = B.battle.apply(s, { kind: "skill", skillId: "handongxiao.woshuai" });
      assert.equal(ans.pending, true);
      assert.equal(ans.state.pendingResponse.defaultChoice, "帅");

      const guessState = realAbstractToGuess(7);
      const pend = guessState.pendingResponse;
      assert.equal(pend.kind, "guess");
      assert.equal(pend.defaultChoice, 0);
      const n = pendingGuessValue(guessState);
      const bBefore = unit(guessState, "b").hp;
      const done = respond(guessState, 0);
      assert.equal(done.pending, undefined);
      assert.equal(unit(done.state, "b").hp, bBefore - 85 * n, "respond 0 走 else，受 n 次普攻");
      assert.ok(unit(done.state, "a").effects.some((e) => e.key === "handongxiao.chouxiang"), "效果保留");
    }
  }
];

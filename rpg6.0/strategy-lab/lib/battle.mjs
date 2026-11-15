/* 单局执行：双方各用一套权重，跑完或到步数上限。 */
import { enumerate } from "./enumerator.mjs";
import { choose, makeRng } from "./policy.mjs";

export function play(B, a, b, weightsA, weightsB, seed, options = {}) {
  const cap = options.cap || 400;
  const calib = options.calib || null;
  const rnd = makeRng(seed * 7919 + 13);
  let state = B.battle.create({ seed, a, b }).state;
  const firstUid = state.units[0].uid;
  let steps = 0;

  while (state.phase !== "finished" && steps < cap) {
    const list = enumerate(B, state);
    if (!list.length) break;
    const weights = state.turnUid === firstUid ? weightsA : weightsB;
    const pick = choose(B, state, list, weights, calib, rnd);
    state = B.battle.apply(state, pick).state;
    state.log.length = 0;
    steps += 1;
  }

  const done = state.phase === "finished";
  return {
    result: done ? state.result : "draw",
    stalled: !done,
    steps,
    rounds: state.round
  };
}

/* 行为签名：同一批种子打同一批探针，动作序列相同就视为同一套打法。 */
export function behaviorSignature(B, charA, charB, weights, seeds, calib) {
  const parts = [];
  for (const seed of seeds) {
    const list0 = [];
    let state = B.battle.create({ seed, a: charA, b: charB }).state;
    const rnd = makeRng(seed * 31 + 7);
    let steps = 0;
    while (state.phase !== "finished" && steps < 60) {
      const list = enumerate(B, state);
      if (!list.length) break;
      const pick = choose(B, state, list, weights, calib, rnd);
      list0.push(pick.kind + ":" + (pick.skillId || pick.type) + ":" + (pick.target || ""));
      state = B.battle.apply(state, pick).state;
      state.log.length = 0;
      steps += 1;
    }
    parts.push(list0.join("|"));
  }
  const text = parts.join("||");
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return ("0000000" + h.toString(16)).slice(-8);
}

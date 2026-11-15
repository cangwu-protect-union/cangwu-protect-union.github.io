/* 合法动作枚举。
   与 _local/tests/engine/batch.mjs 的 candidates() 相比：
   - 单体目标按嘲讽过滤（用 maxTauntUids，与 battle.available 同口径）
   - skill.input 取 min/mid/max 三档，不再只有两端
   - 有血召唤物进目标列表 */

function keyOf(action) {
  return [action.kind, action.skillId || action.type || "", action.target || "", action.n == null ? "" : action.n, action.choice || ""].join("|");
}

function inputValues(unit, skill) {
  const min = Math.max(1, Number(skill.input.min) || 1);
  let max = Number(unit.mp);
  if (skill.input.max !== "mp" && skill.input.max != null) max = Math.min(max, Number(skill.input.max));
  if (!isFinite(max) || max < min) return [];
  const mid = Math.floor((min + max) / 2);
  return Array.from(new Set([min, mid, max].filter((v) => v >= min && v <= max))).sort((a, b) => a - b);
}

function targetsForSkill(unit, skill, foeUids) {
  const kind = skill.target;
  if (kind === "self" || kind === "ally" || kind === "allAllies") return [unit.uid];
  if (kind === "any") return [unit.uid].concat(foeUids);
  if (kind === "allEnemies") return foeUids.length ? [foeUids[0]] : [];
  return foeUids;
}

export function enumerate(B, state) {
  if (state.phase === "finished" || !state.turnUid) return [];
  const unit = B.state.unitOf(state, state.turnUid);
  const mySide = B.state.sideOf(state, unit.uid);
  const enemySide = B.state.otherSide(state, mySide);
  const enemies = B.state.combatantsOf(state, enemySide).filter((u) => (u.targetable === false ? false : u.hp > 0));
  const allUids = enemies.map((u) => u.uid);
  const allowed = B.traits.ignoreTaunt && B.traits.ignoreTaunt(unit)
    ? allUids
    : (B.skills.maxTauntUids ? B.skills.maxTauntUids(state, enemySide) : allUids);
  const foeUids = enemies.filter((u) => allowed.indexOf(u.uid) >= 0).map((u) => u.uid);

  const out = [];
  const seen = new Set();
  const push = (action) => {
    const k = keyOf(action);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(action);
  };

  for (const skill of B.skills.forUnit(unit)) {
    const check = B.conditions.evaluate(state, unit, skill);
    if (!check.ok) continue;
    if (check.needsCharge) {
      push({ kind: "skill", skillId: skill.id });
      continue;
    }
    const targets = targetsForSkill(unit, skill, foeUids);
    if (!targets.length) continue;
    if (skill.input) {
      const values = inputValues(unit, skill);
      for (const target of targets) for (const n of values) push({ kind: "skill", skillId: skill.id, target, n });
      continue;
    }
    if (skill.choices && skill.choices.length) {
      for (const target of targets) for (const item of skill.choices) push({ kind: "skill", skillId: skill.id, target, choice: item.key });
      continue;
    }
    for (const target of targets) push({ kind: "skill", skillId: skill.id, target });
  }

  for (const basic of B.battle.available(state)) {
    if (!basic.enabled) continue;
    if (!basic.targets.length) push({ kind: "basic", type: basic.type });
    else for (const target of basic.targets) push({ kind: "basic", type: basic.type, target });
  }
  return out;
}

/* 回合制正传 6.0 · 战报
   战报 = 种子 + 双方角色 id + 归一化动作序列。不存中间状态，回放靠重算。 */
(function (root) {
  "use strict";

  var B = root.RPG6B;

  function newId() {
    var stamp = Date.now().toString(36);
    var salt = Math.random().toString(36).slice(2, 8);
    return "b" + stamp + salt;
  }

  function build(state, meta, actions) {
    return {
      id: newId(),
      engine_version: state.version || "",
      seed: state.seed,
      character_a: meta.a.id || "",
      character_b: meta.b.id || "",
      name_a: meta.a.name || "",
      name_b: meta.b.name || "",
      actions: actions.slice(),
      result: state.result || "unfinished",
      steps: actions.length,
      rounds: state.round,
      final_hash: B.state.hash(state)
    };
  }

  function replay(record, chars) {
    if (!record || !chars || !chars.a || !chars.b) {
      throw new Error("战报缺少角色，无法回放");
    }
    var created = B.battle.create({ seed: record.seed, a: chars.a, b: chars.b });
    var result = B.battle.replay(created.state, record.actions || []);
    return {
      init: created.state,
      state: result.state,
      hashes: result.hashes,
      match: B.state.hash(result.state) === (record.final_hash || "")
    };
  }

  function states(record, chars) {
    var created = B.battle.create({ seed: record.seed, a: chars.a, b: chars.b });
    var list = [created.state];
    var current = created.state;
    var actions = record.actions || [];
    for (var i = 0; i < actions.length; i++) {
      current = B.battle.apply(current, actions[i]).state;
      list.push(current);
    }
    return list;
  }

  function resultText(record, meta) {
    if (!record) return "";
    if (record.result === "a") return (meta && meta.a ? meta.a.name : record.name_a) + " 获胜";
    if (record.result === "b") return (meta && meta.b ? meta.b.name : record.name_b) + " 获胜";
    return "平局";
  }

  root.BattleRecord = {
    newId: newId,
    build: build,
    replay: replay,
    states: states,
    resultText: resultText
  };

  if (typeof module === "object" && module.exports) module.exports = root.BattleRecord;
})(typeof globalThis !== "undefined" ? globalThis : this);

/* 回合制正传 6.0 · 技能库 · 金圣杰 */
export default [
      {
        id: "jinshengjie.zaijie",
        name: "在杰难逃",
        conditionText: "被动",
        passive: true,
        cost: { mp: 0 },
        charge: 0,
        cooldown: 0,
        target: "enemy",
        ops: [],
        hooks: {
          damageDealt: [
            { op: "mark", who: "self", key: "hit3", delta: 1 },
            {
              op: "if",
              cond: { left: { mark: "hit3" }, op: "ge", right: 3 },
              then: [
                { op: "mark", who: "self", key: "hit3", delta: -3 },
                { op: "stat", stat: "atk", who: "target", mode: "add", value: -5, duration: null },
                { op: "stat", stat: "def", who: "target", mode: "add", value: -5, duration: null }
              ]
            },
            { op: "mark", who: "self", key: "hit5", delta: 1 },
            {
              op: "if",
              cond: { left: { mark: "hit5" }, op: "ge", right: 5 },
              then: [
                { op: "mark", who: "self", key: "hit5", delta: -5 },
                { op: "stat", stat: "spd", who: "target", mode: "add", value: -5, duration: null },
                { op: "stat", stat: "mres", who: "target", mode: "add", value: -5, duration: null },
                { op: "maxHp", who: "target", delta: -30 }
              ]
            }
          ]
        }
      },
      {
        id: "jinshengjie.jiechu",
        name: "杰除封印",
        conditionText: "1蓄力",
        cost: { mp: 0 },
        charge: 1,
        cooldown: 0,
        target: "self",
        ops: [
          { op: "stat", stat: "atk", who: "self", mode: "add", value: 70, duration: null },
          { op: "stat", stat: "spd", who: "self", mode: "add", value: 40, duration: null },
          { op: "stat", stat: "mres", who: "self", mode: "add", value: -100, duration: null },
          {
            op: "schedule",
            on: "self",
            after: 2,
            label: "杰除封印·第 2 回合",
            ops: [
              { op: "stat", stat: "atk", who: "self", mode: "add", value: -20, duration: null },
              { op: "stat", stat: "spd", who: "self", mode: "add", value: -10, duration: null },
              { op: "stat", stat: "mres", who: "self", mode: "add", value: 20, duration: null }
            ]
          },
          {
            op: "schedule",
            on: "self",
            after: 4,
            label: "杰除封印·第 4 回合",
            ops: [
              { op: "stat", stat: "atk", who: "self", mode: "add", value: -20, duration: null },
              { op: "stat", stat: "spd", who: "self", mode: "add", value: -10, duration: null },
              { op: "stat", stat: "mres", who: "self", mode: "add", value: 20, duration: null }
            ]
          },
          {
            op: "schedule",
            on: "self",
            after: 6,
            label: "杰除封印·第 6 回合",
            ops: [
              { op: "stat", stat: "atk", who: "self", mode: "add", value: -20, duration: null },
              { op: "stat", stat: "spd", who: "self", mode: "add", value: -10, duration: null },
              { op: "stat", stat: "mres", who: "self", mode: "add", value: 20, duration: null }
            ]
          },
          {
            op: "schedule",
            on: "self",
            after: 7,
            label: "杰除封印·结束",
            ops: [{ op: "clearMods", who: "self" }]
          }
        ]
      },
      {
        id: "jinshengjie.wanjie",
        name: "万杰不复",
        conditionText: "1蓝1蓄力",
        cost: { mp: 1 },
        charge: 1,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "buff", kind: "fragile", who: "target", percent: 20, duration: 8, stacking: false },
          { op: "buff", kind: "panic", who: "target", percent: 20, duration: 8, stacking: false },
          {
            op: "tick",
            duration: { unit: "standard", count: 8 },
            label: "万杰不复",
            ops: [
              { op: "directLoss", value: { per: { stat: "target.maxHp" }, factor: 0.05 } }
            ]
          }
        ]
      },
      {
        id: "jinshengjie.jieao",
        name: "杰骜不驯",
        conditionText: "被动",
        passive: true,
        cost: { mp: 0 },
        charge: 0,
        cooldown: 0,
        target: "self",
        ops: [],
        hooks: {
          beforeDamage: [
            { op: "mark", who: "self", key: "jien", delta: 1 },
            { op: "roll", key: "dodge", sides: 6, perTarget: false, label: "杰骜不驯" },
            {
              op: "if",
              cond: {
                left: { counter: "dodge", perTarget: false },
                op: "le",
                right: { mark: "jien" }
              },
              then: [
                { op: "heal", who: "self", value: 170, rounding: "none" },
                { op: "strike", who: "self", target: "source", noBreak: true, label: "杰骜不驯反击" },
                { op: "markClear", who: "self", key: "jien" },
                { op: "dodge" }
              ]
            }
          ]
        }
      },
      {
        id: "jinshengjie.guang",
        name: "光",
        conditionText: "6蓝",
        cost: { mp: 6 },
        charge: 0,
        cooldown: 0,
        target: "allEnemies",
        ops: [
          {
            op: "tick",
            duration: { unit: "standard", count: 9995 },
            unstoppable: true,
            label: "光",
            ops: [
              { op: "damage", type: "phys", value: 9995 },
              { op: "damage", type: "magic", value: 9995 },
              { op: "damage", type: "true", value: 9995 }
            ]
          }
        ]
      }
];

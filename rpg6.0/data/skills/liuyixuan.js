/* 回合制正传 6.0 · 技能库 · 刘亦萱 */
export default [
      {
        id: "liuyixuan.wuligeili",
        name: "十分“物理给力”",
        conditionText: "被动",
        passive: true,
        cost: { mp: 0 },
        charge: 0,
        cooldown: 0,
        target: "self",
        ops: [],
        hooks: {
          damageTaken: [
            { op: "mark", who: "self", key: "taken", delta: 1 },
            {
              op: "if",
              cond: { left: { mark: "taken" }, op: "ge", right: 5 },
              then: [
                { op: "stat", who: "self", stat: "atk", mode: "add", value: 10, duration: null },
                { op: "breakValue", who: "self", delta: -99 },
                { op: "mark", who: "self", key: "taken", mode: "set", value: 0 }
              ]
            }
          ]
        }
      },
      {
        id: "liuyixuan.poshuijie",
        name: "泼水节",
        conditionText: "2蓝2蓄力",
        cost: { mp: 2 },
        charge: 2,
        cooldown: 0,
        target: "self",
        ops: [
          { op: "status", who: "self", kind: "noBasic", rounds: 6, label: "泼水节：无法普攻" },
          { op: "status", who: "self", kind: "noSkill", rounds: 6, chargeOk: true, label: "泼水节：无法释放技能" },
          {
            op: "tick",
            who: "allEnemies",
            duration: 6,
            period: 2,
            breakOnSourceStatus: ["stun", "break"],
            label: "泼水节：水淹",
            ops: [
              { op: "damage", who: "target", type: "true", value: 150, noBreak: true },
              {
                op: "if",
                cond: { left: { plus: [{ stat: "target.breakValue" }, 3] }, op: "gt", right: 5 },
                then: [{ op: "forceBreak", who: "target" }],
                else: [{ op: "breakValue", who: "target", delta: 3 }]
              }
            ]
          },
          {
            op: "tick",
            who: "allEnemies",
            duration: 6,
            breakOnSourceStatus: ["stun", "break"],
            label: "泼水节：Buff",
            ops: [{ op: "damage", who: "target", type: "magic", value: 50, fromBuff: true, noBreak: true }]
          }
        ]
      },
      {
        id: "liuyixuan.kaipingguo",
        name: "徒手开苹果",
        conditionText: "3蓄力",
        cost: { mp: 0 },
        charge: 3,
        cooldown: 0,
        target: "self",
        ops: [
          { op: "buff", who: "allEnemies", kind: "panic", percent: 100, duration: { unit: "targetRound", count: 2 } },
          { op: "stat", who: "self", stat: "atk", mode: "add", value: 20, duration: null },
          { op: "roll", who: "self", key: "apple", perTarget: false },
          { op: "mark", who: "self", key: "apple", delta: { counter: "apple", perTarget: false } }
        ],
        items: [
          {
            id: "liuyixuan.appleEat",
            label: "吃碎苹果",
            requires: [{ mark: "apple", gte: 1 }],
            oncePerRound: true,
            ops: [
              { op: "heal", who: "self", value: 90, rounding: "none" },
              { op: "breakValue", who: "self", delta: -1 },
              { op: "mark", who: "self", key: "apple", delta: -1 }
            ]
          }
        ]
      },
      {
        id: "liuyixuan.wenxue",
        name: "文学巨作",
        conditionText: "2蓝",
        cost: { mp: 2 },
        charge: 0,
        cooldown: 0,
        target: "self",
        ops: [
          { op: "buff", who: "self", kind: "brave", percent: 50, duration: { unit: "selfRound", count: 3 } },
          { op: "buff", who: "self", kind: "strong", percent: 50, duration: { unit: "selfRound", count: 3 } },
          { op: "dispel", who: "self", scope: "debuff" },
          { op: "dispel", who: "self", scope: "status" },
          { op: "dispel", who: "self", scope: "marked" }
        ]
      }
];

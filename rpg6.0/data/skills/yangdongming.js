/* 回合制正传 6.0 · 技能库 · 杨冬明 */
export default [
      {
        id: "yangdongming.zhuguang",
        name: "竹光法杖",
        conditionText: "10防",
        cost: { mp: 0, def: 10 },
        charge: 0,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "damage", who: "target", type: "magic", value: 50, times: 3 },
          { op: "status", who: "target", kind: "stun", duration: { unit: "targetRound", count: 2 }, label: "竹光法杖" }
        ]
      },
      {
        id: "yangdongming.jianruopanshi",
        name: "坚若磐石",
        conditionText: "5回合冷却",
        cost: { mp: 0 },
        charge: 0,
        cooldown: 5,
        target: "self",
        ops: [
          {
            op: "shield",
            who: "self",
            hp: 300,
            duration: 4,
            label: "坚若磐石",
            onExpire: [{ op: "stat", who: "self", stat: "def", mode: "add", value: 5 }]
          }
        ]
      },
      {
        id: "yangdongming.dedenaenashio",
        name: "嘚吪呐呃嘶哦",
        conditionText: "1回合冷却",
        cost: { mp: 0 },
        charge: 0,
        cooldown: 1,
        target: "self",
        ops: [{ op: "summon", who: "self", key: "yangdongming.voice" }]
      },
      {
        id: "yangdongming.hancongdafu",
        name: "旱葱大祓",
        conditionText: "8蓝",
        cost: { mp: 8 },
        charge: 0,
        cooldown: 0,
        target: "allEnemies",
        forbidEffect: "yangdongming.hancongdafu",
        requires: [{ summonCount: { op: "gte", right: 3 }, reason: "需要己方召唤物 ≥3（当前不足）" }],
        ops: [
          { op: "counter", who: "self", key: "hcdbDur", perTarget: false, delta: { mult: { counter: "hcdbDur", perTarget: false }, factor: -1 } },
          {
            op: "dice",
            sides: 6,
            cases: [{ roll: 6, ops: [{ op: "counter", who: "self", key: "hcdbDur", perTarget: false, delta: 7 }] }],
            else: [{ op: "counter", who: "self", key: "hcdbDur", perTarget: false, delta: 6 }]
          },
          { op: "damage", who: "allEnemies", type: "magic", value: 200 },
          { op: "buff", who: "allEnemies", kind: "panic", percent: 50, duration: { unit: "standard", count: { counter: "hcdbDur", perTarget: false } } },
          { op: "clearSummons", who: "self" },
          { op: "stat", who: "self", stat: "spd", mode: "add", value: 100, duration: { unit: "standard", count: { counter: "hcdbDur", perTarget: false } } },
          { op: "stat", who: "self", stat: "atk", mode: "add", value: 30, duration: { unit: "standard", count: { counter: "hcdbDur", perTarget: false } } },
          {
            op: "tick",
            who: "self",
            key: "yangdongming.hancongdafu",
            label: "旱葱大祓",
            breakImmune: true,
            ignoreTaunt: true,
            autoBreakAtCap: true,
            duration: { unit: "standard", count: { counter: "hcdbDur", perTarget: false } },
            ops: []
          }
        ],
        hooks: {
          basicMod: [
            { op: "if", cond: { effect: "yangdongming.hancongdafu" }, then: [{ op: "setBasicMod", type: "true" }] }
          ],
          basicHit: [
            {
              op: "if",
              cond: { effect: "yangdongming.hancongdafu" },
              then: [{ op: "buff", who: "target", kind: "panic", percent: 10, duration: { unit: "standard", count: { counter: "hcdbDur", perTarget: false } } }]
            }
          ]
        }
      }
];

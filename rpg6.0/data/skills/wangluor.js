/* 回合制正传 6.0 · 技能库 · 王泺然 */
export default [
      {
        id: "wangluor.rendage",
        name: "认大哥",
        conditionText: "1蓝",
        cost: { mp: 1 },
        charge: 0,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "counter", who: "self", key: "rendage", delta: 1 },
          {
            op: "if",
            cond: { left: { counter: "rendage" }, op: "ge", right: 3 },
            then: [
              { op: "stat", stat: "def", who: "target", mode: "set", value: 0, duration: null },
              { op: "stat", stat: "mres", who: "target", mode: "set", value: 0, duration: null }
            ],
            else: [
              { op: "stat", stat: "def", who: "target", mode: "set", value: 0, duration: { unit: "targetRound", count: 5 } },
              { op: "stat", stat: "mres", who: "target", mode: "set", value: 0, duration: { unit: "targetRound", count: 5 } }
            ]
          }
        ]
      },
      {
        id: "wangluor.paozufen",
        name: "刨祖坟",
        conditionText: "3蓄力",
        cost: { mp: 0 },
        charge: 3,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "damage", type: "phys", value: { plus: [250, { stat: "self.hp" }] } },
          { op: "healFull", who: "self" },
          { op: "stat", stat: "atk", who: "target", mode: "add", value: 50, duration: null },
          { op: "stat", stat: "spd", who: "target", mode: "add", value: 30, duration: null }
        ]
      },
      {
        id: "wangluor.diguo",
        name: "帝国主义",
        conditionText: "2蓝",
        cost: { mp: 2 },
        charge: 0,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "damage", type: "true", value: 320 },
          { op: "taunt", who: "self", delta: 3 },
          { op: "stat", stat: "atk", who: "target", mode: "add", value: 40, duration: 10 },
          { op: "stat", stat: "spd", who: "target", mode: "add", value: 10, duration: 10 }
        ]
      }
];

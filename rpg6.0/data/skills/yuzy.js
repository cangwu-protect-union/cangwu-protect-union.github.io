/* 回合制正传 6.0 · 技能库 · 于梓越 */
export default [
      {
        id: "yuzy.jishen",
        name: "鸡肾豹肝",
        conditionText: "1蓄力",
        cost: { mp: 0 },
        charge: 1,
        cooldown: 0,
        target: "enemy",
        ops: [
          {
            op: "dice",
            sides: 6,
            cases: [
              {
                in: [1, 3],
                ops: [
                  { op: "damage", type: "magic", value: 160, noBreak: true },
                  { op: "buff", kind: "fragile", who: "target", percent: 75, duration: 1 }
                ]
              },
              {
                in: [4, 6],
                ops: [
                  { op: "damage", type: "true", value: 150, noBreak: true },
                  { op: "stat", stat: "def", who: "target", mode: "add", value: -5, duration: null },
                  { op: "stat", stat: "mres", who: "target", mode: "add", value: -5, duration: null }
                ]
              }
            ]
          }
        ]
      },
      {
        id: "yuzy.xiajibada",
        name: "夏极八打",
        conditionText: "5蓄力",
        cost: { mp: 0 },
        charge: 5,
        cooldown: 0,
        target: "self",
        ops: [
          { op: "stat", stat: "atk", who: "self", mode: "add", value: -35, duration: 9 },
          { op: "stat", stat: "spd", who: "self", mode: "add", value: 295, duration: 9 },
          { op: "status", kind: "noSkill", who: "self", rounds: 9 },
          { op: "status", kind: "noBreakOut", who: "self", rounds: 9 }
        ]
      },
      {
        id: "yuzy.xueshenke",
        name: "削肾客的救赎",
        conditionText: "2蓝",
        cost: { mp: 2 },
        charge: 0,
        cooldown: 0,
        target: "any",
        ops: [
          { op: "use", skillId: "yuzy.jishen", times: 2 },
          { op: "stat", stat: "spd", who: "target", mode: "mul", value: 2, duration: 8 }
        ]
      }
];

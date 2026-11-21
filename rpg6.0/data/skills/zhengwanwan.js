/* 回合制正传 6.0 · 技能库 · 郑湾湾 */
export default [
      {
        id: "zhengwanwan.paihou",
        name: "拍后脑勺",
        conditionText: "1蓝",
        cost: { mp: 1 },
        charge: 0,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "damage", type: "phys", value: 130 },
          { op: "buff", kind: "panic", who: "target", percent: 20, duration: 4 },
          { op: "interrupt", who: "target" }
        ]
      },
      {
        id: "zhengwanwan.banzhuren",
        name: "班主任的凝视",
        conditionText: "2蓝1蓄力",
        cost: { mp: 2 },
        charge: 1,
        cooldown: 0,
        target: "allEnemies",
        ops: [
          {
            op: "tick",
            duration: { unit: "standard", count: 7 },
            label: "班主任的凝视",
            ops: [{ op: "damage", type: "true", value: 25, noBreak: true }]
          },
          { op: "stat", stat: "atk", who: "target", mode: "add", value: -25, duration: 7 },
          { op: "stat", stat: "spd", who: "target", mode: "add", value: -25, duration: 7 }
        ]
      },
      {
        id: "zhengwanwan.shouji",
        name: "手机铃声",
        conditionText: "6回合冷却",
        cost: { mp: 0 },
        charge: 0,
        cooldown: 6,
        target: "enemy",
        ops: [
          {
            op: "tick",
            duration: { unit: "standard", count: 3 },
            label: "手机铃声",
            ops: [
              { op: "damage", type: "magic", value: 80, noBreak: true },
              {
                op: "dice",
                sides: 6,
                cases: [
                  { in: [6], ops: [{ op: "mp", who: "self", delta: 1 }] }
                ]
              }
            ]
          }
        ]
      },
      {
        id: "zhengwanwan.sanjiaoban",
        name: "三角板暴风雨",
        conditionText: "6蓝2蓄力",
        cost: { mp: 6 },
        charge: 2,
        cooldown: 0,
        target: "enemy",
        ops: [
          {
            op: "tick",
            duration: { unit: "standard", count: 5 },
            label: "三角板暴风雨",
            ops: [{ op: "damage", type: "last", value: 245 }]
          },
          {
            op: "schedule",
            on: "self",
            after: 5,
            label: "三角板收尾",
            ops: [{ op: "damage", type: "last", value: 100 }]
          }
        ]
      }
];

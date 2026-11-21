/* 回合制正传 6.0 · 技能库 · 谢雨辰 */
export default [
      {
        id: "xieyuchen.yishou",
        name: "一手好牌",
        conditionText: "4回合冷却",
        cost: { mp: 0 },
        charge: 0,
        cooldown: 4,
        target: "enemy",
        ops: [
          {
            op: "dice",
            sides: 6,
            cases: [
              { in: [1, 5], ops: [{ op: "damage", type: "magic", value: 70, times: 4, noBreak: true }] },
              { in: [6], ops: [{ op: "damage", type: "magic", value: 70, times: 4, noBreak: true, factor: 2.5 }] }
            ]
          }
        ]
      },
      {
        id: "xieyuchen.yonggan",
        name: "勇敢勇敢我的朋友！",
        conditionText: "2蓝2蓄力",
        cost: { mp: 2 },
        charge: 2,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "stat", stat: "spd", who: "self", mode: "add", value: 150, duration: 5 },
          { op: "stat", stat: "spd", who: "target", mode: "add", value: 50, duration: 5 },
          {
            op: "schedule",
            on: "self",
            after: 5,
            label: "勇敢勇敢·回落",
            ops: [
              { op: "stat", stat: "spd", who: "self", mode: "add", value: -200, duration: 3 },
              { op: "stat", stat: "spd", who: "target", mode: "add", value: -60, duration: 3 }
            ]
          }
        ]
      },
      {
        id: "xieyuchen.ernv",
        name: "儿女情肠",
        conditionText: "2蓄力",
        cost: { mp: 0 },
        charge: 2,
        cooldown: 0,
        target: "allEnemies",
        ops: [
          {
            op: "tick",
            duration: { unit: "standard", count: 3 },
            label: "儿女情肠",
            ops: [{ op: "damage", type: "true", value: 30, noBreak: true }]
          }
        ]
      }
];

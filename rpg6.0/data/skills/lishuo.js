/* 回合制正传 6.0 · 技能库 · 李硕 */
export default [
      {
        id: "lishuo.xuhuang",
        name: "虚晃亿枪",
        conditionText: "1蓝",
        cost: { mp: 1 },
        charge: 0,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "damage", type: "true", value: 120 }
        ]
      },
      {
        id: "lishuo.yuzhou",
        name: "宇宙的奥秘",
        conditionText: "6蓝",
        cost: { mp: 6 },
        charge: 0,
        cooldown: 0,
        target: "enemy",
        ops: [
          {
            op: "tick",
            duration: { unit: "standard", count: 5 },
            unstoppable: true,
            label: "宇宙的奥秘",
            ops: [{ op: "directLoss", value: 100 }]
          }
        ]
      },
      {
        id: "lishuo.dacongming",
        name: "大聪明",
        conditionText: "2蓄力",
        cost: { mp: 0 },
        charge: 2,
        cooldown: 0,
        target: "self",
        ops: [
          { op: "heal", who: "self", value: { hpPercent: "self.current", percent: 40 }, rounding: "ten", bonus: 30 },
          { op: "mp", who: "self", delta: 3 }
        ]
      }
];

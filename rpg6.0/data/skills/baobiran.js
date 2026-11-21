/* 回合制正传 6.0 · 技能库 · 包必冉 */
export default [
      {
        id: "baobiran.wuneng",
        name: "无能狂怒",
        conditionText: "1蓝",
        cost: { mp: 1 },
        charge: 0,
        cooldown: 0,
        target: "enemy",
        ops: [
          {
            op: "tick",
            duration: { unit: "standard", count: 5 },
            label: "无能狂怒",
            ops: [
              { op: "damage", type: "basic", value: { stat: "self.atk" } }
            ]
          }
        ]
      },
      {
        id: "baobiran.kouchu",
        name: "口出狂言",
        conditionText: "2蓝1蓄力",
        cost: { mp: 2 },
        charge: 1,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "damage", type: "phys", value: 175 },
          {
            op: "tick",
            duration: { unit: "standard", count: 4 },
            label: "口出狂言",
            ops: [
              { op: "buff", kind: "panic", who: "target", percent: 5, duration: 4 }
            ]
          }
        ]
      },
      {
        id: "baobiran.sanbei",
        name: "三杯不过岗",
        conditionText: "被动",
        passive: true,
        cost: { mp: 0 },
        charge: 0,
        cooldown: 0,
        target: "enemy",
        ops: [],
        hooks: {
          basicMod: [
            {
              op: "dice",
              sides: 6,
              cases: [
                { in: [2, 4, 6], ops: [{ op: "setBasicMod", type: "true", factor: 2 }] },
                { in: [1, 3, 5], ops: [{ op: "setBasicMod", healInstead: true }] }
              ]
            }
          ]
        }
      }
];

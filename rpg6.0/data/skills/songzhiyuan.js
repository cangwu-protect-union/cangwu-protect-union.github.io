/* 回合制正传 6.0 · 技能库 · 宋知远 */
export default [
      {
        id: "songzhiyuan.dianmo",
        name: "电摩冲击",
        conditionText: "3蓄力",
        cost: { mp: 0 },
        charge: 3,
        cooldown: 0,
        target: "self",
        ops: [
          { op: "status", kind: "noSkill", who: "self", rounds: 10, label: "无法使用技能" },
          {
            op: "tick",
            duration: { unit: "standard", count: 10 },
            label: "电摩冲击",
            ops: [
              {
                op: "if",
                cond: { left: { stat: "self.spd" }, op: "lt", right: 170 },
                then: [
                  {
                    op: "if",
                    cond: { left: { plus: [{ stat: "self.spd" }, 30] }, op: "gt", right: 170 },
                    then: [{ op: "stat", stat: "spd", who: "self", mode: "add", value: { minus: [170, { stat: "self.spd" }] }, duration: null }],
                    else: [{ op: "stat", stat: "spd", who: "self", mode: "add", value: 30, duration: null }]
                  }
                ],
                else: []
              },
              {
                op: "if",
                cond: { left: { stat: "self.atk" }, op: "lt", right: 230 },
                then: [
                  {
                    op: "if",
                    cond: { left: { plus: [{ stat: "self.atk" }, 20] }, op: "gt", right: 230 },
                    then: [{ op: "stat", stat: "atk", who: "self", mode: "add", value: { minus: [230, { stat: "self.atk" }] }, duration: null }],
                    else: [{ op: "stat", stat: "atk", who: "self", mode: "add", value: 20, duration: null }]
                  }
                ],
                else: []
              }
            ]
          }
        ]
      },
      {
        id: "songzhiyuan.feilong",
        name: "肥龙在天",
        conditionText: "1蓄力",
        cost: { mp: 0 },
        charge: 1,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "damage", type: "phys", value: 180 },
          { op: "damage", type: "true", value: 180 },
          { op: "breakValue", who: "target", delta: 3 },
          { op: "forceBreak", who: "target" }
        ]
      },
      {
        id: "songzhiyuan.shuijiao",
        name: "睡觉",
        conditionText: "1蓝",
        cost: { mp: 1 },
        charge: 0,
        cooldown: 0,
        target: "self",
        ops: [
          { op: "taunt", who: "self", delta: 1 },
          { op: "stat", stat: "def", who: "self", mode: "add", value: 45, duration: 3 },
          { op: "stat", stat: "mres", who: "self", mode: "add", value: 45, duration: 3 },
          {
            op: "tick",
            duration: { unit: "standard", count: 3 },
            label: "睡觉",
            ops: [
              { op: "maxHp", who: "self", delta: 80 },
              { op: "heal", who: "self", value: 150, rounding: "none" }
            ]
          },
          { op: "status", kind: "break", who: "self", rounds: 3, label: "击溃" }
        ]
      },
      {
        id: "songzhiyuan.picao",
        name: "皮糙肉厚",
        conditionText: "被动",
        passive: true,
        cost: { mp: 0 },
        charge: 0,
        cooldown: 0,
        target: "self",
        rollDodge: { sides: 6, values: [1, 3, 5] },
        buffImmune: ["panic", "fragile"],
        hooks: {
          roundStart: [
            {
              op: "if",
              cond: { left: { stat: "self.hp" }, op: "le", right: 600 },
              then: [{ op: "heal", who: "self", value: 25, rounding: "none", label: "皮糙肉厚" }]
            }
          ]
        },
        ops: []
      }
];

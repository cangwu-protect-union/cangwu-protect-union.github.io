/* 回合制正传 6.0 · 技能库 · 刘文哲 */
export default [
      {
        id: "liuwenzhe.nimashile",
        name: "拟玛使勒",
        conditionText: "1蓝",
        cost: { mp: 1 },
        charge: 0,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "maxMp", who: "target", delta: -3 }
        ]
      },
      {
        id: "liuwenzhe.zhiming",
        name: "致命打只因",
        conditionText: "1蓝4蓄力",
        cost: { mp: 1 },
        charge: 4,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "damage", type: "phys", value: 995 }
        ]
      },
      {
        id: "liuwenzhe.yidefuren",
        name: "以德服人",
        conditionText: "被动",
        passive: true,
        cost: { mp: 0 },
        charge: 0,
        cooldown: 0,
        target: "enemy",
        ops: [],
        hooks: {
          basicHit: [
            { op: "directLoss", who: "target", value: 30 }
          ],
          breakAction: [
            { op: "damage", type: "phys", value: { per: { stat: "target.breakValue" }, factor: 50 } }
          ]
        }
      }
];

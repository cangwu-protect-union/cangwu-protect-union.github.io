/* 回合制正传 6.0 · 技能库 · 江雨轩 */
export default [
      {
        id: "jiangyuxuan.taishan",
        name: "泰山压顶",
        conditionText: "1蓄力",
        cost: { mp: 0 },
        charge: 1,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "damage", type: "phys", value: 200 },
          { op: "stat", stat: "spd", who: "target", mode: "set", value: 25, duration: { unit: "targetRound", count: 10 } },
          { op: "buff", kind: "fragile", who: "target", percent: 100, duration: { unit: "targetRound", count: 10 } }
        ]
      },
      {
        id: "jiangyuxuan.feifei",
        name: "肥肥反弹",
        conditionText: "1蓄力",
        cost: { mp: 0 },
        charge: 1,
        cooldown: 0,
        target: "self",
        ops: [],
        chargeOps: [
          { op: "reflect", who: "self", factor: 2, stunRounds: 3 }
        ]
      },
      {
        id: "jiangyuxuan.ganfanren",
        name: "干饭人，干饭魂！",
        conditionText: "1蓝",
        cost: { mp: 1 },
        charge: 0,
        cooldown: 0,
        target: "ally",
        ops: [
          { op: "heal", who: "self", value: { hpPercent: "self.lost", percent: 25 }, rounding: "int" },
          { op: "dispel", who: "self", scope: "debuff" }
        ]
      }
];

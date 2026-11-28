/* 回合制正传 6.0 · 技能库 · 张家铭 */
export default [
      {
        id: "zhangjiaming.xiaoxingxing",
        name: "小行星撞击",
        conditionText: "2蓄力",
        cost: { mp: 0 },
        charge: 2,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "damage", type: "phys", value: { per: { stat: "target.def" }, factor: 6 }, noBreak: true }
        ]
      },
      {
        id: "zhangjiaming.saijin",
        name: "塞进垃圾桶",
        conditionText: "1蓝3蓄力",
        cost: { mp: 1 },
        charge: 3,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "damage", type: "phys", value: 300 },
          { op: "status", kind: "stun", who: "target", rounds: 5, label: "眩晕" },
          {
            op: "tick",
            duration: { unit: "targetRound" },
            permanent: true,
            label: "塞进垃圾桶",
            ops: [{ op: "damage", type: "true", value: 50, fromBuff: true }]
          }
        ]
      },
      {
        id: "zhangjiaming.qiufeng",
        name: "秋风扫落叶",
        conditionText: "1蓝1蓄力",
        cost: { mp: 1 },
        charge: 1,
        cooldown: 0,
        target: "allEnemies",
        ops: [
          {
            op: "tick",
            duration: { unit: "standard", count: 5 },
            label: "秋风扫落叶",
            ops: [{ op: "damage", type: "basic", value: { stat: "self.atk" } }]
          }
        ]
      },
      {
        id: "zhangjiaming.weixiang",
        name: "卫委壮观",
        conditionText: "被动",
        passive: true,
        cost: { mp: 0 },
        charge: 0,
        cooldown: 0,
        target: "self",
        activeDodge: { costDef: 15, costMres: 10 },
        basicGroupWhen: [
          { stat: "def", gt: 0 },
          { stat: "mres", gt: 0 }
        ],
        ops: []
      }
];

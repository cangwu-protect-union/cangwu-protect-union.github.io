/* 回合制正传 6.0 · 技能库 · 王荣逸 */
export default [
      {
        id: "wangrongyi.shuati",
        name: "刷题",
        conditionText: "1蓝",
        cost: { mp: 1 },
        charge: 0,
        cooldown: 0,
        target: "self",
        requires: [{ mark: "shuati", lte: 2, reason: "刷题已满 3 层" }],
        ops: [
          { op: "mark", who: "self", key: "shuati", delta: 1 },
          { op: "stat", stat: "atk", who: "self", mode: "add", value: 20, duration: null },
          { op: "stat", stat: "def", who: "self", mode: "add", value: 20, duration: null },
          { op: "stat", stat: "mres", who: "self", mode: "add", value: 20, duration: null },
          { op: "stat", stat: "spd", who: "self", mode: "add", value: 20, duration: null },
          { op: "maxHp", who: "self", delta: 120 },
          { op: "heal", who: "self", value: 160, rounding: "none" },
          { op: "maxMp", who: "self", delta: 3 },
          { op: "dispel", who: "self", scope: "breakValue" }
        ]
      },
      {
        id: "wangrongyi.xuexi",
        name: "学习氛围",
        conditionText: "无",
        cost: { mp: 0 },
        charge: 0,
        cooldown: 0,
        target: "self",
        toggleEffect: "wangrongyi.xuexi",
        ops: [
          {
            op: "stat",
            who: "self",
            stat: "atk",
            mode: "mul",
            value: 2,
            duration: null,
            untilRecast: "wangrongyi.xuexi"
          },
          {
            op: "stat",
            who: "self",
            stat: "def",
            mode: "mul",
            value: 2,
            duration: null,
            untilRecast: "wangrongyi.xuexi"
          },
          {
            op: "tick",
            who: "self",
            permanent: true,
            key: "wangrongyi.xuexi",
            label: "学习氛围",
            ops: [
              {
                op: "if",
                cond: { left: { stat: "self.mp" }, op: "le", right: 0 },
                then: [{ op: "removeEffect", who: "self", key: "wangrongyi.xuexi" }],
                else: [
                  { op: "heal", who: "allAllies", value: 20 },
                  { op: "mp", who: "self", delta: -1 }
                ]
              }
            ]
          }
        ]
      },
      {
        id: "wangrongyi.xiti",
        name: "习题轰炸",
        conditionText: "1蓝1蓄力",
        cost: { mp: 1 },
        charge: 1,
        cooldown: 0,
        target: "enemy",
        requires: [{ mark: "shuati", gte: 1, reason: "需要先刷题" }],
        ops: [
          {
            op: "if",
            cond: { left: { mark: "shuati" }, op: "eq", right: 1 },
            then: [{ op: "damage", type: "phys", value: 100 }],
            else: [
              {
                op: "if",
                cond: { left: { mark: "shuati" }, op: "eq", right: 2 },
                then: [{ op: "damage", type: "phys", value: 150 }],
                else: [{ op: "damage", type: "phys", value: 210 }]
              }
            ]
          },
          { op: "mp", who: "self", delta: 3 },
          { op: "status", kind: "stun", who: "target", rounds: 3, label: "眩晕" }
        ]
      },
      {
        id: "wangrongyi.manfen",
        name: "满分嘲讽",
        conditionText: "3蓝3蓄力",
        cost: { mp: 3 },
        charge: 3,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "damage", type: "true", value: { plus: [240, { per: { mark: "shuati" }, factor: 150 }] } }
        ]
      }
];

/* 回合制正传 6.0 · 技能库 · 李雨轩 */
export default [
      {
        id: "liyuxuan.zhiyin",
        name: "只因只因爆",
        conditionText: "3蓝2蓄力",
        cost: { mp: 3 },
        charge: 2,
        cooldown: 0,
        target: "self",
        ops: [
          { op: "stat", stat: "def", who: "self", mode: "set", value: 0, duration: { unit: "standard", count: 10 } },
          { op: "stat", stat: "mres", who: "self", mode: "set", value: 0, duration: { unit: "standard", count: 10 } },
          { op: "stat", stat: "atk", who: "self", mode: "add", value: 80, duration: { unit: "standard", count: 10 } },
          { op: "status", kind: "zhiyin", who: "self", rounds: 10, label: "只因只因爆" },
          {
            op: "tick",
            who: "self",
            duration: { unit: "standard", count: 10 },
            label: "只因只因爆：每标准回合 -45 血",
            desc: "每标准回合强制扣 45 血",
            ops: [
              { op: "directLoss", who: "self", value: 45 }
            ]
          }
        ],
        hooks: {
          damageDealt: [
            {
              op: "if",
              cond: { status: "zhiyin" },
              then: [
                {
                  op: "dice",
                  sides: 6,
                  cases: [
                    { roll: 6, ops: [{ op: "healFull", who: "self" }] }
                  ]
                }
              ]
            }
          ]
        }
      },
      {
        id: "liyuxuan.xiaoxuesheng",
        name: "小学生人大代表",
        conditionText: "2蓝",
        cost: { mp: 2 },
        charge: 0,
        cooldown: 0,
        target: "allEnemies",
        ops: [
          { op: "stat", stat: "def", who: "allEnemies", mode: "set", value: 0, restore: 10 },
          { op: "stat", stat: "mres", who: "allEnemies", mode: "set", value: 0, restore: 10 }
        ]
      },
      {
        id: "liyuxuan.xuanzhuan",
        name: "旋转",
        conditionText: "1蓝1蓄力",
        cost: { mp: 1 },
        charge: 1,
        cooldown: 0,
        target: "enemy",
        ops: [
          {
            op: "tick",
            who: "target",
            duration: { unit: "standard", count: 5 },
            label: "旋转",
            desc: "每标准回合造成递增法伤并 +1 击溃值，目标被击溃时结束",
            breakOnHolderStatus: ["break"],
            ops: [
              { op: "counter", who: "self", key: "rot", delta: 1 },
              { op: "damage", who: "target", type: "magic", value: { mult: { counter: "rot" }, factor: 10 }, noBreak: true },
              {
                op: "if",
                cond: { left: { stat: "target.breakValue" }, op: "ge", right: 5 },
                then: [{ op: "forceBreak", who: "target" }],
                else: [{ op: "breakValue", who: "target", delta: 1 }]
              }
            ]
          },
          { op: "status", kind: "noBasic", who: "target", rounds: 5, label: "旋转：无法普攻" },
          { op: "status", kind: "noCharge", who: "target", rounds: 5, label: "旋转：无法蓄力" }
        ]
      }
];

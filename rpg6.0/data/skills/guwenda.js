/* 回合制正传 6.0 · 技能库 · 顾文达 */
export default [
      {
        id: "guwenda.rengaomada",
        name: "人高马大",
        conditionText: "被动",
        passive: true,
        cost: { mp: 0 },
        charge: 0,
        cooldown: 0,
        target: "self",
        ops: [],
        hooks: {
          beforeDamage: [
            {
              op: "if",
              cond: { left: { ctx: "amount" }, op: "lt", right: { mark: "self.renGao" } },
              then: [{ op: "dodge" }]
            }
          ],
          damageTaken: [
            { op: "mark", who: "self", key: "renGao", delta: -5 },
            { op: "heal", who: "self", value: 15 }
          ]
        }
      },
      {
        id: "guwenda.xiaqian",
        name: "下潜",
        conditionText: "1蓄力",
        cost: { mp: 0 },
        charge: 1,
        cooldown: 0,
        target: "self",
        ops: [],
        unsupported: "本版未实现：需要防护层（免疫异常/免击溃/蓄力不断/取消一次伤害后结束并降防）；这批不做守护层，避免半成品规则。"
      },
      {
        id: "guwenda.zhadanshuai",
        name: "炸弹摔",
        conditionText: "1蓝3蓄力",
        cost: { mp: 1 },
        charge: 3,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "roll", sides: 6, key: "bomb" },
          {
            op: "if",
            cond: { left: { counter: "bomb" }, op: "le", right: { stat: "target.breakValue" } },
            then: [
              { op: "damage", who: "target", type: "phys", value: 400 },
              { op: "damage", who: "target", type: "true", value: 400 }
            ],
            else: [
              {
                op: "if",
                cond: { status: "break", who: "target" },
                then: [
                  { op: "damage", who: "target", type: "phys", value: 400 },
                  { op: "damage", who: "target", type: "true", value: 400 }
                ]
              }
            ]
          }
        ]
      },
      {
        id: "guwenda.shuoge",
        name: "硕哥过肩摔",
        conditionText: "1蓄力",
        cost: { mp: 0 },
        charge: 1,
        cooldown: 0,
        target: "self",
        ops: [],
        unsupported: "本版未实现：需要蓄力态条件、受击/被击溃时取消该次并立即发动；引擎没有这些落点。"
      }
];

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
              cond: { effect: "rengaoOff" },
              then: [],
              else: [
                {
                  op: "if",
                  cond: { effect: "xiaqian" },
                  then: [
                    {
                      op: "if",
                      cond: { left: { ctx: "amount" }, op: "lt", right: { mult: { mark: "self.renGao" }, factor: 2 } },
                      then: [{ op: "dodge" }]
                    }
                  ],
                  else: [
                    {
                      op: "if",
                      cond: { left: { ctx: "amount" }, op: "lt", right: { mark: "self.renGao" } },
                      then: [{ op: "dodge" }]
                    }
                  ]
                }
              ]
            }
          ],
          damageTaken: [
            {
              op: "if",
              cond: { effect: "rengaoOff" },
              then: [],
              else: [
                {
                  op: "if",
                  cond: { effect: "xiaqian" },
                  then: [
                    { op: "mark", who: "self", key: "renGao", delta: -10 },
                    { op: "heal", who: "self", value: 30 }
                  ],
                  else: [
                    { op: "mark", who: "self", key: "renGao", delta: -5 },
                    { op: "heal", who: "self", value: 15 }
                  ]
                }
              ]
            }
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
        ops: [
          {
            op: "tick",
            who: "self",
            permanent: true,
            key: "xiaqian",
            label: "下潜",
            desc: "免疫异常状态与击溃、蓄力不被打断；对方无法使用技能，自身无法普攻。受到 5 次伤害后取消，随后防御变 0、人高马大失效 1 标准回合。",
            immune: { buffs: ["fragile", "panic"], statuses: ["stun", "break", "daze", "noSkill", "noBasic", "noCharge", "cannotAct", "onlyBasic"] },
            breakImmune: true,
            chargeGuard: true,
            enemyNoSkill: true,
            selfNoBasic: true,
            guard: {
              remaining: 5,
              ops: [
                { op: "tick", who: "self", duration: 1, key: "rengaoOff", label: "人高马大失效", ops: [] },
                { op: "stat", who: "self", stat: "def", mode: "set", value: 0, duration: 1 },
                { op: "note", text: "下潜结束：防御变为 0，人高马大失效 1 标准回合" }
              ]
            }
          }
        ]
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
                ],
                else: [
                  { op: "note", text: "炸弹摔未命中" }
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
        chargeOps: [
          {
            op: "tick",
            who: "self",
            permanent: true,
            key: "shuoge",
            label: "硕哥过肩摔",
            desc: "蓄力期间：受到伤害或被击溃时完全免疫该次，并立即发动 80 普伤 + 80 法伤，发动后蓄力清空。",
            guard: {
              remaining: 1,
              onBreak: true,
              ops: [
                { op: "damage", who: "enemyHero", type: "phys", value: 80 },
                { op: "damage", who: "enemyHero", type: "magic", value: 80 }
              ]
            }
          }
        ],
        ops: [
          { op: "damage", who: "target", type: "phys", value: 80 },
          { op: "damage", who: "target", type: "magic", value: 80 }
        ]
      }
];

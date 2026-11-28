/* 回合制正传 6.0 · 技能库 · 泥浩恺（plan.mjs --write 生成，之后直接改这里） */
export default [
  {
    id: "nihaokai.heai",
    name: "核蔼可氢",
    conditionText: "2蓝",
    cost: { mp: 2 },
    charge: 0,
    cooldown: 0,
    target: "enemy",
    noAction: true,
    ops: [
      { op: "roll", sides: 6, key: "heRoll" },
      {
        op: "if",
        cond: {
          left: { counter: "heRoll" },
          op: "le",
          right: { minus: [6, { mark: "self.heCount" }] }
        },
        then: [
          { op: "damage", who: "target", type: "true", value: 35, healBack: true },
          { op: "counter", who: "self", key: "heRepeat", delta: 1, perTarget: false },
          {
            op: "schedule",
            after: 1,
            atPhase: "roundStart",
            label: "核蔼可氢·复燃",
            capture: {
              dmg: { mult: { pow: [2, { counter: "heRepeat", perTarget: false }] }, factor: 35 }
            },
            ops: [
              {
                op: "damage",
                who: "target",
                type: "true",
                value: { ctx: "dmg" },
                healBack: true
              }
            ]
          }
        ],
        else: [{ op: "note", text: "核蔼可氢未命中，技能进程结束" }]
      },
      { op: "mark", who: "self", key: "heCount", delta: 1 }
    ]
  },
  {
    id: "nihaokai.zhiye",
    name: "职业道德",
    conditionText: "1蓝2蓄力",
    cost: { mp: 1 },
    charge: 2,
    cooldown: 0,
    target: "enemy",
    ops: [
      { op: "removeEffect", who: "self", key: "zhiye" },
      { op: "clearMods", who: "self", stats: ["atk"] },
      { op: "markClear", who: "self", key: "zyRound" },
      {
        op: "buff",
        who: "target",
        kind: "fragile",
        percent: 200,
        duration: { unit: "selfRound", count: 4 }
      },
      { op: "stat", who: "self", stat: "atk", mode: "set", value: 300 },
      {
        op: "status",
        who: "self",
        kind: "noBreakOut",
        label: "职业道德",
        duration: { unit: "selfRound", count: 4 }
      },
      {
        op: "tick",
        who: "self",
        key: "zhiye",
        label: "职业道德",
        desc: "每个自己回合结束攻 −55，共 4 次；结束时清掉本次技能的攻修正。",
        duration: { unit: "selfRound", count: 4 },
        ops: [
          { op: "mark", who: "self", key: "zyRound", delta: 1 },
          {
            op: "if",
            cond: { left: { mark: "self.zyRound" }, op: "ge", right: 4 },
            then: [
              { op: "clearMods", who: "self", stats: ["atk"] },
              { op: "note", text: "职业道德结束：攻击回到原值" }
            ],
            else: [{ op: "stat", who: "self", stat: "atk", mode: "add", value: -55 }]
          }
        ]
      }
    ]
  },
  {
    id: "nihaokai.koufen",
    name: "扣分!",
    conditionText: "1蓝",
    cost: { mp: 1 },
    charge: 0,
    cooldown: 0,
    target: "self",
    ops: [
      {
        op: "reflect",
        who: "self",
        charges: 5,
        value: 50,
        type: "magic",
        noBreak: true,
        label: "扣分!"
      }
    ]
  },
  {
    id: "nihaokai.shenyuan",
    name: "来自深渊的凝视",
    conditionText: "被动",
    passive: true,
    cost: { mp: 0 },
    charge: 0,
    cooldown: 0,
    target: "self",
    ops: [],
    hooks: {
      battleStart: [
        {
          op: "tick",
          who: "self",
          key: "abyssDrain",
          label: "来自深渊的凝视·抽蓝",
          permanent: true,
          duration: { unit: "enemyRound" },
          ops: [
            {
              op: "if",
              cond: { status: "stun", who: "self" },
              then: [],
              else: [
                {
                  op: "if",
                  cond: { status: "break", who: "self" },
                  then: [],
                  else: [
                    {
                      op: "if",
                      cond: { left: { stat: "enemyHero.maxMp" }, op: "le", right: 0 },
                      then: [],
                      else: [
                        { op: "maxMp", who: "enemyHero", delta: -1, label: "来自深渊的凝视" },
                        {
                          op: "counter",
                          who: "self",
                          key: "abyssDrain",
                          delta: 1,
                          perTarget: false
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          op: "tick",
          who: "self",
          key: "abyssLoss",
          label: "来自深渊的凝视·强扣",
          permanent: true,
          ops: [
            {
              op: "if",
              cond: { status: "break", who: "self" },
              then: [],
              else: [
                {
                  op: "if",
                  cond: { left: { stat: "enemyHero.maxMp" }, op: "le", right: 0 },
                  then: [{ op: "directLoss", who: "enemyHero", value: 50 }],
                  else: []
                }
              ]
            }
          ]
        }
      ],
      roundStart: [
        {
          op: "if",
          cond: { left: { mark: "self.abyssRestored" }, op: "lt", right: 1 },
          then: [
            {
              op: "if",
              cond: { status: "break", who: "self" },
              then: [
                { op: "mark", who: "self", key: "abyssRestored", delta: 1 },
                { op: "removeEffect", who: "self", key: "abyssDrain" },
                { op: "removeEffect", who: "self", key: "abyssLoss" },
                {
                  op: "maxMp",
                  who: "enemyHero",
                  delta: { counter: "abyssDrain", perTarget: false },
                  label: "来自深渊的凝视·复原"
                },
                { op: "maxMp", who: "enemyHero", delta: -2, label: "来自深渊的凝视·代价" },
                { op: "note", text: "来自深渊的凝视：被击溃，蓝上限复原后永久 −2" }
              ]
            }
          ]
        }
      ]
    }
  }
];

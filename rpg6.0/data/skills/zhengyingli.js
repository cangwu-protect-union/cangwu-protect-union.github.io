/* 回合制正传 6.0 · 技能库 · 正盈利 */
export default [
      {
        id: "zhengyingli.kuihua",
        name: "葵花宝典",
        conditionText: "4回合冷却",
        cost: { mp: 0 },
        charge: 0,
        cooldown: 4,
        target: "self",
        ops: [{ op: "summon", key: "zhengyingli.kuihua2" }]
      },
      {
        id: "zhengyingli.ducai",
        name: "独裁主义",
        conditionText: "5蓄力",
        cost: { mp: 0 },
        charge: 5,
        cooldown: 0,
        target: "self",
        ops: [
          { op: "status", kind: "ducai", who: "self", rounds: 4, label: "独裁主义" }
        ],
        hooks: {
          damageDealt: [
            {
              op: "if",
              cond: { status: "ducai" },
              then: [
                {
                  op: "if",
                  cond: { summonCount: { op: "lt", right: 3 } },
                  then: [{ op: "summon", key: "zhengyingli.kuihua4" }]
                }
              ]
            }
          ]
        }
      },
      {
        id: "zhengyingli.fukui",
        name: "负亏损",
        conditionText: "1蓄力",
        cost: { mp: 0 },
        charge: 1,
        cooldown: 0,
        target: "self",
        ops: [
          {
            op: "if",
            cond: { left: { mark: "fukui" }, op: "eq", right: 0 },
            then: [
              { op: "stat", stat: "atk", who: "self", mode: "add", value: -110, duration: null },
              { op: "stat", stat: "def", who: "self", mode: "add", value: 110, duration: null },
              { op: "stat", stat: "mres", who: "self", mode: "add", value: 70, duration: null },
              { op: "maxHp", who: "self", delta: -400 },
              { op: "mark", who: "self", key: "fukui", delta: 1 }
            ],
            else: [
              { op: "clearMods", who: "self", stats: ["atk", "def", "mres"] },
              { op: "mark", who: "self", key: "fukui", delta: -1 }
            ]
          }
        ]
      },
      {
        id: "zhengyingli.sile",
        name: "死了没埋",
        conditionText: "6蓝2蓄力",
        cost: { mp: 6 },
        charge: 2,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "maxHp", who: "target", percent: -60 },
          { op: "buff", kind: "fragile", who: "target", percent: 100, duration: 8, stacking: false }
        ]
      }
];

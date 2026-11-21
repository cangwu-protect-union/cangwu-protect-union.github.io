/* 回合制正传 6.0 · 技能库 · 刘滨路 */
export default [
      {
        id: "liubinlu.kuangke",
        name: "旷课",
        conditionText: "被动",
        passive: true,
        cost: { mp: 0 },
        charge: 0,
        cooldown: 0,
        target: "self",
        ops: [],
        hooks: {
          beforeDamage: [
            { op: "roll", key: "kuangke", sides: 6, perTarget: false, label: "旷课" },
            {
              op: "if",
              cond: { left: { counter: "kuangke", perTarget: false }, op: "eq", right: 6 },
              then: [
                { op: "dodge" },
                { op: "mp", who: "self", delta: 1 }
              ]
            }
          ],
          afterAction: [
            { op: "mark", who: "self", key: "dongneng", delta: 1 },
            {
              op: "if",
              cond: { left: { mark: "dongneng" }, op: "ge", right: 7 },
              then: [
                { op: "mark", who: "self", key: "dongneng", delta: -7 },
                { op: "status", kind: "break", who: "allEnemies", rounds: 5, label: "旷课：全体击溃" }
              ]
            }
          ]
        }
      },
      {
        id: "liubinlu.neijuan",
        name: "强制内卷",
        conditionText: "2蓝",
        cost: { mp: 2 },
        charge: 0,
        cooldown: 0,
        target: "enemy",
        ops: [
          {
            op: "tick",
            duration: { unit: "standard", count: 4 },
            label: "强制内卷",
            ops: [{ op: "damage", type: "magic", value: 70 }]
          }
        ]
      },
      {
        id: "liubinlu.xingying",
        name: "形影不离",
        conditionText: "1蓝1蓄力",
        cost: { mp: 1 },
        charge: 1,
        cooldown: 0,
        target: "self",
        ops: [{ op: "summon", key: "liubinlu.xiaoliu" }]
      }
];

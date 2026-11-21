/* 回合制正传 6.0 · 技能库 · 庄文希 */
export default [
      {
        id: "zhuangwenxi.xingliu",
        name: "星流霆击",
        conditionText: "被动",
        passive: true,
        cost: { mp: 0 },
        charge: 0,
        cooldown: 0,
        target: "enemy",
        ops: [],
        hooks: {
          basicMod: [
            { op: "setBasicMod", hits: 2, noBreak: true }
          ]
        }
      },
      {
        id: "zhuangwenxi.jiangwei",
        name: "降维打击",
        conditionText: "被动",
        passive: true,
        cost: { mp: 0 },
        charge: 0,
        cooldown: 0,
        target: "enemy",
        ops: [],
        hooks: {
          basicMod: [
            {
              op: "if",
              cond: { left: { mark: "dim" }, op: "lt", right: 3 },
              then: [
                { op: "mark", who: "self", key: "dim", delta: 1 },
                { op: "maxMp", who: "target", delta: -2 }
              ],
              else: [
                {
                  op: "dice",
                  sides: 8,
                  label: "降维打击",
                  cases: [
                    { in: [6], ops: [{ op: "maxMp", who: "target", delta: -2 }] }
                  ]
                }
              ]
            }
          ]
        }
      },
      {
        id: "zhuangwenxi.liwan",
        name: "力挽狂澜",
        conditionText: "12回合冷却",
        cost: { mp: 0 },
        charge: 0,
        cooldown: 12,
        target: "self",
        ops: [
          { op: "stat", stat: "spd", who: "self", mode: "set", value: 100, duration: 8 },
          { op: "status", kind: "wlk", who: "self", rounds: 8, label: "力挽狂澜" }
        ],
        hooks: {
          basicMod: [
            {
              op: "if",
              cond: { status: "wlk" },
              then: [{ op: "setBasicMod", hits: 3, noBreak: true }]
            }
          ],
          basicHit: [
            {
              op: "if",
              cond: { status: "wlk" },
              then: [
                { op: "damage", type: "true", value: 15 },
                { op: "buff", kind: "fragile", who: "target", percent: 15, duration: 8, stacking: false }
              ]
            }
          ]
        }
      }
];

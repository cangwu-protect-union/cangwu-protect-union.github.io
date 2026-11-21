/* 回合制正传 6.0 · 技能库 · 赵云哲 */
export default [
      {
        id: "zhaoyunzhe.jianguang",
        name: "剑光如我，斩尽牛杂！",
        conditionText: "9蓝",
        cost: { mp: 9 },
        charge: 0,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "damage", type: "magic", value: 10, times: 10, addStun: true },
          {
            op: "if",
            cond: { left: { stat: "target.stunValue" }, op: "eq", right: 5 },
            then: [
              { op: "status", kind: "stun", who: "target", rounds: 8, label: "剑光如我：眩晕" },
              { op: "stunValue", who: "target", delta: -5 }
            ]
          }
        ]
      },
      {
        id: "zhaoyunzhe.chedi",
        name: "彻底疯狂",
        conditionText: "2蓄力",
        passive: false,
        cost: { mp: 0 },
        charge: 2,
        cooldown: 0,
        target: "self",
        ops: [
          { op: "status", kind: "chedi", who: "self", rounds: 12, label: "彻底疯狂" }
        ],
        hooks: {
          damageDealt: [
            {
              op: "if",
              cond: { status: "chedi" },
              then: [
                { op: "counter", who: "self", key: "chedi", perTarget: false, delta: 1 },
                {
                  op: "if",
                  cond: { left: { counter: "chedi", perTarget: false }, op: "ge", right: 4 },
                  then: [
                    { op: "counter", who: "self", key: "chedi", perTarget: false, delta: -4 },
                    { op: "damage", who: "allEnemies", type: "true", value: 65 },
                    { op: "status", kind: "stun", who: "enemyHero", duration: { unit: "targetRound", count: 1 }, label: "彻底疯狂：眩晕" },
                    { op: "status", kind: "daze", who: "enemyHero", duration: { unit: "turnStart", count: 2 }, label: "彻底疯狂：眩晕余波" },
                    { op: "status", kind: "stun", who: "allEnemies", rounds: 1, label: "彻底疯狂：眩晕" }
                  ]
                }
              ]
            }
          ]
        }
      },
      {
        id: "zhaoyunzhe.xipi",
        name: "嬉皮笑脸",
        conditionText: "4回合冷却",
        cost: { mp: 0 },
        charge: 0,
        cooldown: 4,
        target: "enemy",
        ops: [
          { op: "damage", type: "true", value: 65 },
          { op: "status", kind: "xipi", who: "self", rounds: 2, label: "嬉皮笑脸" }
        ],
        hooks: {
          basicHit: [
            {
              op: "if",
              cond: { status: "xipi" },
              then: [
                { op: "damage", who: "target", type: "true", value: 15 }
              ]
            }
          ]
        }
      },
      {
        id: "zhaoyunzhe.gaoleng",
        name: "高冷如冰",
        conditionText: "被动",
        passive: true,
        cost: { mp: 0 },
        charge: 0,
        cooldown: 0,
        target: "self",
        ops: [],
        hooks: {
          basicMod: [
            { op: "setBasicMod", noBreak: true }
          ],
          basicHit: [
            {
              op: "dice",
              sides: 6,
              cases: [
                {
                  roll: 6,
                  ops: [
                    { op: "mark", who: "target", key: "shili", delta: 1 },
                    {
                      op: "if",
                      cond: { left: { mark: "target.shili" }, op: "ge", right: 5 },
                      then: [
                        { op: "buff", kind: "magicVuln", who: "target", percent: 100, duration: { unit: "standard", count: -1 }, label: "卅力满：下次法伤 ×2" },
                        { op: "markClear", who: "target", key: "shili" }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      }
];

/* 回合制正传 6.0 · 技能库 · 吕场龄 */
export default [
      {
        id: "lvchangling.dilei",
        name: "土豆地雷",
        conditionText: "1蓝1蓄力",
        cost: { mp: 1 },
        charge: 1,
        cooldown: 0,
        target: "self",
        forbidEffect: "lvchangling.tifa",
        ops: [
          { op: "summon", key: "lvchangling.dilei" }
        ]
      },
      {
        id: "lvchangling.tifa",
        name: "剃发为僧",
        conditionText: "1蓄力",
        cost: { mp: 0 },
        charge: 1,
        cooldown: 0,
        target: "self",
        ops: [
          {
            op: "if",
            cond: { effect: "lvchangling.tifa" },
            then: [
              { op: "removeEffect", who: "self", key: "lvchangling.tifa" }
            ],
            else: [
              { op: "stat", who: "self", stat: "def", mode: "add", value: 45, duration: null, untilRecast: "lvchangling.tifa" },
              { op: "maxHp", who: "self", delta: 300, untilRecast: "lvchangling.tifa" },
              { op: "heal", who: "self", value: 300, rounding: "none" },
              { op: "stat", who: "self", stat: "spd", mode: "add", value: -25, duration: null, untilRecast: "lvchangling.tifa" },
              {
                op: "tick",
                who: "self",
                permanent: true,
                key: "lvchangling.tifa",
                label: "剃发为僧",
                desc: "防+45、攻变物伤、血上限+300、速−25；每标准回合末未普攻则功德+1；对方血≤100 时无法普攻；免疫击溃与眩晕、免疫脆弱/恐慌。",
                immune: { buffs: ["fragile", "panic"], statuses: ["stun", "break"] },
                breakImmune: true,
                ops: [
                  {
                    op: "if",
                    cond: { left: { counter: "gongdeSwing", perTarget: false }, op: "eq", right: 0 },
                    then: [
                      { op: "mark", who: "self", key: "gongde", delta: 1 },
                      { op: "stat", who: "self", stat: "atk", mode: "add", value: 5, duration: null },
                      { op: "stat", who: "self", stat: "def", mode: "add", value: 5, duration: null },
                      { op: "stat", who: "self", stat: "mres", mode: "add", value: 5, duration: null }
                    ]
                  },
                  { op: "counter", who: "self", key: "gongdeSwing", delta: { mult: { counter: "gongdeSwing", perTarget: false }, factor: -1 }, perTarget: false }
                ]
              }
            ]
          }
        ],
        hooks: {
          basicMod: [
            { op: "if", cond: { effect: "lvchangling.tifa" }, then: [{ op: "setBasicMod", type: "phys" }] }
          ],
          basicGate: [
            {
              op: "if",
              cond: { effect: "lvchangling.tifa" },
              then: [
                {
                  op: "if",
                  cond: { left: { stat: "enemyHero.hp" }, op: "le", right: 100 },
                  then: [{ op: "deny", reason: "对方英雄血量不超过 100，无法普攻" }]
                }
              ]
            }
          ],
          basicHit: [
            { op: "counter", who: "self", key: "gongdeSwing", delta: 1, perTarget: false }
          ]
        }
      },
      {
        id: "lvchangling.chaodu",
        name: "超度",
        conditionText: "5蓝",
        cost: { mp: 5 },
        charge: 0,
        cooldown: 0,
        target: "self",
        ops: [],
        unsupported: "本版未实现：判定依赖「10 秒内喊出一串数字」的场外行为，引擎无法验证，也无法进入回放与状态指纹。"
      },
      {
        id: "lvchangling.gongdewuliang",
        name: "功德无量",
        conditionText: "被动",
        passive: true,
        cost: { mp: 0 },
        charge: 0,
        cooldown: 0,
        target: "self",
        ops: [],
        items: [
          {
            id: "lvchangling.gongdeHeal",
            label: "功德回血",
            requires: [{ mark: "gongde", gte: 1 }],
            noEffect: "lvchangling.tifa",
            ops: [
              { op: "heal", who: "self", value: 150, rounding: "none" },
              { op: "mark", who: "self", key: "gongde", delta: -1 },
              { op: "stat", who: "self", stat: "atk", mode: "add", value: -5, duration: null },
              { op: "stat", who: "self", stat: "def", mode: "add", value: -5, duration: null },
              { op: "stat", who: "self", stat: "mres", mode: "add", value: -5, duration: null }
            ]
          }
        ]
      }
];

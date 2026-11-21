/* 回合制正传 6.0 · 技能库 · 王春雨 */
export default [
      {
        id: "wangchunyu.shengdan",
        name: "剩蛋老人",
        conditionText: "2蓄力",
        cost: { mp: 0 },
        charge: 2,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "damage", who: "target", type: "true", value: 110 },
          { op: "status", who: "target", kind: "noBasic", rounds: { unit: "targetRound", count: 1 }, label: "剩蛋老人：无法普攻" },
          { op: "status", who: "target", kind: "noCharge", rounds: { unit: "targetRound", count: 1 }, label: "剩蛋老人：无法蓄力" },
          { op: "buff", who: "target", kind: "brave", percent: 20, duration: { unit: "targetRound", count: 2 } }
        ]
      },
      {
        id: "wangchunyu.xuefu",
        name: "学富五车",
        conditionText: "4回合3蓝",
        cost: { mp: 3 },
        charge: 0,
        cooldown: 4,
        target: "self",
        ops: [
          {
            op: "tick",
            who: "self",
            duration: { unit: "enemyRound", count: 3 },
            key: "wangchunyu.xuefu",
            label: "学富五车",
            desc: "受到的伤害不扣血，改为等量增加血上限（强扣不转换）。",
            ops: []
          }
        ],
        hooks: {
          beforeDamage: [
            { op: "if", cond: { effect: "wangchunyu.xuefu" }, then: [{ op: "convert", to: "maxHp" }] }
          ]
        }
      },
      {
        id: "wangchunyu.gaobao",
        name: "糕爆战士",
        conditionText: "5蓝3蓄力",
        cost: { mp: 5 },
        charge: 3,
        cooldown: 0,
        target: "self",
        ops: [
          { op: "stat", who: "self", stat: "def", mode: "set", value: 0, duration: 4 },
          { op: "stat", who: "self", stat: "mres", mode: "set", value: 0, duration: 4 },
          { op: "stat", who: "self", stat: "spd", mode: "add", value: 140, duration: 4 },
          { op: "stat", who: "self", stat: "atk", mode: "add", value: -10, duration: 4 }
        ]
      },
      {
        id: "wangchunyu.chunyu",
        name: "春雨贵如油",
        conditionText: "？",
        cost: { mp: 0 },
        charge: 0,
        cooldown: 0,
        target: "self",
        ops: [],
        unsupported: "本版未实现：seed 条件写作「？」，效果为空，档案第 4 条只有标题，缺可核对的技能文本与数值。"
      }
];

/* 回合制正传 6.0 · 技能库 · 甲天浩（plan.mjs --write 生成，之后直接改这里） */
export default [
  {
    id: "jiatianhao.xiangsi",
    name: "向死而生",
    conditionText: "被动",
    passive: true,
    cost: { mp: 0 },
    charge: 0,
    cooldown: 0,
    target: "self",
    undying: true,
    ops: [],
    hooks: {
      basicMod: [
        {
          op: "if",
          cond: { status: "undying" },
          then: [{ op: "setBasicMod", type: "true", healBack: true, noBreak: true }]
        }
      ]
    }
  },
  {
    id: "jiatianhao.zaipan",
    name: "再攀高峰",
    conditionText: "1蓝3蓄力",
    cost: { mp: 1 },
    charge: 3,
    cooldown: 0,
    target: "enemy",
    ops: [
      { op: "damage", who: "target", type: "phys", value: 200 },
      {
        op: "if",
        cond: { left: { mark: "self.deaths" }, op: "gt", right: 0 },
        then: [
          {
            op: "damage",
            who: "target",
            type: "true",
            value: { mult: { mark: "self.deaths" }, factor: 100 }
          }
        ]
      }
    ]
  },
  {
    id: "jiatianhao.shencan",
    name: "身残志坚",
    conditionText: "3蓝6蓄力",
    cost: { mp: 3 },
    charge: 6,
    cooldown: 0,
    target: "self",
    ops: [
      {
        op: "tick",
        who: "self",
        key: "shencan",
        label: "身残志坚",
        desc: "每个自己回合结束：速度改为 +（血上限−当前血），血上限 +10；持续 2＋死亡次数 个自己回合，到期清掉速度加成。",
        duration: { unit: "selfRound", count: { plus: [2, { mark: "self.deaths" }] } },
        ops: [
          { op: "clearMods", who: "self", stats: ["spd"] },
          {
            op: "stat",
            who: "self",
            stat: "spd",
            mode: "add",
            value: { hpPercent: "self.lost", percent: 100 }
          },
          { op: "stat", who: "self", stat: "maxHp", mode: "add", value: 10 }
        ],
        onExpire: [{ op: "clearMods", who: "self", stats: ["spd"] }]
      }
    ]
  },
  {
    id: "jiatianhao.miaoshou",
    name: "妙手回春",
    conditionText: "5回合冷却",
    cost: { mp: 0 },
    charge: 0,
    cooldown: 5,
    target: "self",
    ops: [
      { op: "heal", who: "self", value: 80 },
      {
        op: "stat",
        who: "self",
        stat: "spd",
        mode: "add",
        value: -15,
        duration: { unit: "selfRound", count: 4 }
      }
    ]
  }
];

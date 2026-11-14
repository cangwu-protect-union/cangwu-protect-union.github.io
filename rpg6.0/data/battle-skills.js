/* 回合制正传 6.0 · 技能库
   每条技能对应 _local/docs/回合制6.0测试功能-角色机制.md 里的一节。
   conditionText 必须与角色档案里的条件文本一致，否则 skills.validate 会拒绝这个技能。
   写法：每个 op 的字段见 _local/docs/回合制6.0测试功能-plan.md 第 5 节。 */
window.RPG6_SKILLS = {
  version: 1,
  characters: {

    "刘文哲": [
      {
        id: "liuwenzhe.nimashile",
        name: "拟玛使勒",
        conditionText: "1蓝",
        cost: { mp: 1 },
        charge: 0,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "maxMp", who: "target", delta: -3 }
        ]
      },
      {
        id: "liuwenzhe.zhiming",
        name: "致命打只因",
        conditionText: "1蓝4蓄力",
        cost: { mp: 1 },
        charge: 4,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "damage", type: "phys", value: 995 }
        ]
      },
      {
        id: "liuwenzhe.yidefuren",
        name: "以德服人",
        conditionText: "被动",
        passive: true,
        cost: { mp: 0 },
        charge: 0,
        cooldown: 0,
        target: "enemy",
        ops: [],
        hooks: {
          basicHit: [
            { op: "directLoss", who: "target", value: 30 }
          ],
          breakAction: [
            { op: "damage", type: "phys", value: { per: { stat: "target.breakValue" }, factor: 50 } }
          ]
        }
      }
    ],

    "李硕": [
      {
        id: "lishuo.xuhuang",
        name: "虚晃亿枪",
        conditionText: "1蓝",
        cost: { mp: 1 },
        charge: 0,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "damage", type: "true", value: 120 }
        ]
      },
      {
        id: "lishuo.yuzhou",
        name: "宇宙的奥秘",
        conditionText: "6蓝",
        cost: { mp: 6 },
        charge: 0,
        cooldown: 0,
        target: "enemy",
        ops: [
          {
            op: "tick",
            duration: { unit: "standard", count: 5 },
            unstoppable: true,
            label: "宇宙的奥秘",
            ops: [{ op: "directLoss", value: 100 }]
          }
        ]
      },
      {
        id: "lishuo.dacongming",
        name: "大聪明",
        conditionText: "2蓄力",
        cost: { mp: 0 },
        charge: 2,
        cooldown: 0,
        target: "self",
        ops: [
          { op: "heal", who: "self", value: { hpPercent: "self.current", percent: 40 }, rounding: "ten", bonus: 30 },
          { op: "mp", who: "self", delta: 3 }
        ]
      }
    ],

    "谢雨辰": [
      {
        id: "xieyuchen.yishou",
        name: "一手好牌",
        conditionText: "4回合冷却",
        cost: { mp: 0 },
        charge: 0,
        cooldown: 4,
        target: "enemy",
        ops: [
          {
            op: "dice",
            sides: 6,
            cases: [
              { in: [1, 5], ops: [{ op: "damage", type: "magic", value: 70, times: 4, noBreak: true }] },
              { in: [6], ops: [{ op: "damage", type: "magic", value: 70, times: 4, noBreak: true, factor: 2.5 }] }
            ]
          }
        ]
      },
      {
        id: "xieyuchen.yonggan",
        name: "勇敢勇敢我的朋友！",
        conditionText: "2蓝2蓄力",
        cost: { mp: 2 },
        charge: 2,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "stat", stat: "spd", who: "self", mode: "add", value: 150, duration: 5 },
          { op: "stat", stat: "spd", who: "target", mode: "add", value: 50, duration: 5 },
          {
            op: "schedule",
            on: "self",
            after: 5,
            label: "勇敢勇敢·回落",
            ops: [
              { op: "stat", stat: "spd", who: "self", mode: "add", value: -200, duration: 3 },
              { op: "stat", stat: "spd", who: "target", mode: "add", value: -60, duration: 3 }
            ]
          }
        ]
      },
      {
        id: "xieyuchen.ernv",
        name: "儿女情肠",
        conditionText: "2蓄力",
        cost: { mp: 0 },
        charge: 2,
        cooldown: 0,
        target: "allEnemies",
        ops: [
          {
            op: "tick",
            duration: { unit: "standard", count: 3 },
            label: "儿女情肠",
            ops: [{ op: "damage", type: "true", value: 30, noBreak: true }]
          }
        ]
      }
    ],

    "江雨轩": [
      {
        id: "jiangyuxuan.taishan",
        name: "泰山压顶",
        conditionText: "1蓄力",
        cost: { mp: 0 },
        charge: 1,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "damage", type: "phys", value: 200 },
          { op: "stat", stat: "spd", who: "target", mode: "set", value: 25, duration: { unit: "targetRound", count: 10 } },
          { op: "buff", kind: "fragile", who: "target", percent: 100, duration: { unit: "targetRound", count: 10 } }
        ]
      },
      {
        id: "jiangyuxuan.feifei",
        name: "肥肥反弹",
        conditionText: "1蓄力",
        cost: { mp: 0 },
        charge: 1,
        cooldown: 0,
        target: "self",
        ops: [],
        chargeOps: [
          { op: "reflect", who: "self", factor: 2, stunRounds: 3 }
        ]
      },
      {
        id: "jiangyuxuan.ganfanren",
        name: "干饭人，干饭魂！",
        conditionText: "1蓝",
        cost: { mp: 1 },
        charge: 0,
        cooldown: 0,
        target: "ally",
        ops: [
          { op: "heal", who: "self", value: { hpPercent: "self.lost", percent: 25 }, rounding: "int" },
          { op: "dispel", who: "self", scope: "debuff" }
        ]
      }
    ],

    "王泺然": [
      {
        id: "wangluor.rendage",
        name: "认大哥",
        conditionText: "1蓝",
        cost: { mp: 1 },
        charge: 0,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "counter", who: "self", key: "rendage", delta: 1 },
          {
            op: "if",
            cond: { left: { counter: "rendage" }, op: "ge", right: 3 },
            then: [
              { op: "stat", stat: "def", who: "target", mode: "set", value: 0, duration: null },
              { op: "stat", stat: "mres", who: "target", mode: "set", value: 0, duration: null }
            ],
            else: [
              { op: "stat", stat: "def", who: "target", mode: "set", value: 0, duration: { unit: "targetRound", count: 5 } },
              { op: "stat", stat: "mres", who: "target", mode: "set", value: 0, duration: { unit: "targetRound", count: 5 } }
            ]
          }
        ]
      },
      {
        id: "wangluor.paozufen",
        name: "刨祖坟",
        conditionText: "3蓄力",
        cost: { mp: 0 },
        charge: 3,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "damage", type: "phys", value: { plus: [250, { stat: "self.hp" }] } },
          { op: "healFull", who: "self" },
          { op: "stat", stat: "atk", who: "target", mode: "add", value: 50, duration: null },
          { op: "stat", stat: "spd", who: "target", mode: "add", value: 30, duration: null }
        ]
      },
      {
        id: "wangluor.diguo",
        name: "帝国主义",
        conditionText: "2蓝",
        cost: { mp: 2 },
        charge: 0,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "damage", type: "true", value: 320 },
          { op: "taunt", who: "self", delta: 3 },
          { op: "stat", stat: "atk", who: "target", mode: "add", value: 40, duration: 10 },
          { op: "stat", stat: "spd", who: "target", mode: "add", value: 10, duration: 10 }
        ]
      }
    ],

    "郑湾湾": [
      {
        id: "zhengwanwan.paihou",
        name: "拍后脑勺",
        conditionText: "1蓝",
        cost: { mp: 1 },
        charge: 0,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "damage", type: "phys", value: 130 },
          { op: "buff", kind: "panic", who: "target", percent: 20, duration: 4 },
          { op: "interrupt", who: "target" }
        ]
      },
      {
        id: "zhengwanwan.banzhuren",
        name: "班主任的凝视",
        conditionText: "2蓝1蓄力",
        cost: { mp: 2 },
        charge: 1,
        cooldown: 0,
        target: "allEnemies",
        ops: [
          {
            op: "tick",
            duration: { unit: "standard", count: 7 },
            label: "班主任的凝视",
            ops: [{ op: "damage", type: "true", value: 25, noBreak: true }]
          },
          { op: "stat", stat: "atk", who: "target", mode: "add", value: -25, duration: 7 },
          { op: "stat", stat: "spd", who: "target", mode: "add", value: -25, duration: 7 }
        ]
      },
      {
        id: "zhengwanwan.shouji",
        name: "手机铃声",
        conditionText: "6回合冷却",
        cost: { mp: 0 },
        charge: 0,
        cooldown: 6,
        target: "enemy",
        ops: [
          {
            op: "tick",
            duration: { unit: "standard", count: 3 },
            label: "手机铃声",
            ops: [
              { op: "damage", type: "magic", value: 80, noBreak: true },
              {
                op: "dice",
                sides: 6,
                cases: [
                  { in: [6], ops: [{ op: "mp", who: "self", delta: 1 }] }
                ]
              }
            ]
          }
        ]
      },
      {
        id: "zhengwanwan.sanjiaoban",
        name: "三角板暴风雨",
        conditionText: "6蓝2蓄力",
        cost: { mp: 6 },
        charge: 2,
        cooldown: 0,
        target: "enemy",
        ops: [
          {
            op: "tick",
            duration: { unit: "standard", count: 5 },
            label: "三角板暴风雨",
            ops: [{ op: "damage", type: "last", value: 245 }]
          },
          {
            op: "schedule",
            on: "self",
            after: 5,
            label: "三角板收尾",
            ops: [{ op: "damage", type: "last", value: 100 }]
          }
        ]
      }
    ],

    "于梓越": [
      {
        id: "yuzy.jishen",
        name: "鸡肾豹肝",
        conditionText: "1蓄力",
        cost: { mp: 0 },
        charge: 1,
        cooldown: 0,
        target: "enemy",
        ops: [
          {
            op: "dice",
            sides: 6,
            cases: [
              {
                in: [1, 3],
                ops: [
                  { op: "damage", type: "magic", value: 160, noBreak: true },
                  { op: "buff", kind: "fragile", who: "target", percent: 75, duration: 1 }
                ]
              },
              {
                in: [4, 6],
                ops: [
                  { op: "damage", type: "true", value: 150, noBreak: true },
                  { op: "stat", stat: "def", who: "target", mode: "add", value: -5, duration: null },
                  { op: "stat", stat: "mres", who: "target", mode: "add", value: -5, duration: null }
                ]
              }
            ]
          }
        ]
      },
      {
        id: "yuzy.xiajibada",
        name: "夏极八打",
        conditionText: "5蓄力",
        cost: { mp: 0 },
        charge: 5,
        cooldown: 0,
        target: "self",
        ops: [
          { op: "stat", stat: "atk", who: "self", mode: "add", value: -35, duration: 9 },
          { op: "stat", stat: "spd", who: "self", mode: "add", value: 295, duration: 9 },
          { op: "status", kind: "noSkill", who: "self", rounds: 9 },
          { op: "status", kind: "noBreakOut", who: "self", rounds: 9 }
        ]
      },
      {
        id: "yuzy.xueshenke",
        name: "削肾客的救赎",
        conditionText: "2蓝",
        cost: { mp: 2 },
        charge: 0,
        cooldown: 0,
        target: "any",
        ops: [
          { op: "use", skillId: "yuzy.jishen", times: 2 },
          { op: "stat", stat: "spd", who: "target", mode: "mul", value: 2, duration: 8 }
        ]
      }
    ]
  }
};

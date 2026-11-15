/* 回合制正传 6.0 · 技能库
   每条技能对应 _local/docs/回合制6.0测试功能-角色机制.md 里的一节。
   conditionText 必须与角色档案里的条件文本一致，否则 skills.validate 会拒绝这个技能。
   写法：每个 op 的字段见 _local/docs/回合制6.0测试功能-plan.md 第 5 节。 */
window.RPG6_SKILLS = {
  version: 1,
  /* 标记：谁身上有哪些计数器。对手可见、可被对手的技能操作（mark / markClear / dispel marks）。 */
  marks: {
    "王荣逸": [{ key: "shuati", name: "刷题", max: 3, init: 0 }],
    "庄文希": [{ key: "dim", name: "降维打击", max: 3, init: 0 }],
    "张克太": [
      { key: "dealt", name: "造成伤害", max: 3, init: 0 },
      { key: "taken", name: "受到伤害", max: 3, init: 0 },
      { key: "drain", name: "属性削弱", max: 3, init: 0 }
    ],
    "金圣杰": [
      { key: "jien", name: "受伤计数", max: 6, init: 0 },
      { key: "hit3", name: "3 次伤害", max: 3, init: 0 },
      { key: "hit5", name: "5 次伤害", max: 5, init: 0 }
    ],
    "田誉清": [{ key: "naijiu", name: "耐久", max: 9999, init: 3, hideMax: true }],
    "刘滨路": [{ key: "dongneng", name: "动能", max: 7, init: 0 }],
    "正盈利": [{ key: "fukui", name: "负亏损", max: 1, init: 0 }]
  },
  /* 召唤物定义：ttl 按标准回合；targetable 只有带血量的召唤物为真；
     aura 每标准回合末，onExpire 到期时，attack 每标准回合末自动攻击（被眩晕则跳过）。 */
  summons: {
    "liubinlu.xiaoliu": {
      name: "小刘亦萱",
      ttl: 4,
      onExpire: [
        { op: "damage", who: "allEnemies", type: "true", value: 70, noBreak: true }
      ]
    },
    "zhengyingli.kuihua2": {
      name: "葵花宝典",
      ttl: 2,
      aura: [
        { op: "damage", who: "allEnemies", type: "magic", value: 50, noBreak: true }
      ],
      onExpire: [
        { op: "damage", who: "allEnemies", type: "phys", value: 75, noBreak: true }
      ]
    },
    "zhengyingli.kuihua4": {
      name: "葵花宝典",
      ttl: 4,
      aura: [
        { op: "damage", who: "allEnemies", type: "magic", value: 50, noBreak: true }
      ],
      onExpire: [
        { op: "damage", who: "allEnemies", type: "phys", value: 75, noBreak: true }
      ]
    },
    "yangshuhan.tomb": {
      name: "杨舒然之墓",
      stats: { atk: 200, def: 0, mres: 0, hp: 1200, mp: 0, spd: 0 },
      targetable: true,
      breakImmune: true,
      taunt: 0,
      attack: [
        { op: "damage", who: "enemyHero", type: "true", value: { stat: "self.atk" }, noBreak: true }
      ]
    }
  },
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
    ],

    "杨舒然": [
      {
        id: "yangshuran.gaoyuan",
        name: "高猿长啸",
        conditionText: "2蓄力",
        cost: { mp: 0 },
        charge: 2,
        cooldown: 0,
        target: "allEnemies",
        ops: [
          {
            op: "tick",
            duration: { unit: "standard", count: 6 },
            label: "高猿长啸",
            desc: "每标准回合 30 真伤（计击溃值）；对方每次行动前掷骰，掷出 2-5 跳过这次行动",
            gate: { sides: 6, cancel: [2, 3, 4, 5] },
            ops: [
              { op: "damage", type: "true", value: 30 }
            ]
          }
        ]
      },
      {
        id: "yangshuran.yuanli",
        name: "猿力与你同在",
        conditionText: "2蓝",
        cost: { mp: 2 },
        charge: 0,
        cooldown: 0,
        target: "enemy",
        /* 释放时三选一：210 普伤 / 160 法伤 / 120 真伤，回复造成的伤害，无击溃值 */
        choices: [
          {
            key: "phys",
            label: "210 普伤",
            ops: [{ op: "damage", type: "phys", value: 210, noBreak: true, healBack: true }]
          },
          {
            key: "magic",
            label: "160 法伤",
            ops: [{ op: "damage", type: "magic", value: 160, noBreak: true, healBack: true }]
          },
          {
            key: "true",
            label: "120 真伤",
            ops: [{ op: "damage", type: "true", value: 120, noBreak: true, healBack: true }]
          }
        ],
        /* 旧口径：6.0-engine.3 及更早的战报没有 choice 字段，按三段依次结算回放 */
        ops: [
          { op: "damage", type: "phys", value: 210, noBreak: true, healBack: true },
          { op: "damage", type: "magic", value: 160, noBreak: true, healBack: true },
          { op: "damage", type: "true", value: 120, noBreak: true, healBack: true }
        ]
      },
      {
        id: "yangshuran.gouzhi",
        name: "苟之危笑",
        conditionText: "2蓝2蓄力",
        cost: { mp: 2 },
        charge: 2,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "stat", stat: "maxHp", who: "target", mode: "set", value: { minus: [{ stat: "self.hp" }, 5] }, duration: null }
        ]
      },
      {
        id: "yangshuran.juedui",
        name: "绝对防御",
        conditionText: "无",
        once: true,
        cost: { mp: 0 },
        charge: 0,
        cooldown: 0,
        target: "self",
        ops: [
          { op: "status", kind: "noDeath", who: "self", rounds: 6, label: "不会死亡" }
        ]
      }
    ],

    "包必冉": [
      {
        id: "baobiran.wuneng",
        name: "无能狂怒",
        conditionText: "1蓝",
        cost: { mp: 1 },
        charge: 0,
        cooldown: 0,
        target: "enemy",
        ops: [
          {
            op: "tick",
            duration: { unit: "standard", count: 5 },
            label: "无能狂怒",
            ops: [
              { op: "damage", type: "basic", value: { stat: "self.atk" } }
            ]
          }
        ]
      },
      {
        id: "baobiran.kouchu",
        name: "口出狂言",
        conditionText: "2蓝1蓄力",
        cost: { mp: 2 },
        charge: 1,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "damage", type: "phys", value: 175 },
          {
            op: "tick",
            duration: { unit: "standard", count: 4 },
            label: "口出狂言",
            ops: [
              { op: "buff", kind: "panic", who: "target", percent: 5, duration: 4 }
            ]
          }
        ]
      },
      {
        id: "baobiran.sanbei",
        name: "三杯不过岗",
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
              op: "dice",
              sides: 6,
              cases: [
                { in: [2, 4, 6], ops: [{ op: "setBasicMod", type: "true", factor: 2 }] },
                { in: [1, 3, 5], ops: [{ op: "setBasicMod", healInstead: true }] }
              ]
            }
          ]
        }
      }
    ],

    "宋知远": [
      {
        id: "songzhiyuan.dianmo",
        name: "电摩冲击",
        conditionText: "3蓄力",
        cost: { mp: 0 },
        charge: 3,
        cooldown: 0,
        target: "self",
        ops: [
          { op: "status", kind: "noSkill", who: "self", rounds: 10, label: "无法使用技能" },
          {
            op: "tick",
            duration: { unit: "standard", count: 10 },
            label: "电摩冲击",
            ops: [
              {
                op: "if",
                cond: { left: { stat: "self.spd" }, op: "lt", right: 170 },
                then: [
                  {
                    op: "if",
                    cond: { left: { plus: [{ stat: "self.spd" }, 30] }, op: "gt", right: 170 },
                    then: [{ op: "stat", stat: "spd", who: "self", mode: "add", value: { minus: [170, { stat: "self.spd" }] }, duration: null }],
                    else: [{ op: "stat", stat: "spd", who: "self", mode: "add", value: 30, duration: null }]
                  }
                ],
                else: []
              },
              {
                op: "if",
                cond: { left: { stat: "self.atk" }, op: "lt", right: 230 },
                then: [
                  {
                    op: "if",
                    cond: { left: { plus: [{ stat: "self.atk" }, 20] }, op: "gt", right: 230 },
                    then: [{ op: "stat", stat: "atk", who: "self", mode: "add", value: { minus: [230, { stat: "self.atk" }] }, duration: null }],
                    else: [{ op: "stat", stat: "atk", who: "self", mode: "add", value: 20, duration: null }]
                  }
                ],
                else: []
              }
            ]
          }
        ]
      },
      {
        id: "songzhiyuan.feilong",
        name: "肥龙在天",
        conditionText: "1蓄力",
        cost: { mp: 0 },
        charge: 1,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "damage", type: "phys", value: 180 },
          { op: "damage", type: "true", value: 180 },
          { op: "breakValue", who: "target", delta: 3 },
          { op: "forceBreak", who: "target" }
        ]
      },
      {
        id: "songzhiyuan.shuijiao",
        name: "睡觉",
        conditionText: "1蓝",
        cost: { mp: 1 },
        charge: 0,
        cooldown: 0,
        target: "self",
        ops: [
          { op: "taunt", who: "self", delta: 1 },
          { op: "stat", stat: "def", who: "self", mode: "add", value: 45, duration: 3 },
          { op: "stat", stat: "mres", who: "self", mode: "add", value: 45, duration: 3 },
          {
            op: "tick",
            duration: { unit: "standard", count: 3 },
            label: "睡觉",
            ops: [
              { op: "maxHp", who: "self", delta: 80 },
              { op: "heal", who: "self", value: 150, rounding: "none" }
            ]
          },
          { op: "status", kind: "break", who: "self", rounds: 3, label: "击溃" }
        ]
      },
      {
        id: "songzhiyuan.picao",
        name: "皮糙肉厚",
        conditionText: "被动",
        passive: true,
        cost: { mp: 0 },
        charge: 0,
        cooldown: 0,
        target: "self",
        unsupported: "受击免疫要在伤害结算前拦截，本批未实现",
        ops: []
      }
    ],

    "张家铭": [
      {
        id: "zhangjiaming.xiaoxingxing",
        name: "小行星撞击",
        conditionText: "2蓄力",
        cost: { mp: 0 },
        charge: 2,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "damage", type: "phys", value: { per: { stat: "target.def" }, factor: 6 }, noBreak: true }
        ]
      },
      {
        id: "zhangjiaming.saijin",
        name: "塞进垃圾桶",
        conditionText: "1蓝3蓄力",
        cost: { mp: 1 },
        charge: 3,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "damage", type: "phys", value: 300 },
          { op: "status", kind: "stun", who: "target", rounds: 5, label: "眩晕" },
          {
            op: "tick",
            duration: { unit: "targetRound" },
            permanent: true,
            label: "塞进垃圾桶",
            ops: [{ op: "damage", type: "true", value: 50, fromBuff: true }]
          }
        ]
      },
      {
        id: "zhangjiaming.qiufeng",
        name: "秋风扫落叶",
        conditionText: "1蓝1蓄力",
        cost: { mp: 1 },
        charge: 1,
        cooldown: 0,
        target: "allEnemies",
        ops: [
          {
            op: "tick",
            duration: { unit: "standard", count: 5 },
            label: "秋风扫落叶",
            ops: [{ op: "damage", type: "basic", value: { stat: "self.atk" } }]
          }
        ]
      },
      {
        id: "zhangjiaming.weixiang",
        name: "卫委壮观",
        conditionText: "被动",
        passive: true,
        cost: { mp: 0 },
        charge: 0,
        cooldown: 0,
        target: "self",
        unsupported: "花防御/法抗主动闪避是可选防御动作，界面还没有这个入口",
        ops: []
      }
    ],

    "王荣逸": [
      {
        id: "wangrongyi.shuati",
        name: "刷题",
        conditionText: "1蓝",
        cost: { mp: 1 },
        charge: 0,
        cooldown: 0,
        target: "self",
        requires: [{ mark: "shuati", lte: 2, reason: "刷题已满 3 层" }],
        ops: [
          { op: "mark", who: "self", key: "shuati", delta: 1 },
          { op: "stat", stat: "atk", who: "self", mode: "add", value: 20, duration: null },
          { op: "stat", stat: "def", who: "self", mode: "add", value: 20, duration: null },
          { op: "stat", stat: "mres", who: "self", mode: "add", value: 20, duration: null },
          { op: "stat", stat: "spd", who: "self", mode: "add", value: 20, duration: null },
          { op: "maxHp", who: "self", delta: 120 },
          { op: "heal", who: "self", value: 160, rounding: "none" },
          { op: "maxMp", who: "self", delta: 3 },
          { op: "dispel", who: "self", scope: "breakValue" }
        ]
      },
      {
        id: "wangrongyi.xuexi",
        name: "学习氛围",
        conditionText: "无",
        cost: { mp: 0 },
        charge: 0,
        cooldown: 0,
        target: "self",
        unsupported: "「可停止」是给已挂持续效果留的开关，界面还没有关闭入口",
        ops: []
      },
      {
        id: "wangrongyi.xiti",
        name: "习题轰炸",
        conditionText: "1蓝1蓄力",
        cost: { mp: 1 },
        charge: 1,
        cooldown: 0,
        target: "enemy",
        requires: [{ mark: "shuati", gte: 1, reason: "需要先刷题" }],
        ops: [
          {
            op: "if",
            cond: { left: { mark: "shuati" }, op: "eq", right: 1 },
            then: [{ op: "damage", type: "phys", value: 100 }],
            else: [
              {
                op: "if",
                cond: { left: { mark: "shuati" }, op: "eq", right: 2 },
                then: [{ op: "damage", type: "phys", value: 150 }],
                else: [{ op: "damage", type: "phys", value: 210 }]
              }
            ]
          },
          { op: "mp", who: "self", delta: 3 },
          { op: "status", kind: "stun", who: "target", rounds: 3, label: "眩晕" }
        ]
      },
      {
        id: "wangrongyi.manfen",
        name: "满分嘲讽",
        conditionText: "3蓝3蓄力",
        cost: { mp: 3 },
        charge: 3,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "damage", type: "true", value: { plus: [240, { per: { mark: "shuati" }, factor: 150 }] } }
        ]
      }
    ],

    "庄文希": [
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
    ],

    "张克太": [
      {
        id: "zhangketa.jiba",
        name: "吉罢之歌",
        conditionText: "2蓝",
        cost: { mp: 2 },
        charge: 0,
        cooldown: 0,
        target: "enemy",
        ops: [
          {
            op: "tick",
            duration: { unit: "standard", count: 5 },
            label: "吉罢之歌",
            breakOnSourceStatus: ["stun", "break"],
            ops: [
              { op: "damage", type: "magic", value: 60, noStun: true }
            ]
          }
        ]
      },
      {
        id: "zhangketa.fubanzhuren",
        name: "副班主任之威[余威尚存]",
        conditionText: "6蓝4蓄力",
        cost: { mp: 6 },
        charge: 4,
        cooldown: 0,
        target: "self",
        ops: [
          { op: "stat", stat: "atk", who: "self", mode: "add", value: 80, duration: 10 },
          { op: "stat", stat: "spd", who: "self", mode: "add", value: 80, duration: 10 },
          { op: "stat", stat: "atk", who: "self", mode: "add", value: 30, duration: 10 },
          { op: "stat", stat: "def", who: "self", mode: "add", value: 30, duration: 10 },
          { op: "stat", stat: "mres", who: "self", mode: "add", value: 30, duration: 10 },
          { op: "stat", stat: "spd", who: "self", mode: "add", value: 30, duration: 10 },
          { op: "status", kind: "cannotAct", who: "self", rounds: 5, label: "副班主任：无法行动" },
          {
            op: "schedule",
            on: "self",
            after: 4,
            label: "副班主任：余威尚存",
            ops: [
              { op: "status", kind: "noSkill", who: "self", rounds: 6, label: "副班主任：只能普攻" },
              { op: "status", kind: "onlyBasic", who: "self", rounds: 6, label: "副班主任：只能普攻" }
            ]
          }
        ]
      },
      {
        id: "zhangketa.lsp",
        name: "LSP",
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
              op: "if",
              cond: { gender: "target", eq: "女" },
              then: [
                { op: "stat", stat: "atk", who: "target", mode: "add", value: 10, duration: null },
                { op: "stat", stat: "def", who: "target", mode: "add", value: 10, duration: null },
                { op: "stat", stat: "spd", who: "target", mode: "add", value: 10, duration: null },
                { op: "stat", stat: "mres", who: "target", mode: "add", value: -5, duration: null }
              ]
            },
            {
              op: "if",
              cond: { gender: "self", eq: "女" },
              then: [
                { op: "stat", stat: "atk", who: "self", mode: "add", value: 10, duration: null },
                { op: "stat", stat: "def", who: "self", mode: "add", value: 10, duration: null },
                { op: "stat", stat: "spd", who: "self", mode: "add", value: 10, duration: null },
                { op: "stat", stat: "mres", who: "self", mode: "add", value: -5, duration: null }
              ]
            }
          ]
        }
      },
      {
        id: "zhangketa.yucuo",
        name: "愈挫愈勇",
        conditionText: "被动",
        passive: true,
        cost: { mp: 0 },
        charge: 0,
        cooldown: 0,
        target: "self",
        ops: [],
        hooks: {
          damageDealt: [
            { op: "mark", who: "self", key: "dealt", delta: 1 },
            {
              op: "if",
              cond: { left: { mark: "dealt" }, op: "ge", right: 3 },
              then: [
                { op: "mark", who: "self", key: "dealt", delta: -3 },
                { op: "stat", stat: "atk", who: "self", mode: "add", value: 5, duration: null }
              ]
            }
          ],
          damageTaken: [
            { op: "mark", who: "self", key: "taken", delta: 1 },
            {
              op: "if",
              cond: { left: { mark: "taken" }, op: "ge", right: 3 },
              then: [
                { op: "mark", who: "self", key: "taken", delta: -3 },
                { op: "stat", stat: "def", who: "self", mode: "add", value: 5, duration: null }
              ]
            }
          ],
          statDrained: [
            { op: "mark", who: "self", key: "drain", delta: 1 },
            {
              op: "if",
              cond: { left: { mark: "drain" }, op: "ge", right: 3 },
              then: [
                { op: "mark", who: "self", key: "drain", delta: -3 },
                { op: "stat", stat: "mres", who: "self", mode: "add", value: 5, duration: null },
                { op: "stat", stat: "spd", who: "self", mode: "add", value: 5, duration: null }
              ]
            }
          ]
        }
      }
    ],

    "金圣杰": [
      {
        id: "jinshengjie.zaijie",
        name: "在杰难逃",
        conditionText: "被动",
        passive: true,
        cost: { mp: 0 },
        charge: 0,
        cooldown: 0,
        target: "enemy",
        ops: [],
        hooks: {
          damageDealt: [
            { op: "mark", who: "self", key: "hit3", delta: 1 },
            {
              op: "if",
              cond: { left: { mark: "hit3" }, op: "ge", right: 3 },
              then: [
                { op: "mark", who: "self", key: "hit3", delta: -3 },
                { op: "stat", stat: "atk", who: "target", mode: "add", value: -5, duration: null },
                { op: "stat", stat: "def", who: "target", mode: "add", value: -5, duration: null }
              ]
            },
            { op: "mark", who: "self", key: "hit5", delta: 1 },
            {
              op: "if",
              cond: { left: { mark: "hit5" }, op: "ge", right: 5 },
              then: [
                { op: "mark", who: "self", key: "hit5", delta: -5 },
                { op: "stat", stat: "spd", who: "target", mode: "add", value: -5, duration: null },
                { op: "stat", stat: "mres", who: "target", mode: "add", value: -5, duration: null },
                { op: "maxHp", who: "target", delta: -30 }
              ]
            }
          ]
        }
      },
      {
        id: "jinshengjie.jiechu",
        name: "杰除封印",
        conditionText: "1蓄力",
        cost: { mp: 0 },
        charge: 1,
        cooldown: 0,
        target: "self",
        ops: [
          { op: "stat", stat: "atk", who: "self", mode: "add", value: 70, duration: null },
          { op: "stat", stat: "spd", who: "self", mode: "add", value: 40, duration: null },
          { op: "stat", stat: "mres", who: "self", mode: "add", value: -100, duration: null },
          {
            op: "schedule",
            on: "self",
            after: 2,
            label: "杰除封印·第 2 回合",
            ops: [
              { op: "stat", stat: "atk", who: "self", mode: "add", value: -20, duration: null },
              { op: "stat", stat: "spd", who: "self", mode: "add", value: -10, duration: null },
              { op: "stat", stat: "mres", who: "self", mode: "add", value: 20, duration: null }
            ]
          },
          {
            op: "schedule",
            on: "self",
            after: 4,
            label: "杰除封印·第 4 回合",
            ops: [
              { op: "stat", stat: "atk", who: "self", mode: "add", value: -20, duration: null },
              { op: "stat", stat: "spd", who: "self", mode: "add", value: -10, duration: null },
              { op: "stat", stat: "mres", who: "self", mode: "add", value: 20, duration: null }
            ]
          },
          {
            op: "schedule",
            on: "self",
            after: 6,
            label: "杰除封印·第 6 回合",
            ops: [
              { op: "stat", stat: "atk", who: "self", mode: "add", value: -20, duration: null },
              { op: "stat", stat: "spd", who: "self", mode: "add", value: -10, duration: null },
              { op: "stat", stat: "mres", who: "self", mode: "add", value: 20, duration: null }
            ]
          },
          {
            op: "schedule",
            on: "self",
            after: 7,
            label: "杰除封印·结束",
            ops: [{ op: "clearMods", who: "self" }]
          }
        ]
      },
      {
        id: "jinshengjie.wanjie",
        name: "万杰不复",
        conditionText: "1蓝1蓄力",
        cost: { mp: 1 },
        charge: 1,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "buff", kind: "fragile", who: "target", percent: 20, duration: 8, stacking: false },
          { op: "buff", kind: "panic", who: "target", percent: 20, duration: 8, stacking: false },
          {
            op: "tick",
            duration: { unit: "standard", count: 8 },
            label: "万杰不复",
            ops: [
              { op: "directLoss", value: { per: { stat: "target.maxHp" }, factor: 0.05 } }
            ]
          }
        ]
      },
      {
        id: "jinshengjie.jieao",
        name: "杰骜不驯",
        conditionText: "被动",
        passive: true,
        cost: { mp: 0 },
        charge: 0,
        cooldown: 0,
        target: "self",
        ops: [],
        hooks: {
          beforeDamage: [
            { op: "mark", who: "self", key: "jien", delta: 1 },
            { op: "roll", key: "dodge", sides: 6, perTarget: false, label: "杰骜不驯" },
            {
              op: "if",
              cond: {
                left: { counter: "dodge", perTarget: false },
                op: "le",
                right: { mark: "jien" }
              },
              then: [
                { op: "heal", who: "self", value: 170, rounding: "none" },
                { op: "strike", who: "self", target: "source", noBreak: true, label: "杰骜不驯反击" },
                { op: "markClear", who: "self", key: "jien" },
                { op: "dodge" }
              ]
            }
          ]
        }
      },
      {
        id: "jinshengjie.guang",
        name: "光",
        conditionText: "6蓝",
        cost: { mp: 6 },
        charge: 0,
        cooldown: 0,
        target: "allEnemies",
        ops: [
          {
            op: "tick",
            duration: { unit: "standard", count: 9995 },
            unstoppable: true,
            label: "光",
            ops: [
              { op: "damage", type: "phys", value: 9995 },
              { op: "damage", type: "magic", value: 9995 },
              { op: "damage", type: "true", value: 9995 }
            ]
          }
        ]
      }
    ],

    "田誉清": [
      {
        id: "tianyuqing.pen",
        name: "霰弹枪",
        conditionText: "1蓄力",
        cost: { mp: 0 },
        charge: 1,
        cooldown: 0,
        target: "enemy",
        input: { key: "n", min: 1, max: "mp", label: "支付蓝" },
        requires: [{ mark: "naijiu", gte: 2, reason: "耐久不足 2" }],
        ops: [
          { op: "mark", who: "self", key: "naijiu", delta: -2 },
          {
            op: "damage",
            type: "phys",
            value: { minus: [{ stat: "self.atk" }, 30] },
            times: { input: "n", factor: 3 }
          }
        ]
      },
      {
        id: "tianyuqing.zhongji",
        name: "重机枪",
        conditionText: "3蓝3蓄力",
        cost: { mp: 3 },
        charge: 3,
        cooldown: 0,
        target: "self",
        ops: [
          { op: "stat", stat: "spd", who: "self", mode: "set", value: 1000, duration: 50 },
          {
            op: "status",
            kind: "noSkill",
            who: "self",
            skillId: "tianyuqing.pen",
            rounds: 50,
            label: "霰弹枪禁用"
          }
        ]
      },
      {
        id: "tianyuqing.zhi",
        name: "纸质工艺",
        conditionText: "1蓝",
        cost: { mp: 1 },
        charge: 0,
        cooldown: 0,
        target: "self",
        ops: [
          { op: "mark", who: "self", key: "naijiu", delta: 2 },
          { op: "stat", stat: "atk", who: "self", mode: "add", value: 30, duration: null }
        ]
      },
      {
        id: "tianyuqing.pijin",
        name: "皮筋枪械",
        conditionText: "被动",
        passive: true,
        cost: { mp: 0 },
        charge: 0,
        cooldown: 0,
        target: "self",
        ops: [],
        hooks: {
          basicGate: [
            {
              op: "if",
              cond: { left: { mark: "naijiu" }, op: "lt", right: 1 },
              then: [{ op: "deny", reason: "耐久不足" }]
            }
          ],
          basicMod: [
            { op: "mark", who: "self", key: "naijiu", delta: -1 },
            {
              op: "dice",
              sides: 6,
              label: "皮筋枪械",
              cases: [
                { in: [1], ops: [{ op: "setBasicMod", misfire: true }] },
                { in: [6], ops: [{ op: "setBasicMod", factor: 2 }] }
              ]
            }
          ]
        }
      }
    ],

    "刘滨路": [
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
    ],

    "正盈利": [
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
    ],

    "羊书含": [
      {
        id: "yangshuhan.wangba",
        name: "王霸之气",
        conditionText: "被动",
        passive: true,
        cost: { mp: 0 },
        charge: 0,
        cooldown: 0,
        target: "self",
        ops: [],
        hooks: {
          battleStart: [
            { op: "stat", stat: "atk", who: "allEnemies", mode: "add", value: -20, duration: 15 },
            { op: "stat", stat: "def", who: "allEnemies", mode: "add", value: -20, duration: 15 },
            { op: "stat", stat: "mres", who: "allEnemies", mode: "add", value: -20, duration: 15 },
            {
              op: "tick",
              who: "allEnemies",
              duration: { unit: "standard", count: 15 },
              period: 3,
              label: "王霸之气",
              ops: [{ op: "damage", type: "true", value: 25 }]
            }
          ]
        }
      },
      {
        id: "yangshuhan.yongquan",
        name: "涌泉相报",
        conditionText: "2蓝1蓄力",
        cost: { mp: 2 },
        charge: 1,
        cooldown: 0,
        target: "enemy",
        ops: [
          {
            op: "dice",
            sides: 6,
            times: 3,
            label: "涌泉相报",
            cases: [
              { in: [1], ops: [{ op: "damage", type: "magic", value: 20, noBreak: true }] },
              { in: [2], ops: [{ op: "damage", type: "magic", value: 40, noBreak: true }] },
              { in: [3], ops: [{ op: "damage", type: "magic", value: 60, noBreak: true }] },
              { in: [4], ops: [{ op: "damage", type: "magic", value: 80, noBreak: true }] },
              { in: [5], ops: [{ op: "damage", type: "magic", value: 100, noBreak: true }] },
              { in: [6], ops: [{ op: "damage", type: "magic", value: 120, noBreak: true }] }
            ]
          }
        ]
      },
      {
        id: "yangshuhan.mu",
        name: "杨舒涵之墓",
        conditionText: "5蓝4蓄力",
        cost: { mp: 5 },
        charge: 4,
        cooldown: 0,
        once: true,
        costFromLost: { per: 100 },
        target: "self",
        ops: [{ op: "summon", key: "yangshuhan.tomb" }],
        hooks: {
          basicMode: [
            {
              op: "if",
              cond: { summon: "yangshuhan.tomb" },
              then: [{ op: "setBasicMode", healSummon: "yangshuhan.tomb" }]
            }
          ]
        }
      }
    ]
  }
};

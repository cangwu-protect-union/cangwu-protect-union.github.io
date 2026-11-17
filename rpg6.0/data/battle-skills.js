/* 回合制正传 6.0 · 技能库
   每条技能对应 _local/docs/回合制6.0测试功能-角色机制.md 里的一节。
   conditionText 必须与角色档案里的条件文本一致，否则 skills.validate 会拒绝这个技能。
   写法：每个 op 的字段见 _local/docs/回合制6.0测试功能-plan.md 第 5 节。
   库拆成多个文件按顺序加载，分片只追加 characters。 */
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
  characters: {}
};
window.RPG6_SKILLS.characters["刘文哲"] = [
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
    ];
window.RPG6_SKILLS.characters["李硕"] = [
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
    ];
window.RPG6_SKILLS.characters["谢雨辰"] = [
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
    ];
window.RPG6_SKILLS.characters["江雨轩"] = [
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
    ];
window.RPG6_SKILLS.characters["王泺然"] = [
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
    ];
window.RPG6_SKILLS.characters["郑湾湾"] = [
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
    ];
window.RPG6_SKILLS.characters["于梓越"] = [
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
    ];
window.RPG6_SKILLS.characters["杨舒然"] = [
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
    ];
window.RPG6_SKILLS.characters["包必冉"] = [
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
    ];

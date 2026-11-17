/* 回合制正传 6.0 · 技能库分片 2
   只追加 characters，跟在 battle-skills.js 之后按顺序加载。 */
window.RPG6_SKILLS.characters["宋知远"] = [
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
        rollDodge: { sides: 6, values: [1, 3, 5] },
        buffImmune: ["panic", "fragile"],
        hooks: {
          roundStart: [
            {
              op: "if",
              cond: { left: { stat: "self.hp" }, op: "le", right: 600 },
              then: [{ op: "heal", who: "self", value: 25, rounding: "none", label: "皮糙肉厚" }]
            }
          ]
        },
        ops: []
      }
    ];
window.RPG6_SKILLS.characters["张家铭"] = [
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
    ];
window.RPG6_SKILLS.characters["王荣逸"] = [
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
    ];
window.RPG6_SKILLS.characters["庄文希"] = [
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
window.RPG6_SKILLS.characters["张克太"] = [
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
    ];

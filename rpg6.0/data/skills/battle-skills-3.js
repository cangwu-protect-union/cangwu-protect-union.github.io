/* 回合制正传 6.0 · 技能库分片 3
   只追加 characters，跟在 battle-skills.js 之后按顺序加载。 */
window.RPG6_SKILLS.characters["金圣杰"] = [
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
    ];
window.RPG6_SKILLS.characters["田誉清"] = [
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
    ];
window.RPG6_SKILLS.characters["刘滨路"] = [
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
window.RPG6_SKILLS.characters["正盈利"] = [
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
    ];
window.RPG6_SKILLS.characters["羊书含"] = [
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
    ];

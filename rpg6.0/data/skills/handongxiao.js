/* 回合制正传 6.0 · 技能库 · 韩东晓 */
export default [
      {
        id: "handongxiao.woshuai",
        name: "我帅不帅？",
        conditionText: "1蓝",
        cost: { mp: 1 },
        charge: 0,
        cooldown: 0,
        target: "self",
        ops: [
          {
            op: "ask",
            kind: "answer",
            key: "woshuai",
            prompt: "我帅不帅？",
            options: ["帅", "不帅"],
            default: "帅",
            then: [
              { op: "heal", who: "self", value: 80 },
              { op: "flag", who: "self", key: "handsomeTurn", value: { stat: "self.turns" } }
            ],
            else: [
              { op: "damage", who: "enemyHero", type: "phys", value: 150 }
            ]
          }
        ]
      },
      {
        id: "handongxiao.woshi",
        name: "我是天才！",
        conditionText: "3蓄力",
        cost: { mp: 0 },
        charge: 3,
        cooldown: 0,
        target: "self",
        ops: [
          { op: "mp", who: "self", delta: 5 },
          { op: "stat", who: "self", stat: "atk", mode: "add", value: 10, duration: null },
          { op: "stat", who: "self", stat: "def", mode: "add", value: 10, duration: null },
          { op: "stat", who: "self", stat: "mres", mode: "add", value: 10, duration: null },
          { op: "stat", who: "self", stat: "spd", mode: "add", value: 10, duration: null },
          { op: "buff", who: "allEnemies", kind: "brave", percent: 100, duration: 4 },
          {
            op: "tick",
            who: "allEnemies",
            duration: 4,
            label: "我是天才：勇猛衰减",
            ops: [{ op: "decay", who: "target", kind: "brave", delta: 20 }]
          }
        ]
      },
      {
        id: "handongxiao.chouxiang",
        name: "抽象艺术",
        conditionText: "4蓝2蓄力",
        cost: { mp: 4 },
        charge: 2,
        cooldown: 0,
        target: "self",
        requires: [{ flag: "handsomeTurn", gap: 1, once: true, reason: "需要对方在上个己方回合说你帅" }],
        ops: [
          {
            op: "tick",
            who: "self",
            permanent: true,
            when: "roundStart",
            key: "handongxiao.chouxiang",
            label: "抽象艺术",
            ops: [
              { op: "roll", key: "absN", sides: 6 },
              {
                op: "ask",
                kind: "guess",
                key: "caishu",
                sides: 6,
                value: { counter: "absN" },
                prompt: "猜一个数（1–6）",
                default: 0,
                then: [{ op: "removeEffect", who: "self", key: "handongxiao.chouxiang" }],
                else: [{ op: "strike", who: "self", victim: "enemyHero", times: { counter: "absN" }, noBreak: true }]
              }
            ]
          }
        ]
      },
      {
        id: "handongxiao.jiqiang",
        name: "机枪射手",
        conditionText: "5蓝上限",
        cost: { maxMp: 5 },
        charge: 0,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "damage", who: "target", type: "true", value: 10, times: 5 }
        ]
      }
];

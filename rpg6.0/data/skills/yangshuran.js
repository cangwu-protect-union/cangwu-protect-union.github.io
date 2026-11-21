/* 回合制正传 6.0 · 技能库 · 杨舒然 */
export default [
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

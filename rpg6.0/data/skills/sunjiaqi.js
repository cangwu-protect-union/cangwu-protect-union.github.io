/* 回合制正传 6.0 · 技能库 · 孙嘉怿
   攻击格是注记不是数字：面板攻击由 index.js 的 panels 覆盖为 0，
   实际普攻攻击值由 index.js 的 basicAtk 表达式算「目标当前血量的 20%」。 */
export default [
      {
        id: "sunjiaqi.songliwu",
        name: "送“礼物”",
        conditionText: "6回合冷却",
        cost: { mp: 0 },
        charge: 0,
        cooldown: 6,
        target: "enemy",
        ops: [
          { op: "strike", who: "self", victim: "target", label: "礼物普攻" },
          { op: "heal", who: "self", value: 65 },
          { op: "buff", who: "self", kind: "fragile", percent: 10, duration: 3 }
        ]
      },
      {
        id: "sunjiaqi.paomeiyan",
        name: "抛媚眼",
        conditionText: "2蓄力",
        cost: { mp: 0 },
        charge: 2,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "damage", who: "target", type: "magic", value: 75 },
          {
            op: "schedule",
            on: "self",
            after: 5,
            label: "抛媚眼",
            ops: [
              { op: "heal", who: "allAllies", value: { per: { stat: "self.maxHp" }, factor: 0.2 } }
            ]
          }
        ]
      },
      {
        id: "sunjiaqi.lingduzhe",
        name: "领毒者",
        conditionText: "4蓝",
        cost: { mp: 4 },
        charge: 0,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "status", who: "target", kind: "stun", duration: { unit: "targetRound", count: 1 }, label: "领毒者" },
          {
            op: "tick",
            who: "target",
            duration: 10,
            label: "领毒者",
            tag: "lingduzhe",
            desc: "每标准回合强制扣 10 血；孙嘉怿受到伤害时提前结束。",
            ops: [{ op: "directLoss", who: "target", value: 10 }]
          }
        ],
        hooks: {
          damageTaken: [{ op: "interrupt", who: "enemyHero", tag: "lingduzhe" }]
        }
      }
];

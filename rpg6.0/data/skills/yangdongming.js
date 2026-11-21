/* 回合制正传 6.0 · 技能库 · 杨冬明 */
export default [
      {
        id: "yangdongming.zhuguang",
        name: "竹光法杖",
        conditionText: "10防",
        cost: { mp: 0, def: 10 },
        charge: 0,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "damage", who: "target", type: "magic", value: 50, times: 3 },
          { op: "status", who: "target", kind: "stun", duration: { unit: "targetRound", count: 2 }, label: "竹光法杖" }
        ]
      },
      {
        id: "yangdongming.jianruopanshi",
        name: "坚若磐石",
        conditionText: "5回合冷却",
        cost: { mp: 0 },
        charge: 0,
        cooldown: 5,
        target: "self",
        ops: [
          {
            op: "shield",
            who: "self",
            hp: 300,
            duration: 4,
            label: "坚若磐石",
            onExpire: [{ op: "stat", who: "self", stat: "def", mode: "add", value: 5 }]
          }
        ]
      },
      {
        id: "yangdongming.dedenaenashio",
        name: "嘚吪呐呃嘶哦",
        conditionText: "1回合冷却",
        cost: { mp: 0 },
        charge: 0,
        cooldown: 1,
        target: "self",
        ops: [{ op: "summon", who: "self", key: "yangdongming.voice" }]
      },
      {
        id: "yangdongming.hancongdafu",
        name: "旱葱大祓",
        conditionText: "8蓝",
        cost: { mp: 8 },
        charge: 0,
        cooldown: 0,
        target: "allEnemies",
        ops: [],
        unsupported: "本版未实现：需要消除全部召唤物、普攻改真伤+无视嘲讽+附加恐慌、全局「击溃值溢出自动击溃」开关、技能条件读召唤物数量、动态改持续回合；这批只补防护层与解锁动作。"
      }
];

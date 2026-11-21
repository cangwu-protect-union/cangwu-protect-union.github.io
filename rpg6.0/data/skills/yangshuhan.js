/* 回合制正传 6.0 · 技能库 · 羊书含 */
export default [
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
            { op: "stat", stat: "atk", who: "allEnemies", mode: "add", value: -20, duration: 15, debuff: true },
            { op: "stat", stat: "def", who: "allEnemies", mode: "add", value: -20, duration: 15, debuff: true },
            { op: "stat", stat: "mres", who: "allEnemies", mode: "add", value: -20, duration: 15, debuff: true },
            {
              op: "tick",
              who: "allEnemies",
              duration: { unit: "standard", count: 15 },
              period: 3,
              debuff: true,
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

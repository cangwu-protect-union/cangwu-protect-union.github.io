/* 回合制正传 6.0 · 技能库 · 田誉清 */
export default [
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

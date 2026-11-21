/* 回合制正传 6.0 · 技能库 · 倪曼云 */
export default [
      {
        id: "nimanyun.juan",
        name: "卷",
        conditionText: "1蓝",
        cost: { mp: 1 },
        charge: 0,
        cooldown: 0,
        target: "enemy",
        ops: [
          { op: "mark", who: "self", key: "juan", delta: 1 },
          { op: "maxHp", who: "self", delta: { plus: [{ mult: { mark: "juan" }, factor: -10 }, -10] } },
          { op: "damage", who: "target", type: "magic", value: { plus: [60, { mult: { mark: "juan" }, factor: 10 }] }, times: 2, healBack: true }
        ]
      },
      {
        id: "nimanyun.gangzhang",
        name: "刚长出来",
        conditionText: "被动",
        passive: true,
        cost: { mp: 0 },
        charge: 0,
        cooldown: 0,
        target: "self",
        ops: [],
        hooks: {
          battleStart: [
            { op: "counter", who: "target", key: "atkOrigin", delta: { stat: "target.atk" } },
            { op: "counter", who: "target", key: "defOrigin", delta: { stat: "target.def" } },
            { op: "counter", who: "target", key: "mresOrigin", delta: { stat: "target.mres" } },
            { op: "stat", who: "target", stat: "atk", mode: "set", value: 0 },
            { op: "stat", who: "target", stat: "def", mode: "set", value: 0 },
            { op: "stat", who: "target", stat: "mres", mode: "set", value: 0 }
          ]
        }
      },
      {
        id: "nimanyun.yuegong",
        name: "越共探头",
        conditionText: "1蓄力",
        cost: { mp: 0 },
        charge: 1,
        cooldown: 0,
        target: "self",
        ops: [
          { op: "maxHp", who: "self", delta: 60 },
          {
            op: "tick",
            who: "self",
            permanent: true,
            key: "yuegong",
            label: "越共探头",
            desc: "对方攻击或击溃时完全免疫该次，并免费触发 2 次「卷」。",
            guard: {
              remaining: 1,
              onBreak: true,
              ops: [{ op: "use", skillId: "nimanyun.juan", times: 2 }]
            }
          }
        ]
      }
];

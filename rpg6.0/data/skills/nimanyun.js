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
        unsupported: "本版未实现：需要「对手消耗蓝」事件与延迟 3 标准回合解锁单个属性的落点；现有引擎没有蓝消耗钩子。"
      },
      {
        id: "nimanyun.yuegong",
        name: "越共探头",
        conditionText: "1蓄力",
        cost: { mp: 0 },
        charge: 1,
        cooldown: 0,
        target: "self",
        ops: [],
        unsupported: "本版未实现：需要防护层（免疫一次攻击/击溃后免费触发 2 次「卷」）；引擎没有取消伤害后执行后续 ops 的通用机制。"
      }
];

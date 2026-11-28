/* 回合制正传 6.0 · 技能库 · 朱弘毅（plan.mjs --write 生成，之后直接改这里） */
export default [
  {
    id: "zhuhongyi.tianxia",
    name: "天下第一",
    conditionText: "3蓝3蓄力",
    cost: { mp: 3 },
    charge: 3,
    cooldown: 0,
    target: "self",
    ops: [
      { op: "stat", who: "self", stat: "def", mode: "set", value: 9995, duration: 5 },
      { op: "stat", who: "self", stat: "mres", mode: "set", value: 100, duration: 5 },
      { op: "status", who: "self", kind: "breakLock", label: "天下第一·击溃值锁定", duration: 5 },
      {
        op: "tick",
        who: "self",
        key: "tianxia",
        label: "天下第一",
        duration: 5,
        ops: [{ op: "heal", who: "self", value: 45 }]
      },
      { op: "status", who: "self", kind: "strongImmune", label: "天下第一·强免疫", duration: 5 }
    ]
  },
  {
    id: "zhuhongyi.shishi",
    name: "且看世事多艰",
    conditionText: "5蓝",
    cost: { mp: 5 },
    charge: 0,
    cooldown: 0,
    target: "enemy",
    ops: [
      {
        op: "status",
        who: "target",
        kind: "noBasic",
        label: "且看世事多艰·禁普攻",
        duration: { unit: "targetRound", count: 3 }
      },
      {
        op: "status",
        who: "target",
        kind: "noMpCharge",
        label: "且看世事多艰·禁蓄蓝",
        duration: { unit: "targetRound", count: 3 }
      },
      {
        op: "stat",
        who: "target",
        stat: "atk",
        mode: "add",
        value: -25,
        duration: { unit: "targetRound", count: 3 }
      },
      {
        op: "stat",
        who: "target",
        stat: "def",
        mode: "add",
        value: -25,
        duration: { unit: "targetRound", count: 3 }
      }
    ]
  },
  {
    id: "zhuhongyi.jile",
    name: "急了",
    conditionText: "11蓄力",
    cost: { mp: 0 },
    charge: 11,
    cooldown: 0,
    target: "self",
    ops: [{ op: "status", who: "self", kind: "extraActions", label: "急了", permanent: true }]
  },
  {
    id: "zhuhongyi.shijie",
    name: "这个世界...",
    conditionText: "50血",
    cost: { hp: 50 },
    charge: 0,
    cooldown: 0,
    target: "enemy",
    selfKillWin: true,
    ops: [
      { op: "roll", sides: 6, key: "worldRoll" },
      {
        op: "damage",
        who: "target",
        type: "phys",
        value: { mult: { counter: "worldRoll" }, factor: 25 },
        noBreak: true
      },
      {
        op: "damage",
        who: "target",
        type: "magic",
        value: { mult: { counter: "worldRoll" }, factor: 25 },
        noBreak: true
      }
    ]
  },
  {
    id: "zhuhongyi.fangxiang",
    name: "反方向的钟",
    conditionText: "无",
    cost: { mp: 0 },
    charge: 0,
    cooldown: 0,
    target: "self",
    ops: [{ op: "rewind" }]
  }
];

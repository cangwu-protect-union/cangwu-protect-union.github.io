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
        ops: [],
        unsupported: "本版未实现：判定依赖对方的回答（「对面说帅」），对局页没有对方输入入口，结果无法进状态指纹与回放。"
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
        ops: [],
        unsupported: "本版未实现：每回合要让对方「猜数」并在猜中时打断，需要对方输入与逐回合交互界面。"
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

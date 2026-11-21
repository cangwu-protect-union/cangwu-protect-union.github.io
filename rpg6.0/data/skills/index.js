/* 回合制正传 6.0 · 技能库聚合入口
   一个角色一个文件（见本目录 *.js），本文件把 29 人合并成 { version, marks, summons, characters }。
   浏览器（js/battle/entry.js）与 Node 测试（run.mjs / batch.mjs / strategy-lab）都从这里 import。
   唯一数据源；加角色就新建一个角色文件并在这里登记。 */
import baobiran from "./baobiran.js";
import guwenda from "./guwenda.js";
import handongxiao from "./handongxiao.js";
import jiangyuxuan from "./jiangyuxuan.js";
import jinshengjie from "./jinshengjie.js";
import lishuo from "./lishuo.js";
import liubinlu from "./liubinlu.js";
import liuwenzhe from "./liuwenzhe.js";
import liuyixuan from "./liuyixuan.js";
import liyuxuan from "./liyuxuan.js";
import lvchangling from "./lvchangling.js";
import nimanyun from "./nimanyun.js";
import songzhiyuan from "./songzhiyuan.js";
import sunjiaqi from "./sunjiaqi.js";
import tianyuqing from "./tianyuqing.js";
import wangchunyu from "./wangchunyu.js";
import wangluor from "./wangluor.js";
import wangrongyi from "./wangrongyi.js";
import xieyuchen from "./xieyuchen.js";
import yangdongming from "./yangdongming.js";
import yangshuhan from "./yangshuhan.js";
import yangshuran from "./yangshuran.js";
import yuzy from "./yuzy.js";
import zhangjiaming from "./zhangjiaming.js";
import zhangketa from "./zhangketa.js";
import zhaoyunzhe from "./zhaoyunzhe.js";
import zhengwanwan from "./zhengwanwan.js";
import zhengyingli from "./zhengyingli.js";
import zhuangwenxi from "./zhuangwenxi.js";

const lib = {
  version: 1,
  /* 面板覆盖：档案里的攻击格是注记（孙嘉怿「受攻击者当前血量的20%」），不是数字。
     这里给一个可解析的面板值，实际普攻伤害由 basicAtk 表达式算。 */
  panels: {
    "孙嘉怿": { atk: 0 }
  },
  /* 普攻攻击值表达式：优先级高于面板与 Buff 修正（孙嘉怿） */
  basicAtk: {
    "孙嘉怿": { hpPercent: "target.current", percent: 20 }
  },
  /* 标记：谁身上有哪些计数器。对手可见、可被对手的技能操作（mark / markClear / dispel marks）。 */
  marks: {
    "王荣逸": [{ key: "shuati", name: "刷题", max: 3, init: 0 }],
    "庄文希": [{ key: "dim", name: "降维打击", max: 3, init: 0 }],
    "张克太": [
      { key: "dealt", name: "造成伤害", max: 3, init: 0 },
      { key: "taken", name: "受到伤害", max: 3, init: 0 },
      { key: "drain", name: "属性削弱", max: 3, init: 0 }
    ],
    "金圣杰": [
      { key: "jien", name: "受伤计数", max: 6, init: 0 },
      { key: "hit3", name: "3 次伤害", max: 3, init: 0 },
      { key: "hit5", name: "5 次伤害", max: 5, init: 0 }
    ],
    "田誉清": [{ key: "naijiu", name: "耐久", max: 9999, init: 3, hideMax: true }],
    "刘滨路": [{ key: "dongneng", name: "动能", max: 7, init: 0 }],
    "正盈利": [{ key: "fukui", name: "负亏损", max: 1, init: 0 }],
    /* on:"opponent" 的标记挂到对方英雄身上，双方可见（赵云哲的「卅力」） */
    "赵云哲": [{ key: "shili", name: "卅力", max: 5, init: 0, on: "opponent" }],
    /* 倪曼云的「刚长出来」：锁在对方身上，0=未解锁、1=已解锁 */
    "倪曼云": [
      { key: "juan", name: "卷", max: 4, init: 0 },
      { key: "lockAtk", name: "攻击已解锁", max: 1, init: 0, hideMax: true, on: "opponent" },
      { key: "lockDef", name: "防御已解锁", max: 1, init: 0, hideMax: true, on: "opponent" },
      { key: "lockMres", name: "法抗已解锁", max: 1, init: 0, hideMax: true, on: "opponent" }
    ],
    "顾文达": [{ key: "renGao", name: "免疫阈值", max: 9999, init: 60, hideMax: true }],
    /* 第七批：受击计数/碎苹果（刘亦萱）、功德（吕场龄） */
    "刘亦萱": [
      { key: "taken", name: "受击次数", max: 5, init: 0 },
      { key: "apple", name: "碎苹果", max: 36, init: 0 }
    ],
    "吕场龄": [{ key: "gongde", name: "功德", max: 99, init: 0 }]
  },
  /* 召唤物定义：ttl 按标准回合；targetable 只有带血量的召唤物为真；
     desc 是详情栏里的行为说明（手写），缺省时按 aura / attack / onExpire 自动拼；
     aura 每标准回合末，onExpire 到期时，attack 按自身速度攒行动条（每 100/速度 个标准回合末攻击一次；
     攒满那一拍被眩晕/击溃则作废，速度必须为正，否则永远不会出手）。 */
  summons: {
    "liubinlu.xiaoliu": {
      name: "小刘亦萱",
      desc: "不占行动。4 个标准回合后消失，消失时对敌方全体造成 70 点真伤（不计击溃值）。",
      ttl: 4,
      onExpire: [
        { op: "damage", who: "allEnemies", type: "true", value: 70, noBreak: true }
      ]
    },
    "zhengyingli.kuihua2": {
      name: "葵花宝典",
      desc: "不占行动。每个标准回合末对敌方全体造成 50 点法伤；2 个标准回合后消失时对敌方全体造成 75 点普伤（均不计击溃值）。",
      ttl: 2,
      aura: [
        { op: "damage", who: "allEnemies", type: "magic", value: 50, noBreak: true }
      ],
      onExpire: [
        { op: "damage", who: "allEnemies", type: "phys", value: 75, noBreak: true }
      ]
    },
    "zhengyingli.kuihua4": {
      name: "葵花宝典",
      desc: "不占行动。每个标准回合末对敌方全体造成 50 点法伤；4 个标准回合后消失时对敌方全体造成 75 点普伤（均不计击溃值）。",
      ttl: 4,
      aura: [
        { op: "damage", who: "allEnemies", type: "magic", value: 50, noBreak: true }
      ],
      onExpire: [
        { op: "damage", who: "allEnemies", type: "phys", value: 75, noBreak: true }
      ]
    },
    "yangshuhan.tomb": {
      name: "杨舒然之墓",
      desc: "不占行动，可被单体选中，免疫击溃。每个标准回合末速度条 +速度，满 100 出手一次，对敌方英雄造成等于自身攻击的真伤（不计击溃值）。",
      stats: { atk: 200, def: 0, mres: 0, hp: 1200, mp: 0, spd: 10 },
      targetable: true,
      breakImmune: true,
      taunt: 0,
      attack: [
        { op: "damage", who: "enemyHero", type: "true", value: { stat: "self.atk" }, noBreak: true }
      ]
    },
    "yangdongming.voice": {
      name: "嘚吪呐呃嘶哦",
      desc: "不占行动、不可选中。每个标准回合末对敌方全体造成 50+5×(场上同名数量−1) 点法伤（不计击溃值）；10 个标准回合后消失，上限 6 个。",
      ttl: 10,
      aura: [
        {
          op: "damage",
          who: "allEnemies",
          type: "magic",
          noBreak: true,
          value: { plus: [45, { per: { summonCount: "yangdongming.voice" }, factor: 5 }] }
        }
      ]
    },
    "lvchangling.dilei": {
      name: "土豆地雷",
      desc: "300 血、可被单体选中。10 个标准回合后消失，消失时对最多 3 个敌人造成 100 真伤并各挂 50% 脆弱 5 标准回合（可叠加）。",
      stats: { atk: 0, def: 0, mres: 0, hp: 300, mp: 0, spd: 0 },
      ttl: 10,
      targetable: true,
      taunt: 0,
      onExpire: [
        { op: "damage", who: { of: "allEnemies", limit: 3 }, type: "true", value: 100 },
        { op: "buff", who: { of: "allEnemies", limit: 3 }, kind: "fragile", percent: 50, duration: 5 }
      ]
    }
  },
  characters: {
    "刘文哲": liuwenzhe,
    "李硕": lishuo,
    "谢雨辰": xieyuchen,
    "江雨轩": jiangyuxuan,
    "王泺然": wangluor,
    "郑湾湾": zhengwanwan,
    "于梓越": yuzy,
    "杨舒然": yangshuran,
    "包必冉": baobiran,
    "宋知远": songzhiyuan,
    "张家铭": zhangjiaming,
    "王荣逸": wangrongyi,
    "庄文希": zhuangwenxi,
    "张克太": zhangketa,
    "金圣杰": jinshengjie,
    "田誉清": tianyuqing,
    "刘滨路": liubinlu,
    "正盈利": zhengyingli,
    "羊书含": yangshuhan,
    "赵云哲": zhaoyunzhe,
    "李雨轩": liyuxuan,
    "倪曼云": nimanyun,
    "顾文达": guwenda,
    "孙嘉怿": sunjiaqi,
    "杨冬明": yangdongming,
    "刘亦萱": liuyixuan,
    "吕场龄": lvchangling,
    "王春雨": wangchunyu,
    "韩东晓": handongxiao
  }
};

export default lib;

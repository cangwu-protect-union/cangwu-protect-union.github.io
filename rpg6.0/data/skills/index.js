/* 回合制正传 6.0 · 技能库聚合入口
   一个角色一个文件（见本目录 *.js），本文件把 19 人合并成 { version, marks, summons, characters }。
   浏览器（js/battle/entry.js）与 Node 测试（run.mjs / batch.mjs / strategy-lab）都从这里 import。
   唯一数据源；加角色就新建一个角色文件并在这里登记。 */
import baobiran from "./baobiran.js";
import jiangyuxuan from "./jiangyuxuan.js";
import jinshengjie from "./jinshengjie.js";
import lishuo from "./lishuo.js";
import liubinlu from "./liubinlu.js";
import liuwenzhe from "./liuwenzhe.js";
import songzhiyuan from "./songzhiyuan.js";
import tianyuqing from "./tianyuqing.js";
import wangluor from "./wangluor.js";
import wangrongyi from "./wangrongyi.js";
import xieyuchen from "./xieyuchen.js";
import yangshuhan from "./yangshuhan.js";
import yangshuran from "./yangshuran.js";
import yuzy from "./yuzy.js";
import zhangjiaming from "./zhangjiaming.js";
import zhangketa from "./zhangketa.js";
import zhengwanwan from "./zhengwanwan.js";
import zhengyingli from "./zhengyingli.js";
import zhuangwenxi from "./zhuangwenxi.js";

const lib = {
  version: 1,
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
    "正盈利": [{ key: "fukui", name: "负亏损", max: 1, init: 0 }]
  },
  /* 召唤物定义：ttl 按标准回合；targetable 只有带血量的召唤物为真；
     aura 每标准回合末，onExpire 到期时，attack 按自身速度攒行动条（每 100/速度 个标准回合末攻击一次；
     攒满那一拍被眩晕/击溃则作废，速度必须为正，否则永远不会出手）。 */
  summons: {
    "liubinlu.xiaoliu": {
      name: "小刘亦萱",
      ttl: 4,
      onExpire: [
        { op: "damage", who: "allEnemies", type: "true", value: 70, noBreak: true }
      ]
    },
    "zhengyingli.kuihua2": {
      name: "葵花宝典",
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
      stats: { atk: 200, def: 0, mres: 0, hp: 1200, mp: 0, spd: 10 },
      targetable: true,
      breakImmune: true,
      taunt: 0,
      attack: [
        { op: "damage", who: "enemyHero", type: "true", value: { stat: "self.atk" }, noBreak: true }
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
    "羊书含": yangshuhan
  }
};

export default lib;

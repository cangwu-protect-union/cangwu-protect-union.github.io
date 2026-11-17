/* 由 _local/tools/gen-rpg-seed.js 生成，勿手改。
   仅在云数据库不可用时作兜底；正式数据以数据库为准。
   条目拆成多个文件，按顺序加载，各分片只做 push。 */
window.RPG_SEED_CHARACTERS = window.RPG_SEED_CHARACTERS || [];
window.RPG_SEED_CHARACTERS.push(
  {
    "id": "rp-legacy-01",
    "seq": 1,
    "name": "王荣逸",
    "aliases": [],
    "occupation": "斗士",
    "side_job": "执旗手",
    "rating": "S",
    "gender": "女",
    "review_mark": "O",
    "atk": "60",
    "def": "45",
    "mres": "0",
    "hp": "360",
    "mp": "15",
    "spd": "60",
    "skills": [
      {
        "name": "刷题",
        "condition": "1蓝",
        "effect": "攻防+20，血上限+120，血+160，蓝上限+3，速抗+20 清空击溃值，可叠3层",
        "note": ""
      },
      {
        "name": "学习氛围",
        "condition": "无",
        "effect": "每回合蓝-1，自己攻防x2，全体己方血+20，可停止。蓝耗尽停止。 无法被打断，算作全员buff",
        "note": ""
      },
      {
        "name": "习题轰炸",
        "condition": "1蓝1蓄力",
        "effect": "刷题后可使用。掷出1——4造成100/150/210普伤（对应刷题层数1/2/3）， 自己蓝+3，对方眩晕3标准回合。",
        "note": ""
      },
      {
        "name": "满分嘲讽",
        "condition": "3蓝3蓄力",
        "effect": "240真伤，每刷1次题伤害+150.",
        "note": ""
      }
    ],
    "raw_head": "O王荣逸 (斗士/执旗手) [S]",
    "raw_skills": "1.刷题（1蓝）攻防+20，血上限+120，血+160，蓝上限+3，速抗+20\n清空击溃值，可叠3层\n2.学习氛围（无）每回合蓝-1，自己攻防x2，全体己方血+20，可停止。蓝耗尽停止。\n无法被打断，算作全员buff\n3.习题轰炸（1蓝1蓄力）刷题后可使用。掷出1——4造成100/150/210普伤（对应刷题层数1/2/3），\n自己蓝+3，对方眩晕3标准回合。\n4.满分嘲讽（3蓝3蓄力）240真伤，每刷1次题伤害+150.",
    "images": [
      "archive/picture/5.jpeg"
    ],
    "reviewer": "回合制游戏工作室",
    "reviewed_at": null,
    "review_note": "",
    "editor": "",
    "edited_at": null,
    "deleter": "",
    "deleted_at": null,
    "source_submission_id": "",
    "deleted": false,
    "created_at": "2025-12-31T16:00:00.000Z",
    "updated_at": "2025-12-31T16:00:00.000Z"
  },
  {
    "id": "rp-legacy-02",
    "seq": 2,
    "name": "刘文哲",
    "aliases": [],
    "occupation": "强攻手",
    "side_job": "",
    "rating": "B",
    "gender": "男",
    "review_mark": "√",
    "atk": "125",
    "def": "30",
    "mres": "10",
    "hp": "625",
    "mp": "10",
    "spd": "45",
    "skills": [
      {
        "name": "拟玛使勒",
        "condition": "1蓝",
        "effect": "对方蓝上限-3。",
        "note": ""
      },
      {
        "name": "致命打只因",
        "condition": "1蓝4蓄力",
        "effect": "995普伤。",
        "note": ""
      },
      {
        "name": "以德服人",
        "condition": "被动",
        "effect": "每次普攻附加30强制扣血(无视溃值)，击溃造成击溃值x50普伤。",
        "note": ""
      }
    ],
    "raw_head": "√ 刘文哲(强攻手)[B]",
    "raw_skills": "1.拟玛使勒(1蓝) 对方蓝上限-3。\n2.致命打只因(1蓝4蓄力) 995普伤。\n3.以德服人(被动) 每次普攻附加30强制扣血(无视溃值)，击溃造成击溃值x50普伤。",
    "images": [
      "archive/picture/5.jpeg",
      "archive/picture/6.jpeg"
    ],
    "reviewer": "回合制游戏工作室",
    "reviewed_at": null,
    "review_note": "",
    "editor": "",
    "edited_at": null,
    "deleter": "",
    "deleted_at": null,
    "source_submission_id": "",
    "deleted": false,
    "created_at": "2025-12-31T16:01:00.000Z",
    "updated_at": "2025-12-31T16:01:00.000Z"
  },
  {
    "id": "rp-legacy-03",
    "seq": 3,
    "name": "王泺然",
    "aliases": [],
    "occupation": "重装",
    "side_job": "嘲讽手",
    "rating": "D",
    "gender": "男",
    "review_mark": "O",
    "atk": "65",
    "def": "15",
    "mres": "60",
    "hp": "855",
    "mp": "3",
    "spd": "50",
    "skills": [
      {
        "name": "认大哥",
        "condition": "1蓝",
        "effect": "对方防抗变为0，持续5对方回合，连放3次后永久持续。",
        "note": ""
      },
      {
        "name": "刨祖坟",
        "condition": "3蓄力",
        "effect": "250+剩余血量 普伤，自己血回满，对方攻+50，速+30。",
        "note": ""
      },
      {
        "name": "帝国主义",
        "condition": "2蓝",
        "effect": "320真伤，自身嘲讽+3，对方全体攻+40，速+10，10标准回合。",
        "note": ""
      }
    ],
    "raw_head": "O 王泺然(重装/嘲讽手)[D]",
    "raw_skills": "1.认大哥(1蓝) 对方防抗变为0，持续5对方回合，连放3次后永久持续。\n2.刨祖坟(3蓄力) 250+剩余血量 普伤，自己血回满，对方攻+50，速+30。\n3.帝国主义(2蓝) 320真伤，自身嘲讽+3，对方全体攻+40，速+10，10标准回合。",
    "images": [
      "archive/picture/6.jpeg"
    ],
    "reviewer": "回合制游戏工作室",
    "reviewed_at": null,
    "review_note": "",
    "editor": "",
    "edited_at": null,
    "deleter": "",
    "deleted_at": null,
    "source_submission_id": "",
    "deleted": false,
    "created_at": "2025-12-31T16:02:00.000Z",
    "updated_at": "2025-12-31T16:02:00.000Z"
  },
  {
    "id": "rp-legacy-04",
    "seq": 4,
    "name": "江雨轩",
    "aliases": [
      "肥肥"
    ],
    "occupation": "盾卫",
    "side_job": "",
    "rating": "D",
    "gender": "男",
    "review_mark": "√",
    "atk": "90",
    "def": "70",
    "mres": "0",
    "hp": "910",
    "mp": "5",
    "spd": "35",
    "skills": [
      {
        "name": "泰山压顶",
        "condition": "1蓄力",
        "effect": "200普伤，对方速度变为25，受100%脆弱，10标准回合。",
        "note": ""
      },
      {
        "name": "肥肥反弹",
        "condition": "1蓄力",
        "effect": "将蓄力期间受的伤害和效果双倍反弹，并使对方眩晕3标准回合，不被打断蓄力。",
        "note": ""
      },
      {
        "name": "干饭人，干饭魂！",
        "condition": "1蓝",
        "effect": "使己方任意一人回复其血量上限-现有血量)x25%上取整至个位的血并清空Debuff。",
        "note": ""
      }
    ],
    "raw_head": "√ [肥肥] 江雨轩 (盾卫) [D]",
    "raw_skills": "1.泰山压顶(1蓄力) 200普伤，对方速度变为25，受100%脆弱，10标准回合。\n2.肥肥反弹(1蓄力) 将蓄力期间受的伤害和效果双倍反弹，并使对方眩晕3标准回合，不被打断蓄力。\n3.干饭人，干饭魂！(1蓝) 使己方任意一人回复其血量上限-现有血量)x25%上取整至个位的血并清空Debuff。",
    "images": [
      "archive/picture/6.jpeg"
    ],
    "reviewer": "回合制游戏工作室",
    "reviewed_at": null,
    "review_note": "",
    "editor": "",
    "edited_at": null,
    "deleter": "",
    "deleted_at": null,
    "source_submission_id": "",
    "deleted": false,
    "created_at": "2025-12-31T16:03:00.000Z",
    "updated_at": "2025-12-31T16:03:00.000Z"
  },
  {
    "id": "rp-legacy-05",
    "seq": 5,
    "name": "李硕",
    "aliases": [
      "苏珊珊",
      "大聪明"
    ],
    "occupation": "粉碎者",
    "side_job": "",
    "rating": "B",
    "gender": "男",
    "review_mark": "√",
    "atk": "65",
    "def": "40",
    "mres": "30",
    "hp": "360",
    "mp": "15",
    "spd": "100",
    "skills": [
      {
        "name": "虚晃亿枪",
        "condition": "1蓝",
        "effect": "120真伤。",
        "note": ""
      },
      {
        "name": "宇宙的奥秘",
        "condition": "6蓝",
        "effect": "对方全体每回合受100强扣，持续5回合，不可打断。",
        "note": ""
      },
      {
        "name": "大聪明",
        "condition": "2蓄力",
        "effect": "血+现有血量40%上取整至十位，再加30，蓝+3。",
        "note": ""
      }
    ],
    "raw_head": "√ [苏珊珊][大聪明] 李硕 (粉碎者) [B]",
    "raw_skills": "1.虚晃亿枪(1蓝) 120真伤。\n2.宇宙的奥秘(6蓝) 对方全体每回合受100强扣，持续5回合，不可打断。\n3.大聪明(2蓄力) 血+现有血量40%上取整至十位，再加30，蓝+3。",
    "images": [
      "archive/picture/7.jpeg"
    ],
    "reviewer": "回合制游戏工作室",
    "reviewed_at": null,
    "review_note": "",
    "editor": "",
    "edited_at": null,
    "deleter": "",
    "deleted_at": null,
    "source_submission_id": "",
    "deleted": false,
    "created_at": "2025-12-31T16:04:00.000Z",
    "updated_at": "2025-12-31T16:04:00.000Z"
  },
  {
    "id": "rp-legacy-06",
    "seq": 6,
    "name": "田誉清",
    "aliases": [],
    "occupation": "强攻手",
    "side_job": "射手",
    "rating": "C",
    "gender": "男",
    "review_mark": "O",
    "atk": "190",
    "def": "45",
    "mres": "0",
    "hp": "540",
    "mp": "10",
    "spd": "35",
    "skills": [
      {
        "name": "霰弹枪",
        "condition": "1蓄力",
        "effect": "耐久-2，支付n个蓝，(普攻-30)物伤3n次。",
        "note": ""
      },
      {
        "name": "重机枪",
        "condition": "3蓝3蓄力",
        "effect": "速度变为1000，持续50回合，不可使用1技能。",
        "note": ""
      },
      {
        "name": "纸质工艺",
        "condition": "1蓝",
        "effect": "耐久+2，攻+30。",
        "note": ""
      },
      {
        "name": "皮筋枪械",
        "condition": "被动",
        "effect": "开局3耐久，普攻消耗1耐久，无耐久则无法普攻或一技能。普攻掷色子，掷出1哑火，掷出6双倍伤害。",
        "note": ""
      }
    ],
    "raw_head": "O 田誉清(强攻手/射手)[C]",
    "raw_skills": "1.霰弹枪(1蓄力) 耐久-2，支付n个蓝，(普攻-30)物伤3n次。\n2.重机枪(3蓝3蓄力) 速度变为1000，持续50回合，不可使用1技能。\n3.纸质工艺(1蓝) 耐久+2，攻+30。\n4.皮筋枪械(被动) 开局3耐久，普攻消耗1耐久，无耐久则无法普攻或一技能。普攻掷色子，掷出1哑火，掷出6双倍伤害。",
    "images": [
      "archive/picture/7.jpeg"
    ],
    "reviewer": "回合制游戏工作室",
    "reviewed_at": null,
    "review_note": "",
    "editor": "",
    "edited_at": null,
    "deleter": "",
    "deleted_at": null,
    "source_submission_id": "",
    "deleted": false,
    "created_at": "2025-12-31T16:05:00.000Z",
    "updated_at": "2025-12-31T16:05:00.000Z"
  },
  {
    "id": "rp-legacy-07",
    "seq": 7,
    "name": "朱弘毅",
    "aliases": [],
    "occupation": "爆发者",
    "side_job": "破阵师",
    "rating": "A",
    "gender": "男",
    "review_mark": "O",
    "atk": "50",
    "def": "35",
    "mres": "0",
    "hp": "400",
    "mp": "20",
    "spd": "80",
    "skills": [
      {
        "name": "天下第一",
        "condition": "3蓝3蓄力",
        "effect": "防变为9995，法抗变为100，每标准回合血+45，免疫强制死亡，强制扣血、百分比扣血及属性降低、异常效果。击溃值锁定。5回合。",
        "note": ""
      },
      {
        "name": "且看世事多艰",
        "condition": "5蓝",
        "effect": "锁死对方普攻和蓄蓝3对方回合，对方攻防-25。",
        "note": ""
      },
      {
        "name": "急了",
        "condition": "11蓄力",
        "effect": "此技能效果视为Buff，每回合额外行动血量上限/现有血量(上取整)次。",
        "note": ""
      },
      {
        "name": "这个世界...",
        "condition": "50血",
        "effect": "掷出n，造成25n物法混伤(无击溃值)。",
        "note": ""
      },
      {
        "name": "反方向的钟",
        "condition": "无",
        "effect": "记录此标准回合的状态，可在12回合内回到此状态并清空Debuff与击溃值，死亡立即发动。在第13回合受400强制扣血。",
        "note": ""
      }
    ],
    "raw_head": "O 朱弘毅(爆发者/破阵师)[A]",
    "raw_skills": "1.天下第一(3蓝3蓄力) 防变为9995，法抗变为100，每标准回合血+45，免疫强制死亡，强制扣血、百分比扣血及属性降低、异常效果。击溃值锁定。5回合。\n2.且看世事多艰(5蓝) 锁死对方普攻和蓄蓝3对方回合，对方攻防-25。\n3.急了(11蓄力) 此技能效果视为Buff，每回合额外行动血量上限/现有血量(上取整)次。\n4.这个世界...(50血) 掷出n，造成25n物法混伤(无击溃值)。\n5.反方向的钟(无) 记录此标准回合的状态，可在12回合内回到此状态并清空Debuff与击溃值，死亡立即发动。在第13回合受400强制扣血。",
    "images": [
      "archive/picture/7.jpeg",
      "archive/picture/8.jpeg"
    ],
    "reviewer": "回合制游戏工作室",
    "reviewed_at": null,
    "review_note": "",
    "editor": "",
    "edited_at": null,
    "deleter": "",
    "deleted_at": null,
    "source_submission_id": "",
    "deleted": false,
    "created_at": "2025-12-31T16:06:00.000Z",
    "updated_at": "2025-12-31T16:06:00.000Z"
  },
  {
    "id": "rp-legacy-08",
    "seq": 8,
    "name": "杨舒然",
    "aliases": [
      "狗哥"
    ],
    "occupation": "冲锋手",
    "side_job": "",
    "rating": "D",
    "gender": "男",
    "review_mark": "O",
    "atk": "135",
    "def": "0",
    "mres": "0",
    "hp": "275",
    "mp": "20",
    "spd": "180",
    "skills": [
      {
        "name": "高猿长啸",
        "condition": "2蓄力",
        "effect": "对方全体每回合30真伤，每次行动掷出1或6才行，持续6回合。",
        "note": ""
      },
      {
        "name": "猿力与你同在",
        "condition": "2蓝",
        "effect": "造成210物伤/160法伤/120真伤，回复造成的伤害，无击溃值。",
        "note": ""
      },
      {
        "name": "苟之危笑",
        "condition": "2蓝2蓄力",
        "effect": "对方血上限变为自己血-5。",
        "note": ""
      },
      {
        "name": "绝对防御",
        "condition": "无",
        "effect": "只能用1次。不会死亡，持续6标准回合。",
        "note": ""
      }
    ],
    "raw_head": "O [狗哥] 杨舒然 (冲锋手) [D]",
    "raw_skills": "1.高猿长啸(2蓄力) 对方全体每回合30真伤，每次行动掷出1或6才行，持续6回合。\n2.猿力与你同在(2蓝) 造成210物伤/160法伤/120真伤，回复造成的伤害，无击溃值。\n3.苟之危笑(2蓝2蓄力) 对方血上限变为自己血-5。\n4.绝对防御(无) 只能用1次。不会死亡，持续6标准回合。",
    "images": [
      "archive/picture/8.jpeg"
    ],
    "reviewer": "回合制游戏工作室",
    "reviewed_at": null,
    "review_note": "",
    "editor": "",
    "edited_at": null,
    "deleter": "",
    "deleted_at": null,
    "source_submission_id": "",
    "deleted": false,
    "created_at": "2025-12-31T16:07:00.000Z",
    "updated_at": "2025-12-31T16:07:00.000Z"
  },
  {
    "id": "rp-legacy-09",
    "seq": 9,
    "name": "宋知远",
    "aliases": [
      "毛毛"
    ],
    "occupation": "盾卫",
    "side_job": "",
    "rating": "D",
    "gender": "男",
    "review_mark": "O",
    "atk": "130",
    "def": "120",
    "mres": "30",
    "hp": "1200",
    "mp": "5",
    "spd": "20",
    "skills": [
      {
        "name": "电摩冲击",
        "condition": "3蓄力",
        "effect": "无法使用技能，速每回合+30直到170，攻每回合+20直到230，持续10回合。",
        "note": ""
      },
      {
        "name": "肥龙在天",
        "condition": "1蓄力",
        "effect": "180普真混伤，造成3击溃值并立即击溃。",
        "note": ""
      },
      {
        "name": "睡觉",
        "condition": "1蓝",
        "effect": "此技能效果视为Buff。嘲讽+1，防抗+45，每回合血上限+80，血+150，持续3回合，其间视为击溃状态。",
        "note": ""
      },
      {
        "name": "皮糙肉厚",
        "condition": "被动",
        "effect": "受击时掷出1/3/5免疫，当血≤600时，每标准回合血+25。不会被脆弱/恐慌。",
        "note": ""
      }
    ],
    "raw_head": "O [毛毛] 宋知远 (盾卫) [D]",
    "raw_skills": "1.电摩冲击(3蓄力) 无法使用技能，速每回合+30直到170，攻每回合+20直到230，持续10回合。\n2.肥龙在天(1蓄力) 180普真混伤，造成3击溃值并立即击溃。\n3.睡觉(1蓝) 此技能效果视为Buff。嘲讽+1，防抗+45，每回合血上限+80，血+150，持续3回合，其间视为击溃状态。\n4.皮糙肉厚(被动) 受击时掷出1/3/5免疫，当血≤600时，每标准回合血+25。不会被脆弱/恐慌。",
    "images": [
      "archive/picture/8.jpeg"
    ],
    "reviewer": "回合制游戏工作室",
    "reviewed_at": null,
    "review_note": "",
    "editor": "",
    "edited_at": null,
    "deleter": "",
    "deleted_at": null,
    "source_submission_id": "",
    "deleted": false,
    "created_at": "2025-12-31T16:08:00.000Z",
    "updated_at": "2025-12-31T16:08:00.000Z"
  }
);

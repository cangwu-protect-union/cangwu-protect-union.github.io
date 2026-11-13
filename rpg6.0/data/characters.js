/* 由 _local/tools/gen-rpg-seed.js 生成，勿手改。
   仅在云数据库不可用时作兜底；正式数据以数据库为准。 */
window.RPG_SEED_CHARACTERS = [
  {
    "id": "rp-legacy-01",
    "seq": 1,
    "name": "王荣逸",
    "aliases": [],
    "occupation": "斗士",
    "side_job": "执旗手",
    "rating": "S",
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
      "archive/picture/1.jpeg"
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
      "archive/picture/2.jpeg"
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
      "archive/picture/3.jpeg"
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
      "archive/picture/4.jpeg"
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
    "created_at": "2025-12-31T16:04:00.000Z",
    "updated_at": "2025-12-31T16:04:00.000Z"
  },
  {
    "id": "rp-legacy-06",
    "seq": 6,
    "name": "田誉满",
    "aliases": [],
    "occupation": "强攻手",
    "side_job": "射手",
    "rating": "C",
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
        "effect": "而攻-2，支付n个蓝，(普攻-30)物伤3n次。",
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
        "effect": "而攻+2，攻+30。",
        "note": ""
      },
      {
        "name": "皮筋枪械",
        "condition": "被动",
        "effect": "开局3耐久，普攻消耗1耐久，无耐久则无法普攻或一技能。普攻掷色子，掷出1哑火，掷出6双倍伤害。",
        "note": ""
      }
    ],
    "raw_head": "O 田誉满(强攻手/射手)[C]",
    "raw_skills": "1.霰弹枪(1蓄力) 而攻-2，支付n个蓝，(普攻-30)物伤3n次。\n2.重机枪(3蓝3蓄力) 速度变为1000，持续50回合，不可使用1技能。\n3.纸质工艺(1蓝) 而攻+2，攻+30。\n4.皮筋枪械(被动) 开局3耐久，普攻消耗1耐久，无耐久则无法普攻或一技能。普攻掷色子，掷出1哑火，掷出6双倍伤害。",
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
      "archive/picture/9.jpeg"
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
  },
  {
    "id": "rp-legacy-10",
    "seq": 10,
    "name": "吕场龄",
    "aliases": [
      "土豆"
    ],
    "occupation": "粉碎者",
    "side_job": "召唤师",
    "rating": "D",
    "review_mark": "X",
    "atk": "50",
    "def": "15",
    "mres": "50",
    "hp": "300",
    "mp": "10",
    "spd": "75",
    "skills": [
      {
        "name": "土豆地雷",
        "condition": "1蓝1蓄力",
        "effect": "召唤出一个“土豆地雷”(300血，10标准回合后对最多3个敌人100真伤，并受50%脆弱5标准回合可叠加)。正常状态可用。",
        "note": ""
      },
      {
        "name": "剃发为僧",
        "condition": "1蓄力",
        "effect": "防+45，攻变为物伤，血及其上限+300，速-25，每回合不攻击则功德+1。对方血≤100则无法攻击，再次释放复原，期间无法被击溃和眩晕，不会脆弱/恐慌。",
        "note": ""
      },
      {
        "name": "超度",
        "condition": "5蓝",
        "effect": "只有在“剃发为僧”才能使用。在10秒内喊出“4是4，10是10，14是14，40是40，40不是14，14不是40”成功则对方强制死亡，功德+1。",
        "note": ""
      },
      {
        "name": "功德无量",
        "condition": "被动",
        "effect": "每有一个功德，攻防法抗+5，可消耗1个加+150血，只能不“剃发为僧”时才可以此回血。",
        "note": ""
      }
    ],
    "raw_head": "X [土豆] 吕场龄 (粉碎者/召唤师) [D]",
    "raw_skills": "1.土豆地雷(1蓝1蓄力) 召唤出一个“土豆地雷”(300血，10标准回合后对最多3个敌人100真伤，并受50%脆弱5标准回合可叠加)。正常状态可用。\n2.剃发为僧(1蓄力) 防+45，攻变为物伤，血及其上限+300，速-25，每回合不攻击则功德+1。对方血≤100则无法攻击，再次释放复原，期间无法被击溃和眩晕，不会脆弱/恐慌。\n3.超度(5蓝) 只有在“剃发为僧”才能使用。在10秒内喊出“4是4，10是10，14是14，40是40，40不是14，14不是40”成功则对方强制死亡，功德+1。\n4.功德无量(被动) 每有一个功德，攻防法抗+5，可消耗1个加+150血，只能不“剃发为僧”时才可以此回血。",
    "images": [
      "archive/picture/10.jpeg"
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
    "created_at": "2025-12-31T16:09:00.000Z",
    "updated_at": "2025-12-31T16:09:00.000Z"
  },
  {
    "id": "rp-legacy-11",
    "seq": 11,
    "name": "金圣杰",
    "aliases": [
      "杰哥"
    ],
    "occupation": "重装",
    "side_job": "破阵师",
    "rating": "S",
    "review_mark": "X",
    "atk": "135",
    "def": "30",
    "mres": "100",
    "hp": "1700",
    "mp": "5",
    "spd": "25",
    "skills": [
      {
        "name": "在杰难逃",
        "condition": "被动",
        "effect": "对方每受到自己3次伤害，攻防-5；每受到5次伤害，速抗-5，血上限-30。",
        "note": ""
      },
      {
        "name": "杰除封印",
        "condition": "1蓄力",
        "effect": "攻+70，速+40，抗-100，后每2回合攻-20，速-10，抗+20，持续8回合。",
        "note": ""
      },
      {
        "name": "万杰不复",
        "condition": "1蓝1蓄力",
        "effect": "对方受20%脆弱恐慌，每标准回合强制1位血上限5%，视为BUFF。",
        "note": ""
      },
      {
        "name": "杰骜不驯",
        "condition": "被动",
        "effect": "设n=0，每次受伤+1，受伤害掷出1-n则闪避，血+170并进行一次普攻(无击溃值)并n\t\t归零。",
        "note": ""
      },
      {
        "name": "光",
        "condition": "6蓝",
        "effect": "对方全体每标准回合物法真混伤9995，持续9995标准回合不可打断。",
        "note": ""
      }
    ],
    "raw_head": "X [杰哥] 金圣杰 (重装/破阵师) [S]",
    "raw_skills": "1.在杰难逃(被动) 对方每受到自己3次伤害，攻防-5；每受到5次伤害，速抗-5，血上限-30。\n2.杰除封印(1蓄力) 攻+70，速+40，抗-100，后每2回合攻-20，速-10，抗+20，持续8回合。\n3.万杰不复(1蓝1蓄力) 对方受20%脆弱恐慌，每标准回合强制1位血上限5%，视为BUFF。\n4.杰骜不驯(被动) 设n=0，每次受伤+1，受伤害掷出1-n则闪避，血+170并进行一次普攻(无击溃值)并n\t\t归零。\n5.光(6蓝) 对方全体每标准回合物法真混伤9995，持续9995标准回合不可打断。",
    "images": [
      "archive/picture/11.jpeg"
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
    "created_at": "2025-12-31T16:10:00.000Z",
    "updated_at": "2025-12-31T16:10:00.000Z"
  },
  {
    "id": "rp-legacy-12",
    "seq": 12,
    "name": "张家铭",
    "aliases": [
      "加加林"
    ],
    "occupation": "爆破手",
    "side_job": "强攻手",
    "rating": "C",
    "review_mark": "O",
    "atk": "130",
    "def": "60",
    "mres": "20",
    "hp": "700",
    "mp": "5",
    "spd": "40",
    "skills": [
      {
        "name": "小行星撞击",
        "condition": "2蓄力",
        "effect": "造成对方防x6普伤(无击溃值)。",
        "note": ""
      },
      {
        "name": "塞进垃圾桶",
        "condition": "1蓝3蓄力",
        "effect": "300普伤并眩晕5回合，后每对方回合50真伤，视为BUFF。",
        "note": ""
      },
      {
        "name": "秋风扫落叶",
        "condition": "1蓝1蓄力",
        "effect": "对方全体每标准回合受一次普攻伤害，5标准回合。",
        "note": ""
      },
      {
        "name": "卫委壮观",
        "condition": "被动",
        "effect": "可花15防/10抗随时闪避一次伤害，普攻在防抗不为0时1蓄力群攻。",
        "note": ""
      }
    ],
    "raw_head": "O [加加林] 张家铭 (爆破手/强攻手) [C]",
    "raw_skills": "1.小行星撞击(2蓄力) 造成对方防x6普伤(无击溃值)。\n2.塞进垃圾桶(1蓝3蓄力) 300普伤并眩晕5回合，后每对方回合50真伤，视为BUFF。\n3.秋风扫落叶(1蓝1蓄力) 对方全体每标准回合受一次普攻伤害，5标准回合。\n4.卫委壮观(被动) 可花15防/10抗随时闪避一次伤害，普攻在防抗不为0时1蓄力群攻。",
    "images": [
      "archive/picture/12.jpeg"
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
    "created_at": "2025-12-31T16:11:00.000Z",
    "updated_at": "2025-12-31T16:11:00.000Z"
  },
  {
    "id": "rp-legacy-13",
    "seq": 13,
    "name": "刘亦萱",
    "aliases": [],
    "occupation": "强攻手",
    "side_job": "执旗手",
    "rating": "A",
    "review_mark": "O",
    "atk": "100",
    "def": "10",
    "mres": "0",
    "hp": "550",
    "mp": "15",
    "spd": "60",
    "skills": [
      {
        "name": "十分“物理给力”",
        "condition": "被动",
        "effect": "每受5次攻击，攻+10，击溃归零。",
        "note": ""
      },
      {
        "name": "泼水节",
        "condition": "2蓝2蓄力",
        "effect": "无法普攻/放技能。对方全体每2回合150真伤，持续6回合，每次造成3击溃值(溢出自动击溃)，击溃眩晕打断。全中者每标准回合50法伤（Buff）。",
        "note": ""
      },
      {
        "name": "徒手开苹果",
        "condition": "3蓄力",
        "effect": "敌方全体100%恐慌2回合，自身攻+20。掷出n，获得n个碎苹果，每回合可选择吃1个血+90，击溃值-1。",
        "note": ""
      },
      {
        "name": "文学巨作",
        "condition": "2蓝",
        "effect": "获得50%勇猛，坚强3回合，叠加去除所有异常状态和Debuff。",
        "note": ""
      }
    ],
    "raw_head": "O 刘亦萱 (强攻手/执旗手) [A]",
    "raw_skills": "1.十分“物理给力”(被动) 每受5次攻击，攻+10，击溃归零。\n2.泼水节(2蓝2蓄力) 无法普攻/放技能。对方全体每2回合150真伤，持续6回合，每次造成3击溃值(溢出自动击溃)，击溃眩晕打断。全中者每标准回合50法伤（Buff）。\n3.徒手开苹果(3蓄力) 敌方全体100%恐慌2回合，自身攻+20。掷出n，获得n个碎苹果，每回合可选择吃1个血+90，击溃值-1。\n4.文学巨作(2蓝) 获得50%勇猛，坚强3回合，叠加去除所有异常状态和Debuff。",
    "images": [
      "archive/picture/13.jpeg"
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
    "created_at": "2025-12-31T16:12:00.000Z",
    "updated_at": "2025-12-31T16:12:00.000Z"
  },
  {
    "id": "rp-legacy-14",
    "seq": 14,
    "name": "于梓越",
    "aliases": [
      "消毒水战神"
    ],
    "occupation": "冲锋手",
    "side_job": "",
    "rating": "E",
    "review_mark": "X",
    "atk": "70",
    "def": "10",
    "mres": "0",
    "hp": "320",
    "mp": "2",
    "spd": "120",
    "skills": [
      {
        "name": "鸡肾豹肝",
        "condition": "1蓄力",
        "effect": "掷出1-3则160法伤，对方受75%虚弱1回合。掷出4-6则150真伤，对方防抗-5。无击溃值。",
        "note": ""
      },
      {
        "name": "夏极八打",
        "condition": "5蓄力",
        "effect": "攻-35，速+295，不造成击溃值，9回合，期间无法放技能。",
        "note": ""
      },
      {
        "name": "削肾客的救赎",
        "condition": "2蓝",
        "effect": "给任意1人“鸡肾豹肝”2下，此人速x2，8回合。",
        "note": ""
      }
    ],
    "raw_head": "X [消毒水战神] 于梓越 (冲锋手) [E]",
    "raw_skills": "1.鸡肾豹肝(1蓄力) 掷出1-3则160法伤，对方受75%虚弱1回合。掷出4-6则150真伤，对方防抗-5。无击溃值。\n2.夏极八打(5蓄力) 攻-35，速+295，不造成击溃值，9回合，期间无法放技能。\n3.削肾客的救赎(2蓝) 给任意1人“鸡肾豹肝”2下，此人速x2，8回合。",
    "images": [
      "archive/picture/14.jpeg"
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
    "created_at": "2025-12-31T16:13:00.000Z",
    "updated_at": "2025-12-31T16:13:00.000Z"
  },
  {
    "id": "rp-legacy-15",
    "seq": 15,
    "name": "张克太",
    "aliases": [],
    "occupation": "强攻手",
    "side_job": "执旗手",
    "rating": "A",
    "review_mark": "X",
    "atk": "125",
    "def": "10",
    "mres": "10",
    "hp": "650",
    "mp": "20",
    "spd": "40",
    "skills": [
      {
        "name": "吉罢之歌",
        "condition": "2蓝",
        "effect": "每标准回合60法伤，持续5标准回合，不造成眩晕值，击晕打断。",
        "note": ""
      },
      {
        "name": "副班主任之威[余威尚存]",
        "condition": "6蓝4蓄力",
        "effect": "自己攻速+80，持续10标准回合，自己前5回合无法行动，后5回合只能普攻，技能期间队友攻防抗速均+30。",
        "note": ""
      },
      {
        "name": "LSP",
        "condition": "被动",
        "effect": "场上每一个女角色，攻防+10，速+10，法抗-5。",
        "note": ""
      },
      {
        "name": "愈挫愈勇",
        "condition": "被动",
        "effect": "每造成3次伤害，攻+5；每受到3次伤害，防+5；每受到3次属性削弱，法抗+5，速+5。",
        "note": ""
      }
    ],
    "raw_head": "X 张克太 (强攻手/执旗手) [A]",
    "raw_skills": "1.吉罢之歌(2蓝) 每标准回合60法伤，持续5标准回合，不造成眩晕值，击晕打断。\n2.副班主任之威[余威尚存]（6蓝4蓄力） 自己攻速+80，持续10标准回合，自己前5回合无法行动，后5回合只能普攻，技能期间队友攻防抗速均+30。\n3.LSP(被动) 场上每一个女角色，攻防+10，速+10，法抗-5。\n4.愈挫愈勇(被动) 每造成3次伤害，攻+5；每受到3次伤害，防+5；每受到3次属性削弱，法抗+5，速+5。",
    "images": [
      "archive/picture/15.jpeg"
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
    "created_at": "2025-12-31T16:14:00.000Z",
    "updated_at": "2025-12-31T16:14:00.000Z"
  },
  {
    "id": "rp-legacy-16",
    "seq": 16,
    "name": "顾文达",
    "aliases": [],
    "occupation": "强攻手",
    "side_job": "",
    "rating": "D",
    "review_mark": "O",
    "atk": "110",
    "def": "30",
    "mres": "0",
    "hp": "580",
    "mp": "10",
    "spd": "55",
    "skills": [
      {
        "name": "人高马大",
        "condition": "被动",
        "effect": "免疫60以下伤害，每受一次伤害免疫上限-5，血+15，直至无。",
        "note": ""
      },
      {
        "name": "下潜",
        "condition": "1蓄力",
        "effect": "视为Buff，被动效果x2，免疫异常状态，锁死对方技能，自身无法普攻，不被击溃，蓄力不被打断，受到伤害取消，取消后防变为0且被动失效1回合。",
        "note": ""
      },
      {
        "name": "炸弹摔",
        "condition": "1蓝3蓄力",
        "effect": "掷出n≤对方击溃值(对方被击溃必中)400真混伤。",
        "note": ""
      },
      {
        "name": "硕哥过肩摔",
        "condition": "1蓄力",
        "effect": "蓄力期间受伤害/击溃则免疫并立即发动，80物法混伤。",
        "note": ""
      }
    ],
    "raw_head": "O 顾文达 (强攻手) [D]\t\tGwd\t<-本人签名",
    "raw_skills": "1.人高马大(被动) 免疫60以下伤害，每受一次伤害免疫上限-5，血+15，直至无。\n2.下潜(1蓄力) 视为Buff，被动效果x2，免疫异常状态，锁死对方技能，自身无法普攻，不被击溃，蓄力不被打断，受到伤害取消，取消后防变为0且被动失效1回合。\n3.炸弹摔(1蓝3蓄力) 掷出n≤对方击溃值(对方被击溃必中)400真混伤。\n4.硕哥过肩摔(1蓄力) 蓄力期间受伤害/击溃则免疫并立即发动，80物法混伤。",
    "images": [
      "archive/picture/16.jpeg"
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
    "created_at": "2025-12-31T16:15:00.000Z",
    "updated_at": "2025-12-31T16:15:00.000Z"
  },
  {
    "id": "rp-legacy-17",
    "seq": 17,
    "name": "泥浩恺",
    "aliases": [],
    "occupation": "盾卫",
    "side_job": "破阵师",
    "rating": "A",
    "review_mark": "O",
    "atk": "80",
    "def": "60",
    "mres": "10",
    "hp": "1300",
    "mp": "10",
    "spd": "30",
    "skills": [
      {
        "name": "核蔼可氢",
        "condition": "2蓝",
        "effect": "不消耗回合，设n=6-使用次数，掷出1-n时35真伤，回复造成伤害，n-1，在下一回合再次发动一次且伤害x2，不可叠加，不可打断。",
        "note": ""
      },
      {
        "name": "职业道德",
        "condition": "1蓝2蓄力",
        "effect": "对方受200%脆弱，自身攻变为300，后每回合攻-55，持续4回合，期间不造成击溃值。",
        "note": ""
      },
      {
        "name": "加分",
        "condition": "1蓝",
        "effect": "后5次伤害转为50法伤反弹，不造溃值，对方在游戏期间打人/说脏话/大叫/擅自离开则无条件立刻发动。",
        "note": ""
      },
      {
        "name": "来自深渊的凝视",
        "condition": "被动",
        "effect": "当自己无眩晕/击溃时，对敌方3回合蓝上限-1，当蓝上限<0时每标准回合50强制扣血。自身被击溃后复原并永久-2。",
        "note": ""
      }
    ],
    "raw_head": "O 泥浩恺 (盾卫/破阵师) [A]",
    "raw_skills": "1.核蔼可氢(2蓝) 不消耗回合，设n=6-使用次数，掷出1-n时35真伤，回复造成伤害，n-1，在下一回合再次发动一次且伤害x2，不可叠加，不可打断。\n2.职业道德(1蓝2蓄力) 对方受200%脆弱，自身攻变为300，后每回合攻-55，持续4回合，期间不造成击溃值。\n3.加分(1蓝) 后5次伤害转为50法伤反弹，不造溃值，对方在游戏期间打人/说脏话/大叫/擅自离开则无条件立刻发动。\n4.来自深渊的凝视(被动) 当自己无眩晕/击溃时，对敌方3回合蓝上限-1，当蓝上限<0时每标准回合50强制扣血。自身被击溃后复原并永久-2。",
    "images": [
      "archive/picture/17.jpeg"
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
    "created_at": "2025-12-31T16:16:00.000Z",
    "updated_at": "2025-12-31T16:16:00.000Z"
  },
  {
    "id": "rp-legacy-18",
    "seq": 18,
    "name": "韩东晓",
    "aliases": [],
    "occupation": "粉碎者",
    "side_job": "射手",
    "rating": "S",
    "review_mark": "X",
    "atk": "85",
    "def": "30",
    "mres": "50",
    "hp": "430",
    "mp": "20",
    "spd": "90",
    "skills": [
      {
        "name": "我帅不帅？",
        "condition": "1蓝",
        "effect": "对面说帅血+80，否则150物伤。",
        "note": ""
      },
      {
        "name": "我是天才！",
        "condition": "3蓄力",
        "effect": "蓝+5，攻防抗速+10。对方全体得100%勇猛，每标准回合-20%，持续4标准回合。",
        "note": ""
      },
      {
        "name": "抽象艺术",
        "condition": "4蓝2蓄力",
        "effect": "每回合掷出n，对方猜中则打断，否则受n次普攻(无法溃值)。只有在对说帅时下一回合才能使用。",
        "note": ""
      },
      {
        "name": "机枪射手",
        "condition": "5蓝上限",
        "effect": "造成10真伤5次。",
        "note": ""
      }
    ],
    "raw_head": "X 韩东晓 (粉碎者/射手) [S]",
    "raw_skills": "1.我帅不帅？(1蓝) 对面说帅血+80，否则150物伤。\n2.我是天才！(3蓄力) 蓝+5，攻防抗速+10。对方全体得100%勇猛，每标准回合-20%，持续4标准回合。\n3.抽象艺术(4蓝2蓄力) 每回合掷出n，对方猜中则打断，否则受n次普攻(无法溃值)。只有在对说帅时下一回合才能使用。\n4.机枪射手(5蓝上限) 造成10真伤5次。",
    "images": [
      "archive/picture/18.jpeg"
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
    "created_at": "2025-12-31T16:17:00.000Z",
    "updated_at": "2025-12-31T16:17:00.000Z"
  },
  {
    "id": "rp-legacy-19",
    "seq": 19,
    "name": "羊书含",
    "aliases": [],
    "occupation": "强攻手",
    "side_job": "召唤师",
    "rating": "C",
    "review_mark": "O",
    "atk": "130",
    "def": "0",
    "mres": "10",
    "hp": "600",
    "mp": "10",
    "spd": "40",
    "skills": [
      {
        "name": "王霸之气",
        "condition": "被动",
        "effect": "开局全体敌方攻防抗-20，每3标准回合受25真伤，持续15标准回合。",
        "note": ""
      },
      {
        "name": "涌泉相报",
        "condition": "2蓝1蓄力",
        "effect": "造成20/40/60.../120间的法伤，共3次，不造成击溃值。",
        "note": ""
      },
      {
        "name": "杨舒涵之墓",
        "condition": "5蓝4蓄力",
        "effect": "召唤1个“杨舒然之墓”(200/0/0/1200/0/0) 无法被击溃，且当羊书血-100，释放条件-1蓝1蓄力。攻击造成真伤，期间羊书含无法普攻，其普攻为杨舒然之墓回血，只能用1次。",
        "note": ""
      }
    ],
    "raw_head": "O 羊书含 (强攻手/召唤师) [C]",
    "raw_skills": "1.王霸之气(被动) 开局全体敌方攻防抗-20，每3标准回合受25真伤，持续15标准回合。\n2.涌泉相报(2蓝1蓄力) 造成20/40/60.../120间的法伤，共3次，不造成击溃值。\n3.杨舒涵之墓(5蓝4蓄力) 召唤1个“杨舒然之墓”(200/0/0/1200/0/0) 无法被击溃，且当羊书血-100，释放条件-1蓝1蓄力。攻击造成真伤，期间羊书含无法普攻，其普攻为杨舒然之墓回血，只能用1次。",
    "images": [
      "archive/picture/19.jpeg"
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
    "created_at": "2025-12-31T16:18:00.000Z",
    "updated_at": "2025-12-31T16:18:00.000Z"
  },
  {
    "id": "rp-legacy-20",
    "seq": 20,
    "name": "李雨轩",
    "aliases": [],
    "occupation": "斗士",
    "side_job": "破阵师",
    "rating": "D",
    "review_mark": "X",
    "atk": "60",
    "def": "30",
    "mres": "10",
    "hp": "450",
    "mp": "5",
    "spd": "55",
    "skills": [
      {
        "name": "只因只因爆",
        "condition": "3蓝2蓄力",
        "effect": "防抗变为0，每标准回合血-45，攻+80，造成伤害后掷出6则血回满，持续4标准回合。",
        "note": ""
      },
      {
        "name": "小学生人大代表",
        "condition": "2蓝",
        "effect": "全体敌方单位防抗降至0，每标准回合+10，直至恢复原样。",
        "note": ""
      },
      {
        "name": "旋转",
        "condition": "1蓝1蓄力",
        "effect": "造成10/20/30/40/50法伤/标准回合，从头依次向后造成，敌方被击溃后打断。敌方在技能期间每标准回合击溃值+1，溢出自动击溃，击溃时技能结束，技能期间敌方无法普攻/蓄力。",
        "note": ""
      }
    ],
    "raw_head": "X 李雨轩 (斗士/破阵师) [D]",
    "raw_skills": "1.只因只因爆(3蓝2蓄力) 防抗变为0，每标准回合血-45，攻+80，造成伤害后掷出6则血回满，持续4标准回合。\n2.小学生人大代表(2蓝) 全体敌方单位防抗降至0，每标准回合+10，直至恢复原样。\n3.旋转(1蓝1蓄力) 造成10/20/30/40/50法伤/标准回合，从头依次向后造成，敌方被击溃后打断。敌方在技能期间每标准回合击溃值+1，溢出自动击溃，击溃时技能结束，技能期间敌方无法普攻/蓄力。",
    "images": [],
    "reviewer": "回合制游戏工作室",
    "reviewed_at": null,
    "review_note": "",
    "editor": "",
    "edited_at": null,
    "deleter": "",
    "deleted_at": null,
    "source_submission_id": "",
    "deleted": false,
    "created_at": "2025-12-31T16:19:00.000Z",
    "updated_at": "2025-12-31T16:19:00.000Z"
  },
  {
    "id": "rp-legacy-21",
    "seq": 21,
    "name": "刘滨路",
    "aliases": [],
    "occupation": "重装",
    "side_job": "召唤师",
    "rating": "C",
    "review_mark": "X",
    "atk": "110",
    "def": "10",
    "mres": "80",
    "hp": "1205",
    "mp": "15",
    "spd": "20",
    "skills": [
      {
        "name": "旷课",
        "condition": "被动",
        "effect": "每次受到伤害掷出6则免疫且自己蓝+1，每次行动或释放技能获得一点动能，动能到7时全体敌方被击溃5标准回合。",
        "note": ""
      },
      {
        "name": "强制内卷",
        "condition": "2蓝",
        "effect": "造成70法伤/标准回合，持续4标准回合。",
        "note": ""
      },
      {
        "name": "形影不离",
        "condition": "1蓝1蓄力",
        "effect": "召唤一个小刘亦萱，4标准回合后自爆，造成70群真伤。",
        "note": ""
      }
    ],
    "raw_head": "X 刘滨路 (重装/召唤师) [C]",
    "raw_skills": "1.旷课(被动) 每次受到伤害掷出6则免疫且自己蓝+1，每次行动或释放技能获得一点动能，动能到7时全体敌方被击溃5标准回合。\n2.强制内卷(2蓝) 造成70法伤/标准回合，持续4标准回合。\n3.形影不离(1蓝1蓄力) 召唤一个小刘亦萱，4标准回合后自爆，造成70群真伤。",
    "images": [],
    "reviewer": "回合制游戏工作室",
    "reviewed_at": null,
    "review_note": "",
    "editor": "",
    "edited_at": null,
    "deleter": "",
    "deleted_at": null,
    "source_submission_id": "",
    "deleted": false,
    "created_at": "2025-12-31T16:20:00.000Z",
    "updated_at": "2025-12-31T16:20:00.000Z"
  },
  {
    "id": "rp-legacy-22",
    "seq": 22,
    "name": "倪曼云",
    "aliases": [],
    "occupation": "斗士",
    "side_job": "爆破手",
    "rating": "B",
    "review_mark": "X",
    "atk": "85",
    "def": "25",
    "mres": "30",
    "hp": "550",
    "mp": "15",
    "spd": "70",
    "skills": [
      {
        "name": "卷",
        "condition": "1蓝",
        "effect": "血上限-20，造成2次70法伤，血回复造成的伤害，每触发一次扣的血上限和造成的法伤+10，叠3层。",
        "note": ""
      },
      {
        "name": "刚长出来",
        "condition": "被动",
        "effect": "对方开局攻防为0，每花1蓝解锁1个，且解锁3标准回合后才能用。",
        "note": ""
      },
      {
        "name": "越共探头",
        "condition": "1蓄力",
        "effect": "血上限+60，若对方攻击/击溃则免疫且触发2次“卷”。",
        "note": ""
      }
    ],
    "raw_head": "X 倪曼云 (斗士/爆破手) [B]",
    "raw_skills": "1.卷(1蓝) 血上限-20，造成2次70法伤，血回复造成的伤害，每触发一次扣的血上限和造成的法伤+10，叠3层。\n2.刚长出来(被动) 对方开局攻防为0，每花1蓝解锁1个，且解锁3标准回合后才能用。\n3.越共探头(1蓄力) 血上限+60，若对方攻击/击溃则免疫且触发2次“卷”。",
    "images": [],
    "reviewer": "回合制游戏工作室",
    "reviewed_at": null,
    "review_note": "",
    "editor": "",
    "edited_at": null,
    "deleter": "",
    "deleted_at": null,
    "source_submission_id": "",
    "deleted": false,
    "created_at": "2025-12-31T16:21:00.000Z",
    "updated_at": "2025-12-31T16:21:00.000Z"
  },
  {
    "id": "rp-legacy-23",
    "seq": 23,
    "name": "赵云哲",
    "aliases": [],
    "occupation": "粉碎者",
    "side_job": "射手",
    "rating": "A",
    "review_mark": "X",
    "atk": "60",
    "def": "15",
    "mres": "20",
    "hp": "425",
    "mp": "10",
    "spd": "95",
    "skills": [
      {
        "name": "剑光如我，斩尽牛杂！",
        "condition": "9蓝",
        "effect": "造成10x10的法伤，算眩晕值，溢出自动击晕。",
        "note": ""
      },
      {
        "name": "彻底疯狂",
        "condition": "2蓄力",
        "effect": "之后每造成4次伤害附加一次65群真伤且全体敌方单位眩晕1个敌方回合，持续12个标准回合。",
        "note": ""
      },
      {
        "name": "嬉皮笑脸",
        "condition": "4回合冷却",
        "effect": "造成65真伤，且之后普攻附加15真伤(有击溃值)持续2标准回合。",
        "note": ""
      },
      {
        "name": "高冷如冰",
        "condition": "被动",
        "effect": "普攻不造成击溃值，每次普攻掷出6则附加1点卅力，当一个敌方单位卅力达到5时，下次受到法伤x2，且卅力值清空",
        "note": ""
      }
    ],
    "raw_head": "X 赵云哲 (粉碎者/射手) [A]",
    "raw_skills": "1.剑光如我，斩尽牛杂！(9蓝) 造成10x10的法伤，算眩晕值，溢出自动击晕。\n2.彻底疯狂(2蓄力) 之后每造成4次伤害附加一次65群真伤且全体敌方单位眩晕1个敌方回合，持续12个标准回合。\n3.嬉皮笑脸(4回合冷却) 造成65真伤，且之后普攻附加15真伤(有击溃值)持续2标准回合。\n4.高冷如冰(被动) 普攻不造成击溃值，每次普攻掷出6则附加1点卅力，当一个敌方单位卅力达到5时，下次受到法伤x2，且卅力值清空",
    "images": [],
    "reviewer": "回合制游戏工作室",
    "reviewed_at": null,
    "review_note": "",
    "editor": "",
    "edited_at": null,
    "deleter": "",
    "deleted_at": null,
    "source_submission_id": "",
    "deleted": false,
    "created_at": "2025-12-31T16:22:00.000Z",
    "updated_at": "2025-12-31T16:22:00.000Z"
  },
  {
    "id": "rp-legacy-24",
    "seq": 24,
    "name": "甲天浩",
    "aliases": [],
    "occupation": "爆发者",
    "side_job": "",
    "rating": "C",
    "review_mark": "X",
    "atk": "40",
    "def": "10",
    "mres": "45",
    "hp": "350",
    "mp": "15",
    "spd": "65",
    "skills": [
      {
        "name": "向死而生",
        "condition": "被动",
        "effect": "血降到0后不死，普攻变为真伤，回复造成的伤害，不造成也不受击溃值。若5标准回合后血≥0则复活，血上限-100。",
        "note": ""
      },
      {
        "name": "再攀高峰",
        "condition": "1蓝3蓄力",
        "effect": "200物伤，每死一次附加100真伤。",
        "note": ""
      },
      {
        "name": "身残志坚",
        "condition": "3蓝6蓄力",
        "effect": "速+失去的血量(每标准回合重新计算)每回合血上限+10，持续2标准回合，每死1次多1标准回合。",
        "note": ""
      },
      {
        "name": "妙手回春",
        "condition": "5回合冷却",
        "effect": "血+80，速-15，持续4回合。",
        "note": ""
      }
    ],
    "raw_head": "X 甲天浩 (爆发者) [C]",
    "raw_skills": "1.向死而生(被动) 血降到0后不死，普攻变为真伤，回复造成的伤害，不造成也不受击溃值。若5标准回合后血≥0则复活，血上限-100。\n2.再攀高峰(1蓝3蓄力) 200物伤，每死一次附加100真伤。\n3.身残志坚(3蓝6蓄力) 速+失去的血量(每标准回合重新计算)每回合血上限+10，持续2标准回合，每死1次多1标准回合。\n4.妙手回春(5回合冷却) 血+80，速-15，持续4回合。",
    "images": [],
    "reviewer": "回合制游戏工作室",
    "reviewed_at": null,
    "review_note": "",
    "editor": "",
    "edited_at": null,
    "deleter": "",
    "deleted_at": null,
    "source_submission_id": "",
    "deleted": false,
    "created_at": "2025-12-31T16:23:00.000Z",
    "updated_at": "2025-12-31T16:23:00.000Z"
  },
  {
    "id": "rp-legacy-25",
    "seq": 25,
    "name": "谢雨辰",
    "aliases": [],
    "occupation": "冲锋手",
    "side_job": "",
    "rating": "C",
    "review_mark": "X",
    "atk": "100",
    "def": "0",
    "mres": "0",
    "hp": "290",
    "mp": "5",
    "spd": "150",
    "skills": [
      {
        "name": "一手好牌",
        "condition": "4回合冷却",
        "effect": "造成70法伤，共4次，不造成击溃值，若掷出6则伤害+150%。",
        "note": ""
      },
      {
        "name": "勇敢勇敢我的朋友！",
        "condition": "2蓝2蓄力",
        "effect": "自己速+150，其它人速+50，持续5个标准回合，之后自己速-200，其它人速-60，持续3个标准回合。",
        "note": ""
      },
      {
        "name": "儿女情肠",
        "condition": "2蓄力",
        "effect": "全体敌人每标准回合受到30真伤，不造成击溃值，持续3回合。",
        "note": ""
      }
    ],
    "raw_head": "X 谢雨辰 (冲锋手) [C]",
    "raw_skills": "1.一手好牌(4回合冷却) 造成70法伤，共4次，不造成击溃值，若掷出6则伤害+150%。\n2.勇敢勇敢我的朋友！(2蓝2蓄力) 自己速+150，其它人速+50，持续5个标准回合，之后自己速-200，其它人速-60，持续3个标准回合。\n3.儿女情肠(2蓄力) 全体敌人每标准回合受到30真伤，不造成击溃值，持续3回合。",
    "images": [],
    "reviewer": "回合制游戏工作室",
    "reviewed_at": null,
    "review_note": "",
    "editor": "",
    "edited_at": null,
    "deleter": "",
    "deleted_at": null,
    "source_submission_id": "",
    "deleted": false,
    "created_at": "2025-12-31T16:24:00.000Z",
    "updated_at": "2025-12-31T16:24:00.000Z"
  },
  {
    "id": "rp-legacy-26",
    "seq": 26,
    "name": "王春雨",
    "aliases": [],
    "occupation": "冲锋手",
    "side_job": "",
    "rating": "D",
    "review_mark": "X",
    "atk": "60",
    "def": "10",
    "mres": "10",
    "hp": "370",
    "mp": "10",
    "spd": "110",
    "skills": [
      {
        "name": "刺蛋老人",
        "condition": "2蓄力",
        "effect": "造成110真伤且之后无法普攻和蓄力，持续1敌方回合，之后其附加20%的勇猛，持续2敌方回合。",
        "note": ""
      },
      {
        "name": "学富五车",
        "condition": "4回合3蓝",
        "effect": "之后受到的伤害转换为血上限增加，持续3敌方回合。",
        "note": ""
      },
      {
        "name": "糕爆战士",
        "condition": "5蓝3蓄力",
        "effect": "防和抗降至0，速+140，攻-10，持续4回合。",
        "note": ""
      },
      {
        "name": "春雨贵如油",
        "condition": "？",
        "effect": "",
        "note": ""
      }
    ],
    "raw_head": "X 王春雨 (冲锋手) [D]",
    "raw_skills": "1.刺蛋老人(2蓄力) 造成110真伤且之后无法普攻和蓄力，持续1敌方回合，之后其附加20%的勇猛，持续2敌方回合。\n2.学富五车(4回合3蓝) 之后受到的伤害转换为血上限增加，持续3敌方回合。\n3.糕爆战士(5蓝3蓄力) 防和抗降至0，速+140，攻-10，持续4回合。\n4.春雨贵如油(？)",
    "images": [],
    "reviewer": "回合制游戏工作室",
    "reviewed_at": null,
    "review_note": "",
    "editor": "",
    "edited_at": null,
    "deleter": "",
    "deleted_at": null,
    "source_submission_id": "",
    "deleted": false,
    "created_at": "2025-12-31T16:25:00.000Z",
    "updated_at": "2025-12-31T16:25:00.000Z"
  },
  {
    "id": "rp-legacy-27",
    "seq": 27,
    "name": "郑湾湾",
    "aliases": [],
    "occupation": "斗士",
    "side_job": "嘲讽手",
    "rating": "SSS",
    "review_mark": "√",
    "atk": "120",
    "def": "70",
    "mres": "20",
    "hp": "880",
    "mp": "30",
    "spd": "120",
    "skills": [
      {
        "name": "拍后脑勺",
        "condition": "1蓝",
        "effect": "130普伤，附加20%的恐慌，持续4回合，可打断所有不可打断的技能。",
        "note": ""
      },
      {
        "name": "班主任的凝视",
        "condition": "2蓝1蓄力",
        "effect": "每回合造成25群真伤，不造成击溃值，全体敌人攻-25，速-25，持续7回合。",
        "note": ""
      },
      {
        "name": "手机铃声",
        "condition": "6回合冷却",
        "effect": "召唤1个手机，每标准回合80法伤持续3回合，其间掷出6则自己蓝+1。",
        "note": ""
      },
      {
        "name": "三角板暴风雨",
        "condition": "6蓝2蓄力",
        "effect": "245点上次自己受到的伤害类型，持续5回合，结束后再造成100点上次自己受到的伤害类型的群伤。",
        "note": ""
      }
    ],
    "raw_head": "√ 郑湾湾 (斗士/嘲讽手) [SSS]",
    "raw_skills": "1.拍后脑勺(1蓝) 130普伤，附加20%的恐慌，持续4回合，可打断所有不可打断的技能。\n2.班主任的凝视(2蓝1蓄力) 每回合造成25群真伤，不造成击溃值，全体敌人攻-25，速-25，持续7回合。\n3.手机铃声(6回合冷却) 召唤1个手机，每标准回合80法伤持续3回合，其间掷出6则自己蓝+1。\n4.三角板暴风雨(6蓝2蓄力) 245点上次自己受到的伤害类型，持续5回合，结束后再造成100点上次自己受到的伤害类型的群伤。",
    "images": [],
    "reviewer": "回合制游戏工作室",
    "reviewed_at": null,
    "review_note": "",
    "editor": "",
    "edited_at": null,
    "deleter": "",
    "deleted_at": null,
    "source_submission_id": "",
    "deleted": false,
    "created_at": "2025-12-31T16:26:00.000Z",
    "updated_at": "2025-12-31T16:26:00.000Z"
  },
  {
    "id": "rp-legacy-28",
    "seq": 28,
    "name": "正盈利",
    "aliases": [],
    "occupation": "强攻手",
    "side_job": "召唤师",
    "rating": "SB",
    "review_mark": "X",
    "atk": "110",
    "def": "45",
    "mres": "30",
    "hp": "780",
    "mp": "20",
    "spd": "50",
    "skills": [
      {
        "name": "葵花宝典",
        "condition": "4回合冷却",
        "effect": "召唤1个葵花宝典，每回合造成50群法伤，持续2回合，结束后再造成75群普伤。",
        "note": ""
      },
      {
        "name": "独裁主义",
        "condition": "5蓄力",
        "effect": "每次造成伤害召唤1个葵花宝典，个数上限为3，持续4回合。",
        "note": ""
      },
      {
        "name": "负亏损",
        "condition": "1蓄力",
        "effect": "攻-110，防+110，抗+70，血上限-400，再次使用除血上限其它都复原。",
        "note": ""
      },
      {
        "name": "死了没埋",
        "condition": "6蓝2蓄力",
        "effect": "使一个敌方单位血上限-60%，附加100%的脆弱，持续8回合。",
        "note": ""
      }
    ],
    "raw_head": "X  正盈利 (强攻手/召唤师) [SB]",
    "raw_skills": "1.葵花宝典(4回合冷却) 召唤1个葵花宝典，每回合造成50群法伤，持续2回合，结束后再造成75群普伤。\n2.独裁主义(5蓄力) 每次造成伤害召唤1个葵花宝典，个数上限为3，持续4回合。\n3.负亏损(1蓄力) 攻-110，防+110，抗+70，血上限-400，再次使用除血上限其它都复原。\n4.死了没埋(6蓝2蓄力) 使一个敌方单位血上限-60%，附加100%的脆弱，持续8回合。",
    "images": [],
    "reviewer": "回合制游戏工作室",
    "reviewed_at": null,
    "review_note": "",
    "editor": "",
    "edited_at": null,
    "deleter": "",
    "deleted_at": null,
    "source_submission_id": "",
    "deleted": false,
    "created_at": "2025-12-31T16:27:00.000Z",
    "updated_at": "2025-12-31T16:27:00.000Z"
  },
  {
    "id": "rp-legacy-29",
    "seq": 29,
    "name": "包必冉",
    "aliases": [],
    "occupation": "粉碎者",
    "side_job": "",
    "rating": "E",
    "review_mark": "√",
    "atk": "45",
    "def": "25",
    "mres": "20",
    "hp": "275",
    "mp": "3",
    "spd": "90",
    "skills": [
      {
        "name": "无能狂怒",
        "condition": "1蓝",
        "effect": "每回合普攻一次，持续5回合。",
        "note": ""
      },
      {
        "name": "口出狂言",
        "condition": "2蓝1蓄力",
        "effect": "175普攻，之后每回合附加5%的恐慌，持续4回合。",
        "note": ""
      },
      {
        "name": "三杯不过岗",
        "condition": "被动",
        "effect": "攻击掷出2/4/6伤害+100%，且转换成真伤，掷出1/3/5则转换成回血。",
        "note": ""
      }
    ],
    "raw_head": "√ 包必冉(粉碎者)[E]",
    "raw_skills": "1.无能狂怒(1蓝) 每回合普攻一次，持续5回合。\n2.口出狂言(2蓝1蓄力) 175普攻，之后每回合附加5%的恐慌，持续4回合。\n3.三杯不过岗(被动) 攻击掷出2/4/6伤害+100%，且转换成真伤，掷出1/3/5则转换成回血。",
    "images": [],
    "reviewer": "回合制游戏工作室",
    "reviewed_at": null,
    "review_note": "",
    "editor": "",
    "edited_at": null,
    "deleter": "",
    "deleted_at": null,
    "source_submission_id": "",
    "deleted": false,
    "created_at": "2025-12-31T16:28:00.000Z",
    "updated_at": "2025-12-31T16:28:00.000Z"
  },
  {
    "id": "rp-legacy-30",
    "seq": 30,
    "name": "杨冬明",
    "aliases": [],
    "occupation": "粉碎者",
    "side_job": "召唤师",
    "rating": "SSS",
    "review_mark": "X",
    "atk": "40",
    "def": "60",
    "mres": "40",
    "hp": "400",
    "mp": "30",
    "spd": "100",
    "skills": [
      {
        "name": "竹光法杖",
        "condition": "10防",
        "effect": "造成50法伤，共3次，且其眩晕2敌方单位。",
        "note": ""
      },
      {
        "name": "坚若磐石",
        "condition": "5回合冷却",
        "effect": "获得一个300血的护盾，破盾时不受额外伤害，4回合消除但防+5。",
        "note": ""
      },
      {
        "name": "嘚吪呐呃嘶哦",
        "condition": "1回合冷却",
        "effect": "召唤1个“嘚吪呐呃嘶哦”，上限为6，每回合50法伤，每召唤1个伤害+5，10回合后消除。",
        "note": ""
      },
      {
        "name": "旱葱大祓",
        "condition": "8蓝",
        "effect": "造成200法伤且全体敌人附加50%恐慌，消除所有召唤物使自己速+100，攻+30，普攻变成真伤且无视嘲讽等级且附加10%恐慌，期间无法被击溃且全体敌人击溃值溢出自动击溃持续6回合，掷出6则回数+1，召唤物≥3时才能使用。",
        "note": ""
      }
    ],
    "raw_head": "X 杨冬明 (粉碎者/召唤师) [SSS]",
    "raw_skills": "1.竹光法杖(10防) 造成50法伤，共3次，且其眩晕2敌方单位。\n2.坚若磐石(5回合冷却) 获得一个300血的护盾，破盾时不受额外伤害，4回合消除但防+5。\n3.嘚吪呐呃嘶哦(1回合冷却) 召唤1个“嘚吪呐呃嘶哦”，上限为6，每回合50法伤，每召唤1个伤害+5，10回合后消除。\n4.旱葱大祓(8蓝) 造成200法伤且全体敌人附加50%恐慌，消除所有召唤物使自己速+100，攻+30，普攻变成真伤且无视嘲讽等级且附加10%恐慌，期间无法被击溃且全体敌人击溃值溢出自动击溃持续6回合，掷出6则回数+1，召唤物≥3时才能使用。",
    "images": [],
    "reviewer": "回合制游戏工作室",
    "reviewed_at": null,
    "review_note": "",
    "editor": "",
    "edited_at": null,
    "deleter": "",
    "deleted_at": null,
    "source_submission_id": "",
    "deleted": false,
    "created_at": "2025-12-31T16:29:00.000Z",
    "updated_at": "2025-12-31T16:29:00.000Z"
  },
  {
    "id": "rp-legacy-31",
    "seq": 31,
    "name": "孙嘉怿",
    "aliases": [],
    "occupation": "冲锋手",
    "side_job": "",
    "rating": "D",
    "review_mark": "O",
    "atk": "受攻击者当前血量的20%",
    "def": "140",
    "mres": "20",
    "hp": "400",
    "mp": "15",
    "spd": "75",
    "skills": [
      {
        "name": "送“礼物”",
        "condition": "6回合冷却",
        "effect": "使一个己方单位普攻1次，血+65，附加10%的脆弱，3回合。",
        "note": ""
      },
      {
        "name": "抛媚眼",
        "condition": "2蓄力",
        "effect": "75幻伤，之后5回合每回合全体己方单位血量+孙嘉怿血上限的20%。",
        "note": ""
      },
      {
        "name": "领毒者",
        "condition": "4蓝",
        "effect": "使一个敌方单位眩晕且每回合血-10，受到1次伤害后停止，最多持续10个标准回合。",
        "note": ""
      }
    ],
    "raw_head": "O 孙嘉怿 (冲锋手) [D]",
    "raw_skills": "1.送“礼物”(6回合冷却) 使一个己方单位普攻1次，血+65，附加10%的脆弱，3回合。\n2.抛媚眼(2蓄力) 75幻伤，之后5回合每回合全体己方单位血量+孙嘉怿血上限的20%。\n3.领毒者(4蓝) 使一个敌方单位眩晕且每回合血-10，受到1次伤害后停止，最多持续10个标准回合。",
    "images": [],
    "reviewer": "回合制游戏工作室",
    "reviewed_at": null,
    "review_note": "",
    "editor": "",
    "edited_at": null,
    "deleter": "",
    "deleted_at": null,
    "source_submission_id": "",
    "deleted": false,
    "created_at": "2025-12-31T16:30:00.000Z",
    "updated_at": "2025-12-31T16:30:00.000Z"
  },
  {
    "id": "rp-legacy-32",
    "seq": 32,
    "name": "庄文希",
    "aliases": [],
    "occupation": "斗士",
    "side_job": "",
    "rating": "A",
    "review_mark": "X",
    "atk": "40",
    "def": "30",
    "mres": "20",
    "hp": "380",
    "mp": "15",
    "spd": "70",
    "skills": [
      {
        "name": "星流霆击",
        "condition": "被动",
        "effect": "使用普攻则触发2次，普攻无击溃值。",
        "note": ""
      },
      {
        "name": "降维打击",
        "condition": "被动",
        "effect": "普攻时掷出6(8面色子)则附加蓝上限-2，前3次普攻必触发。",
        "note": ""
      },
      {
        "name": "力挽狂澜",
        "condition": "12回合冷却",
        "effect": "速度100，使用普伤则触发3次，普攻附加15真伤和15%脆弱，8回合。",
        "note": ""
      }
    ],
    "raw_head": "X 庄文希 (斗士) [A]",
    "raw_skills": "1.星流霆击(被动) 使用普攻则触发2次，普攻无击溃值。\n2.降维打击(被动) 普攻时掷出6(8面色子)则附加蓝上限-2，前3次普攻必触发。\n3.力挽狂澜(12回合冷却) 速度100，使用普伤则触发3次，普攻附加15真伤和15%脆弱，8回合。",
    "images": [],
    "reviewer": "回合制游戏工作室",
    "reviewed_at": null,
    "review_note": "",
    "editor": "",
    "edited_at": null,
    "deleter": "",
    "deleted_at": null,
    "source_submission_id": "",
    "deleted": false,
    "created_at": "2025-12-31T16:31:00.000Z",
    "updated_at": "2025-12-31T16:31:00.000Z"
  },
  {
    "id": "rp-legacy-33",
    "seq": 33,
    "name": "张丰宁",
    "aliases": [],
    "occupation": "强攻手",
    "side_job": "召唤师",
    "rating": "B",
    "review_mark": "？",
    "atk": "110",
    "def": "5",
    "mres": "0",
    "hp": "530",
    "mp": "15",
    "spd": "60",
    "skills": [
      {
        "name": "召唤失败",
        "condition": "1蓄力",
        "effect": "召唤一个\"失败\"(45/?/?/320/?)普攻造成？？伤",
        "note": ""
      },
      {
        "name": "召唤成功",
        "condition": "1蓄力",
        "effect": "若场上？？？？时可？？？失败？？？个小肥肥（0/180/？/100/100）？？？则召唤一个？？？（180/0/？/100/100）？？？？？",
        "note": ""
      },
      {
        "name": "本垒打",
        "condition": "1蓝1蓄力",
        "effect": "抛出一个小肥肥，180普伤，附加10%恐慌",
        "note": ""
      },
      {
        "name": "相依？？",
        "condition": "被动",
        "effect": "自己攻击全体召唤物血+？，召唤物攻击5次自己伤？？？？",
        "note": ""
      }
    ],
    "raw_head": "？ 张丰宁 （强攻手/召唤师）[B]",
    "raw_skills": "1.召唤失败(1蓄力) 召唤一个\"失败\"(45/?/?/320/?)普攻造成？？伤\n2.召唤成功(1蓄力)若场上？？？？时可？？？失败？？？个小肥肥（0/180/？/100/100）？？？则召唤一个？？？（180/0/？/100/100）？？？？？\n3.本垒打(1蓝1蓄力)抛出一个小肥肥，180普伤，附加10%恐慌\n4.相依？？(被动)自己攻击全体召唤物血+？，召唤物攻击5次自己伤？？？？",
    "images": [],
    "reviewer": "回合制游戏工作室",
    "reviewed_at": null,
    "review_note": "",
    "editor": "",
    "edited_at": null,
    "deleter": "",
    "deleted_at": null,
    "source_submission_id": "",
    "deleted": false,
    "created_at": "2025-12-31T16:32:00.000Z",
    "updated_at": "2025-12-31T16:32:00.000Z"
  }
];

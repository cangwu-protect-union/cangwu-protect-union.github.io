/* 由 _local/tools/gen-rpg-seed.js 生成，勿手改。
   仅在云数据库不可用时作兜底；正式数据以数据库为准。
   条目拆成多个文件，按顺序加载，各分片只做 push。 */
window.RPG_SEED_CHARACTERS = window.RPG_SEED_CHARACTERS || [];
window.RPG_SEED_CHARACTERS.push(
  {
    "id": "rp-legacy-18",
    "seq": 18,
    "name": "韩东晓",
    "aliases": [],
    "occupation": "粉碎者",
    "side_job": "射手",
    "rating": "S",
    "gender": "男",
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
    "gender": "女",
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
    "gender": "男",
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
        "effect": "防抗变为0，每标准回合血-45，攻+80，造成伤害后掷出6则血回满，持续10标准回合。",
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
    "raw_skills": "1.只因只因爆(3蓝2蓄力) 防抗变为0，每标准回合血-45，攻+80，造成伤害后掷出6则血回满，持续10标准回合。\n2.小学生人大代表(2蓝) 全体敌方单位防抗降至0，每标准回合+10，直至恢复原样。\n3.旋转(1蓝1蓄力) 造成10/20/30/40/50法伤/标准回合，从头依次向后造成，敌方被击溃后打断。敌方在技能期间每标准回合击溃值+1，溢出自动击溃，击溃时技能结束，技能期间敌方无法普攻/蓄力。",
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
    "gender": "女",
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
    "images": [
      "archive/picture/13.jpeg",
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
    "gender": "女",
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
        "effect": "对方开局攻防抗为0，每花1蓝解锁1个，且解锁3标回才能用。",
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
    "raw_skills": "1.卷(1蓝) 血上限-20，造成2次70法伤，血回复造成的伤害，每触发一次扣的血上限和造成的法伤+10，叠3层。\n2.刚长出来(被动) 对方开局攻防抗为0，每花1蓝解锁1个，且解锁3标回才能用。\n3.越共探头(1蓄力) 血上限+60，若对方攻击/击溃则免疫且触发2次“卷”。",
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
    "gender": "男",
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
    "images": [
      "archive/picture/14.jpeg",
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
    "gender": "男",
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
    "gender": "男",
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
    "gender": "男",
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
    "created_at": "2025-12-31T16:25:00.000Z",
    "updated_at": "2025-12-31T16:25:00.000Z"
  }
);

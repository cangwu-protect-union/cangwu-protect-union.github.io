/* 由 _local/tools/gen-rpg-seed.js 生成，勿手改。
   仅在云数据库不可用时作兜底；正式数据以数据库为准。
   条目拆成多个文件，按顺序加载，各分片只做 push。 */
window.RPG_SEED_CHARACTERS = window.RPG_SEED_CHARACTERS || [];
window.RPG_SEED_CHARACTERS.push(
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
    "gender": "男",
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
    "gender": "男",
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
    "gender": "男",
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
    "gender": "女",
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
    "gender": "男",
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
      "archive/picture/10.jpeg",
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
    "gender": "男",
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
    "gender": "男",
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
        "effect": "视为Buff，被动效果x2，免疫异常状态，锁死对方技能，自身无法普攻，不被击溃，蓄力不被打断，受5次伤害取消，取消后防变为0且被动失效1回合。",
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
    "raw_skills": "1.人高马大(被动) 免疫60以下伤害，每受一次伤害免疫上限-5，血+15，直至无。\n2.下潜(1蓄力) 视为Buff，被动效果x2，免疫异常状态，锁死对方技能，自身无法普攻，不被击溃，蓄力不被打断，受5次伤害取消，取消后防变为0且被动失效1回合。\n3.炸弹摔(1蓝3蓄力) 掷出n≤对方击溃值(对方被击溃必中)400真混伤。\n4.硕哥过肩摔(1蓄力) 蓄力期间受伤害/击溃则免疫并立即发动，80物法混伤。",
    "images": [
      "archive/picture/11.jpeg",
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
    "gender": "男",
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
        "name": "扣分!",
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
    "raw_skills": "1.核蔼可氢(2蓝) 不消耗回合，设n=6-使用次数，掷出1-n时35真伤，回复造成伤害，n-1，在下一回合再次发动一次且伤害x2，不可叠加，不可打断。\n2.职业道德(1蓝2蓄力) 对方受200%脆弱，自身攻变为300，后每回合攻-55，持续4回合，期间不造成击溃值。\n3.扣分!(1蓝) 后5次伤害转为50法伤反弹，不造溃值，对方在游戏期间打人/说脏话/大叫/擅自离开则无条件立刻发动。\n4.来自深渊的凝视(被动) 当自己无眩晕/击溃时，对敌方3回合蓝上限-1，当蓝上限<0时每标准回合50强制扣血。自身被击溃后复原并永久-2。",
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
    "created_at": "2025-12-31T16:16:00.000Z",
    "updated_at": "2025-12-31T16:16:00.000Z"
  }
);

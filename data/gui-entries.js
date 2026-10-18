/* ============================================================
   gui-entries.js —— 鬼图鉴的条目数据
   ------------------------------------------------------------
   这是「种子数据」：图鉴页打开时先把这里的条目显示出来。
   以后接上云数据库后，数据库里的条目会追加在后面。

   一个条目的字段：
     id     唯一标识，英文/数字，不要和别的条目重复
     title  条目名（搜索就是按这个字段匹配）
     image  图片地址（可以是图片网址，也可以用 genPlaceholder 生成的占位图）
     intro  正文开头，显示在列表卡片里（一两句话）
     body   详情页的正文，用 \n 分段
     tags   标签数组，显示成小胶囊
     date   日期，格式 YYYY-MM-DD
   ============================================================ */

/* ------------------------------------------------------------
   占位图生成器：画一个带字的彩色方块，作为条目图片的占位。
   换成真图的方法：把 image 字段改成图片网址，例如
     image: "images/gu-gushan.jpg"
   （图片文件放在项目里的 images 文件夹，然后一起提交）
   ------------------------------------------------------------ */
window.guiPlaceholder = function (glyph, bg, fg) {
  var svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320">' +
    '<rect width="320" height="320" fill="' + bg + '"/>' +
    '<text x="50%" y="53%" text-anchor="middle" dominant-baseline="middle" ' +
    'font-family="serif" font-size="140" fill="' + fg + '" opacity="0.92">' + glyph + '</text>' +
    '</svg>';
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
};
window.GUI_SEED_ENTRIES = [

  {
    id: "gu-gushan",
    title: "鬼固山异变",
    image: window.guiPlaceholder("鬼", "#2f4858", "#8ecae6"),
    intro: "2026 年 7 月于鬼固山发生的大规模异常现象。山体内部出现异次元裂隙，初步探明连接至「康海省」。",
    body: "2026 年 7 月，鬼固山一带连续出现不明强磁场扰动，附近电子设备频繁失效。\n" +
          "CPU 派出先遣队进入山区，在海拔约 900 米处发现一处持续扩张的空间裂隙。裂隙内部呈现出与外界完全不同的天象与地貌，经初步勘探，将其命名为「康海省」。\n" +
          "当前裂隙已被封锁，常驻观测点持续记录。任何未经许可的靠近均视为严重违规。",
    tags: ["异次元", "已镇压", "S 级"],
    date: "2026-07-18"
  },

  {
    id: "gu-qidong-expedition",
    title: "远征启东行动",
    image: window.guiPlaceholder("征", "#3d5a80", "#ee6c4d"),
    intro: "2026 年 9 月在苏中一带进行的为期一周的区域扫荡行动，主要目的是排查未探索区域内的鬼活动痕迹。",
    body: "行动自 9 月中旬开始，历时一周，覆盖苏中沿海数个未探索区域。\n" +
          "本次行动以侦察为主，未发生正面对抗。共标记可疑据点 4 处，回收异常样本 11 件，目前均已移交 ICU 进行分类整理。\n" +
          "行动期间得到当地情报提供者的配合，为后续的区域建档提供了基础数据。",
    tags: ["远征", "侦察", "已归档"],
    date: "2026-09-12"
  },

  {
    id: "gu-mixue",
    title: "苍梧西门哨站",
    image: window.guiPlaceholder("哨", "#6d597a", "#e0aaff"),
    intro: "CPU 远征行动指定前哨站。日常以普通饮品店形式对外运营，实际承担成员接应与物资中转职能。",
    body: "位于苍梧西门的一处常设前哨站，对外身份为普通饮品店。\n" +
          "该哨站承担三项职能：一是远征行动的集合与接应，二是驱鬼补给物资的中转，三是可疑情报的初步筛查。\n" +
          "哨站不设置任何书面记录，所有交接均依靠口述与暗号完成。",
    tags: ["据点", "前哨站", "对外公开"],
    date: "2026-08-02"
  },

  {
    id: "gu-lingyi-dengji",
    title: "灵异现象等级划分",
    image: window.guiPlaceholder("级", "#1b4332", "#95d5b2"),
    intro: "CPU 对观测到的灵异现象所采用的分级标准，用于判断响应级别与所需出动规模。",
    body: "A 级：已确认存在实体，且对人类构成直接威胁，需立即出动镇压。\n" +
          "B 级：存在间歇性实体显现，威胁可控，需常驻观测并准备干预。\n" +
          "C 级：仅观测到异常现象，未见实体，记录归档即可。\n" +
          "D 级：无法排除误报，需二次核实后再行定级。",
    tags: ["规范", "内部资料"],
    date: "2026-06-30"
  },

  {
    id: "gu-gui-zhaji",
    title: "鬼札记 · 残页",
    image: window.guiPlaceholder("札", "#3a0ca3", "#f72585"),
    intro: "在不同地点陆续发现的残破手札，纸张与墨迹年代不符，内容以晦涩的记述为主，疑似同源。",
    body: "已回收残页共 7 张，分散于 4 个不同省份。\n" +
          "纸张材质接近明代竹纸，但墨迹经检测含有人工合成成分，年代明显晚于纸张本身。\n" +
          "残页内容多为不明地点的描述与一种重复出现的符号。该符号已列入重点比对对象，ICU 正在编纂对照表。",
    tags: ["遗物", "待考证", "ICU 编纂中"],
    date: "2026-10-05"
  },

  {
    id: "gu-kanghai",
    title: "康海省",
    image: window.guiPlaceholder("康", "#22223b", "#9a8c98"),
    intro: "鬼固山裂隙内部的异次元空间，地理结构稳定但天象与外界完全不同，目前仅完成外围勘测。",
    body: "首次进入记录于 2026 年 7 月，与「鬼固山异变」为同一次事件。\n" +
          "空间内部呈盆地地形，四周山体环绕，中央有大型水域。空气成分与外界接近，但昼夜周期约为外界的 1.7 倍。\n" +
          "已建立进入许可制度：仅限持有 CPU 签发的通行记录者进入，且必须两人以上同行。",
    tags: ["异次元", "勘测中", "限入"],
    date: "2026-07-25"
  }

];

/* 取条目图片：有 image 就用，没有就按标题首字生成占位图。
   这样 entries.json 里不用存超长的 data URI。 */
window.guiImageFor = function (entry) {
  if (entry && entry.image) return entry.image;
  var title = (entry && entry.title) || "？";
  var palette = [
    ["#2f4858", "#8ecae6"], ["#3d5a80", "#ee6c4d"], ["#6d597a", "#e0aaff"],
    ["#1b4332", "#95d5b2"], ["#3a0ca3", "#f72585"], ["#22223b", "#9a8c98"]
  ];
  /* 用标题算个稳定下标，保证同一条目每次颜色一样 */
  var sum = 0;
  for (var i = 0; i < title.length; i++) sum += title.charCodeAt(i);
  var c = palette[sum % palette.length];
  return window.guiPlaceholder(title.charAt(0), c[0], c[1]);
};
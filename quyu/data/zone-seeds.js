/* ============================================================
   zone-seeds.js —— 异常区域档案的种子数据
   ------------------------------------------------------------
   云端不可用（未配置 / 请求失败 / 5 分钟冷却中）时，列表、地图、
   详情页都退回用这里的条目，页面不会白屏。

   正常运行时（云端读得到数据）这些种子不参与合并，数据库才是唯一数据源。
   新增示例内容请写进数据库，别指望它出现在正常页面上。

   字段（与 js/zone-data.js 的 ZONE_FIELDS 对应）：
     id       uuid 字符串，界面不显示
     title    区域名
     lng/lat  坐标，WGS-84
     related  关联条目，元素形如 "ghost:gu-gushan" / "zone:<uuid>"
     refs     引用的情报，[{ id, title }]
     intro    列表卡片摘要
     body     正文，用 \n 分段
     tags     标签，每个不超过 8 字
     date     记录日期 YYYY-MM-DD
   ============================================================ */

window.zonePlaceholder = function (glyph, bg, fg) {
  var svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320">' +
    '<rect width="320" height="320" fill="' + bg + '"/>' +
    '<text x="50%" y="53%" text-anchor="middle" dominant-baseline="middle" ' +
    'font-family="serif" font-size="140" fill="' + fg + '" opacity="0.92">' + glyph + '</text>' +
    '</svg>';
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
};

window.ZONE_SEED_ZONES = [

  {
    id: "0b8f6f1e-3c5a-4d9e-9b1a-2f4c6d8e0a11",
    title: "苍梧西门旧糖厂",
    lng: 120.583,
    lat: 31.313,
    related: ["ghost:gu-mixue"],
    refs: [],
    image: window.zonePlaceholder("糖", "#3d5a80", "#ee6c4d"),
    intro: "停产的旧糖厂，废弃后连续出现夜间人影与设备自启动，已整片封锁并由前哨站代管。",
    body: "糖厂 2019 年停产后一直无人看管，2026 年 3 月起周边居民报告夜里有规律的人影在厂房之间移动。\n" +
          "第一批进入的侦察队携带的照明设备在厂区中段全部失效，回收的录像里出现无法对应实体的人形轮廓，共四处。\n" +
          "目前整片厂区已封锁，出入口由苍梧西门哨站代管，进出需登记。厂区内不再安排单独值守。",
    tags: ["封锁区", "城市异常", "有影像记录"],
    date: "2026-03-14"
  },

  {
    id: "7d2a5c94-1e8b-4f3a-b6d0-9c3e5a7f1b22",
    title: "鬼固山裂隙 · 外围警戒区",
    lng: 118.94,
    lat: 28.86,
    related: [
      "ghost:gu-gushan",
      "ghost:gu-kanghai",
      "zone:0b8f6f1e-3c5a-4d9e-9b1a-2f4c6d8e0a11"
    ],
    refs: [],
    image: window.zonePlaceholder("裂", "#2f4858", "#8ecae6"),
    intro: "鬼固山裂隙外围的常驻观测区，磁场扰动与设备失效在此反复出现。",
    body: "自 2026 年 7 月裂隙出现后，山体北坡一带被划为警戒区，半径约 1.5 公里。\n" +
          "区域内磁场扰动呈周期性增强，电子设备平均工作时长不足 20 分钟；越靠近裂隙，昼夜感与外界偏差越明显。\n" +
          "常驻观测点设在警戒区边缘，每班两人，只做记录不做接触。任何进入裂隙内部的行为都需要单独许可。",
    tags: ["常驻观测", "异次元", "限入"],
    date: "2026-07-20"
  }

];

window.zoneImagesFor = function (zone) {
  if (!zone) return [];
  var out = [];
  if (Array.isArray(zone.images)) {
    out = zone.images.filter(function (u) { return u && String(u).trim() !== ""; });
  }
  if (!out.length && zone.image) out = [zone.image];
  return out;
};

window.zoneThumbsFor = function (zone) {
  var imgs = window.zoneImagesFor(zone);
  var th = (zone && Array.isArray(zone.thumbs)) ? zone.thumbs : [];
  return imgs.map(function (u, i) {
    var t = th[i];
    return (t && String(t).trim() !== "") ? t : u;
  });
};

window.zoneThumbFor = function (zone) {
  var all = window.zoneThumbsFor(zone);
  if (all.length) return all[0];
  return window.zoneImageFor(zone);
};

window.zoneImageFor = function (zone) {
  var all = window.zoneImagesFor(zone);
  if (all.length) return all[0];
  var title = (zone && zone.title) || "？";
  var palette = [
    ["#2f4858", "#8ecae6"], ["#3d5a80", "#ee6c4d"], ["#6d597a", "#e0aaff"],
    ["#1b4332", "#95d5b2"], ["#3a0ca3", "#f72585"], ["#22223b", "#9a8c98"]
  ];
  var sum = 0;
  for (var i = 0; i < title.length; i++) sum += title.charCodeAt(i);
  var c = palette[sum % palette.length];
  return window.zonePlaceholder(title.charAt(0), c[0], c[1]);
};

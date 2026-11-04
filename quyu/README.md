# quyu —— 异常区域档案模块

记录鬼频繁出没的异常区域。**自成一块**：页面、脚本、数据、样式都在这个目录里，
与 `guitu/` 并列，不改鬼图鉴的任何数据表；只在鬼详情页加了一块「出没区域」反查。

---

## 页面（13 个）

### 公开访问（不需要验证）

| 文件 | 作用 |
|---|---|
| `quyu.html` | 列表，关键词 + 地区筛选，分页 |
| `map.html` | 全屏地图 + 左侧列表联动 |
| `zone.html?id=…` | 区域详情：信息表、位置缩略图、正文、常见鬼、关联区域、相关情报 |
| `provide-tip.html` | 提交区域情报，开放投稿 |
| `tips.html` | 投稿列表 |
| `tips-entry.html?id=…` | 投稿详情 |

### 编辑区（需要组织验证）

| 文件 | 作用 |
|---|---|
| `edit-zones.html` | 编辑列表，进入编辑区的入口 |
| `add-zone.html` | 增加区域，可引用投稿 |
| `edit-zone.html?id=…` | 编辑器：改字段、改图、软删除、恢复 |
| `pick-tips.html` | 勾选要引用的投稿 |
| `old-zones.html` | 旧档案：所有历史版本 |
| `old-zone.html?id=…` | 某个区域的全部历史版本 |
| `version.html?v=…` | 查看单个版本，可应用回去 |

---

## 脚本

```
js/
├── zone-data.js     数据层：所有数据库读写的唯一出口（由 gui-data.js 改写）
├── gui-gate.js      组织验证（直接从鬼图鉴复制，未改动）
├── zone-upload.js   图片压缩 / 缩略图 / HEIC 转码 / 上传（由 gui-upload.js 改写）
├── zone-form.js     区域表单：新增 / 编辑 / 投稿三处共用
├── zone-map.js      地图基础设施：底图、坐标换算、瓦片失败降级
│
├── zones.js         列表页
├── map-page.js      地图页
├── zone.js          区域详情
├── provide-tip.js   投稿
├── tips.js          投稿列表
├── tips-entry.js    投稿详情
├── edit-zones.js    编辑列表
├── add-zone.js      增加区域
├── edit-zone.js     编辑区域
├── pick-tips.js     引用投稿
├── old-zones.js     旧档案
├── old-zone.js      区域历史
└── version.js       查看 / 应用版本
```

依赖方向：页面脚本 → `zone-data` / `zone-form` / `zone-map` / `zone-upload` / `gui-gate`。
基础模块之间不互相依赖。

**与鬼图鉴共用**：`gui-gate.js`、令牌校验函数 `public.gui_token_ok()`、题库答案
（`gui_secrets` 表）、云存储桶 `gui-images`。没有第二套密码，也没有第二份答案。

---

## 数据

```
data/
├── config.js        云数据库配置 + 地图配置（底图服务商、天地图 key）
├── zone-seeds.js    2 条示例区域 + 占位图生成器
└── zones.json       静态兜底（云端不可用时用）
```

数据库表（详见 `_local/sql/zone-setup.sql`）：

| 表 | 内容 |
|---|---|
| `gui_zones` | 区域本体，软删除（`deleted`），坐标存 WGS-84 |
| `gui_zone_versions` | 每次编辑/删除前的快照，只增不删 |
| `gui_zone_tips` | 访客投稿，`adopted` 标记是否已转正 |

**数据源原则与鬼图鉴一致**：云端读成功就只用数据库；云端不可用才合并
`zone-seeds.js` 与 `zones.json` 兜底。

### 字段的单一来源

字段名、类型、枚举只在 `js/zone-data.js` 的 `ZONE_FIELDS` / `TERRAIN` / `LEVELS` /
`STATUSES` 里定义一次。表单、校验、筛选、图例都从这里取。加字段改这一处。

---

## 地图

| 项 | 说明 |
|---|---|
| 底图库 | Leaflet 1.9.4，`vendor/leaflet/`，**不从 CDN 加载** |
| 底图源 | 默认高德过渡瓦片；填好天地图 key 后切官方 WMTS |
| 坐标 | 数据库统一存 WGS-84；渲染高德底图时自动转 GCJ-02（`zone-map.js`） |
| 降级 | 瓦片连续失败 6 次 → 纯色底 + 网格，标记照常显示 |

### 切到天地图

1. 在天地图开放平台申请 key（浏览器端），必要时把站点域名加进白名单。
2. 改 `data/config.js`：

```js
window.ZONE_MAP = {
  provider: "tianditu",
  tiandituKey: "你的 key",
  ...
};
```

代码不用动：`zone-map.js` 会自己叠加 `vec_w`（底图）与 `cva_w`（注记）两层。

---

## 与鬼图鉴的双向关联

区域表存 `ghost_ids` 数组，鬼详情页用 PostgREST 的数组包含语法反查，
**鬼表一列都没加**：

```
gui_zones?select=id,title,region,level,status&ghost_ids=cs.{gu-gushan}&deleted=eq.false
```

鬼详情页 `guitu/条目.html` 因此多引了两个脚本（`../quyu/data/zone-seeds.js` 与
`../quyu/js/zone-data.js`），查询逻辑只有一份。

---

## 上线前要做的事

1. 在 CloudBase 控制台执行 `_local/sql/zone-setup.sql`（建三张表 + RLS 策略）。
2. 执行 `_local/sql/zone-seed-data.sql` 导入 2 条试验区域，否则公开列表是空的
   —— 数据库是唯一数据源，`data/zone-seeds.js` 只在云端连不上时兜底。
3. 用编辑区录入正式区域，再把 2 条试验数据删掉。
4. 申请天地图 key 并按上面的步骤切换底图。
5. 跑校验：`powershell -NoProfile -ExecutionPolicy Bypass -File tools\check.ps1`

## 一个容易踩的点：表名不在共享配置里

`zone-data.js` 从 `window.ZONE_APP.table` 取表名，不从 `GUI_CLOUDBASE.table` 取。
因为鬼详情页加载的是 `guitu/data/config.js`，那份配置里的 `table` 是 `gui_entries`；
表名跟着共享配置走，反查会打到鬼表上（实测 400，然后静默退回种子数据）。

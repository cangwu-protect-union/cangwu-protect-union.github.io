# quyu —— 异常区域档案模块

记录鬼频繁出没的异常区域。**自成一块**：页面、脚本、数据、样式都在这个目录里，
与 `guitu/` 并列。与鬼图鉴的关系是「条目互相关联」，两边都能发起，存在各自的条目上。

---

## 页面（15 个）

### 公开访问（不需要验证）

| 文件 | 作用 |
|---|---|
| `quyu.html` | 列表，一个搜索框同时匹配标题、摘要、正文、标签 |
| `map.html` | 地图 + 左侧列表联动；支持 `?id=` 定位到某个区域 |
| `zone.html?id=…` | 区域详情：位置缩略图、正文、标签、关联条目、引用情报 |
| `provide-tip.html` | 提交区域情报，开放投稿 |
| `tips.html` | 投稿列表 |
| `tips-entry.html?id=…` | 投稿详情 |

### 编辑流程内（写库前需要组织验证）

| 文件 | 作用 |
|---|---|
| `edit-zones.html` | 编辑列表，进入编辑区的入口 |
| `add-zone.html` | 增加区域 |
| `edit-zone.html?id=…` | 编辑器：改字段、改图、改关联、软删除、恢复 |
| `pick-location.html` | 标点：在地图上点一下选位置 |
| `pick-relation.html` | 引用条目选择器（鬼 / 区域两个页签，与鬼图鉴共用） |
| `pick-tips.html` | 勾选要引用的投稿 |
| `old-zones.html` | 旧档案：所有历史版本 |
| `old-zone.html?id=…` | 某个区域的全部历史版本 |
| `version.html?v=…` | 查看单个版本，可应用回去 |

`pick-location.html`、`pick-relation.html` 不加载 `gui-gate.js`，只从编辑页打开，
本身不做组织验证；其余 7 页进页面前要答验证题。

---

## 脚本

```
js/
├── zone-data.js      数据层：所有数据库读写的唯一出口（由 gui-data.js 改写）
├── relation-utils.js 关联条目：编码、双向查询、删反向关联（含归档对方版本）
├── relation-box.js   「关联条目」框（鬼与区域的编辑页共用）
├── refs-list.js      「引用情报」折叠列表（鬼与区域共用）
├── location-picker.js 表单 ↔ 标点页的坐标传递
├── zone-form.js      区域表单：字段、位置框、图片上传
├── zone-editor.js    编辑器：表单 + 关联 + 引用三块拼在一起，含草稿恢复
├── zone-map.js       地图基础设施：底图、坐标换算、瓦片失败降级
├── gui-gate.js       组织验证（直接从鬼图鉴复制，未改动）
├── zone-upload.js    图片压缩 / 缩略图 / HEIC 转码 / 上传（由 gui-upload.js 改写）
│
├── zones.js          列表页
├── map-page.js       地图页
├── zone.js           区域详情
├── pick-location.js  标点页
├── pick-relation.js  引用条目选择页
├── provide-tip.js    投稿
├── tips.js           投稿列表
├── tips-entry.js     投稿详情
├── edit-zones.js     编辑列表
├── add-zone.js       增加区域
├── edit-zone.js      编辑区域
├── pick-tips.js      引用投稿
├── old-zones.js      旧档案
├── old-zone.js       区域历史
└── version.js        查看 / 应用版本
```

**与鬼图鉴共用**：`gui-gate.js`、令牌校验函数 `public.gui_token_ok()`、题库答案
（`gui_secrets` 表）、云存储桶 `gui-images`，以及 `relation-utils` / `relation-box` /
`refs-list` 三个组件。没有第二套密码，也没有第二份答案。

---

## 数据

```
data/
├── config.js        云数据库配置 + 地图配置（底图服务商、天地图 key）
├── zone-seeds.js    2 条示例区域 + 占位图生成器
└── zones.json       静态兜底（云端不可用时用）
```

| 表 | 内容 |
|---|---|
| `gui_zones` | 区域本体，主键 uuid（界面不显示），软删除 |
| `gui_zone_versions` | 每次编辑/删除前的快照，只增不删 |
| `gui_zone_tips` | 访客投稿，`adopted` 标记是否已转正 |

**数据源原则与鬼图鉴一致**：云端读成功就只用数据库；云端不可用才合并
`zone-seeds.js` 与 `zones.json` 兜底。

### 字段

`title`、`lng`/`lat`（WGS-84，表单必填）、`image/images/thumbs`、`body`、`intro`、
`tags`（每个标签 ≤ 8 字）、`date`、`related`、`refs`。

字段名与类型只在 `js/zone-data.js` 的 `ZONE_FIELDS` 里定义一次。

### 关联条目

`related` 是字符串数组，元素形如 `ghost:gu-gushan` / `zone:<uuid>`。
**单向存储、双向显示**：A 引用 B 只写进 A 的 `related`，B 的页面上通过
`related=cs.{zone:<B>}` 反查出来。

改关联等于编辑条目，所以删除反向关联时，会先把对方归档成旧版本再改它的
`related`（见 `relation-utils.js` 的 `removeFrom`）。

---

## 地图

| 项 | 说明 |
|---|---|
| 底图库 | Leaflet 1.9.4，`vendor/leaflet/`，**不从 CDN 加载** |
| 底图源 | 默认高德过渡瓦片；填好天地图 key 后切官方 WMTS |
| 坐标 | 数据库统一存 WGS-84；渲染高德底图时转 GCJ-02，标点页再从 GCJ-02 反算回 WGS-84 |
| 降级 | 瓦片连续失败 6 次 → 纯色底 + 网格，标记照常显示 |

### 底图现状

**已经是天地图官方 WMTS**（`provider: "tianditu"`，key 在 `data/config.js`）。

这个 key 是「浏览器端」类型，只能从浏览器发起请求，而且绑了域名白名单：
`curl` 或 `localhost` 打开本地页面都会 403（前者报「Key权限类型为:浏览器端」，
后者被白名单挡掉，浏览器端表现为 `net::ERR_BLOCKED_BY_ORB`）。本地验证时
给浏览器加一个部署域名的 Referer 就能测通。

key 会出现在前端源码里，与 `publishableKey` 同类；防护靠白名单，不要换成「服务端」类型的 key。

### 切回高德过渡底图

把 `provider` 改成 `"amap"`，`tiandituKey` 留不留都行。高德端点没有服务承诺，只作应急。

---

## 一个容易踩的点：表名不在共享配置里

`zone-data.js` 从 `window.ZONE_APP.table` 取表名，不从 `GUI_CLOUDBASE.table` 取。
因为鬼详情页加载的是 `guitu/data/config.js`，那份配置里的 `table` 是 `gui_entries`；
表名跟着共享配置走，反查会打到鬼表上（实测 400）。

---

## 上线前要做的事

1. 在 CloudBase 控制台执行 `_local/sql/zone-setup.sql`（建表）。
2. 执行 `_local/sql/zone-round2.sql`（第二轮：删字段、主键改 uuid、加 `related`/`refs`）。
3. 执行 `_local/sql/zone-seed-data.sql` 导入 2 条试验区域，否则公开列表是空的。
4. 用编辑区录入正式区域，再把试验数据删掉。
5. 申请天地图 key 并按上面的步骤切换底图。
6. 跑校验：`powershell -NoProfile -ExecutionPolicy Bypass -File tools\check.ps1`

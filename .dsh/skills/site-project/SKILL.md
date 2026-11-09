---
name: site-project
description: 维护 D:\CPU\关于CPU的网页 的约定：目录与模块、编码、数据源与兜底、组织验证、上传、地图坐标、跨模块引用、文档生成与校验。主站、guitu、quyu 以及以后新增的模块共用这一份，读或改任何文件前加载。
---

# 本站约定（所有模块共用）

项目根 `D:\CPU\关于CPU的网页` 就是工作区根，用 `write` / `edit` 直接读写，不需要提权。

```
index.html about.html projects.html   主站
suggest.html suggest-review.html      建议入口
js/                                   主站脚本（suggest*.js）
css/style.css                         全站样式
guitu/                                鬼图鉴
quyu/                                 异常区域档案
_local/                               不推送：sql/ docs/ notes/ preview/ tests/ pw/ tools/
```

**新增模块不写新 skill**：在 `_local/tools/docgen.config.js` 里加一条配置，跑一次生成脚本，文档就有了。下面「新增模块」一节是完整流程。

## 写文件

单点改动用 `edit`。批量替换：

```powershell
$enc = New-Object System.Text.UTF8Encoding($false)
$t = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8).Replace($old, $new)
[System.IO.File]::WriteAllText($p, $t, $enc)
```

| 陷阱 | 做法 |
|---|---|
| here-string 结束符不在行首 → 整段被吞、替换静默失败 | `'@` 独占一行 |
| `.Replace()` 报「参数计数为 3」 | 只传两个纯字符串 |
| `Set-Content -NoNewline` 吞换行 | 用 `WriteAllText` |
| 多行文本靠猜空白改 | 先 `IndexOf` 定位，再花括号配对 |

一次改三个以上文件，先备份或用 `git checkout HEAD -- <路径>` 兜底。

## 编码

UTF-8 无 BOM，LF。项目含大量中文，编码一变全站乱码；`.gitattributes` 与 `.vscode/settings.json` 已强制。

## 跨模块共用与复制（最容易踩）

| 东西 | 状态 | 改的时候 |
|---|---|---|
| `gui-gate.js` | guitu 与 quyu **各一份副本** | 两边都改；题库答案只在数据库 `gui_secrets` |
| `relation-utils.js` / `relation-box.js` / `refs-list.js` | 只有 quyu 一份，guitu 的 3 个页面直接加载 | 改它会同时影响鬼图鉴 |
| `heic2any.min.js` | 只有 `guitu/js/lib/` 一份，quyu 与主站动态加载 | 别复制第二份 |
| `guitu/data/config.js` | 主站的建议页直接读 | 改配置会同时影响主站 |
| `gui-upload.js` / `zone-upload.js` | 两份，逻辑同源 | 改上传要两边对照 |
| 页头导航 | 每个 HTML 各一份，逐页复制 | 改导航要碰所有页面 |

`架构.md` 第五节把「谁直接加载了对方的文件」按页面列全，改跨模块文件前先看那一节。

## 数据与权限

| 事项 | 规则 |
|---|---|
| 数据源 | 数据库是唯一来源；`gui-entries.js` / `zone-seeds.js` / `*.json` 只在云端失败时兜底 |
| 兜底合并 | 只在 `list()` 的 fallback 分支合并；云端成功又合并种子会出现重复条目 |
| 表名 | guitu 用 `GUI_CLOUDBASE.table`，quyu 用 `ZONE_APP.table`；混用会打到对方的表（实测 400） |
| 字段定义 | `gui-data.js` 的 `ENTRY_FIELDS`、`zone-data.js` 的 `ZONE_FIELDS` 各定义一次 |
| 令牌 | 两边共用 `public.gui_token_ok()` 与 `gui-images` 桶 |
| 关联条目 | `related` 单向存储、双向显示；删反向关联前先把对方归档成版本 |
| 坐标 | 库里存 WGS-84；渲染高德底图转 GCJ-02，标点页再反算回来 |

密钥：`publishableKey` 可公开，service_role 绝不能进前端。`_local/` 永不推送。

天地图 key 是浏览器端类型且绑部署域名白名单：`curl` 与 `localhost` 打开都会 403（浏览器表现为 `net::ERR_BLOCKED_BY_ORB`）。本地验证用 `127.0.0.1` 并加部署域名的 Referer，不要换成服务端类型 key。

## 文档生成

```
node _local/tools/build-docs.js          # 生成 md + 渲染 PNG + 预览索引
node _local/tools/build-docs.js --check  # 只比对，不写盘（check.ps1 会调）
```

- `docgen.js` 是引擎：扫页面、脚本、数据，推导依赖、反向依赖、跨模块引用。
- `docgen.config.js` 是唯一的人工入口：模块、访问级别、角色名、后端节点、访客流程图。
- 生成物：每个模块（含主站）的 `架构.md` 与 `访客流程图.md`；有 `preview/` 的模块再出 PNG。
- 别手改 `AUTO-GENERATED` 区间；区间外的手写说明保留。

## 新增模块

1. 建目录：页面放 `<模块>/*.html`，脚本放 `<模块>/js/`，数据放 `<模块>/data/`（可省）。
2. `docgen.config.js` 加一条：
   - `id`：目录名（主站是空串）
   - `access`：每页 `public` / `gate` / `editor`
   - `roles`：图上显示的中文名，不给就用文件名
   - `backend`：后端节点与连线
   - `flow`：访客流程图的节点与边
3. 跑 `node _local/tools/build-docs.js`，第一次会生成两份 md 的骨架，再手工补「怎么读」。
4. 跑 `powershell -File tools\check.ps1`：目录里出现未登记的模块会直接报错。
5. 在 `改动索引.md` 与根 `README.md` 的目录树里登记。

## 新增页面

1. 抄同类页，配自己的页面脚本。
2. 在 `docgen.config.js` 的 `access`、`roles`、`flow.nodes` 里登记（三处都填，漏了 `--check` 会失败）。
3. 跑 `check.ps1`，必要时跑 `node _local/tests/run-all.mjs --group=导航`。

## 新模块不要写新 skill

模块特有的坑写进 `<模块>/README.md`，模块的结构写进 `<模块>/架构.md`；本 skill 只放跨模块的约定。
`docgen.config.js` 的 `scriptNote` / `tableNote` / `crossNote` / `readTable` 可以随配置写模块特有说明，生成进架构图，不用额外文件。

## 改完必跑

```
powershell -NoProfile -ExecutionPolicy Bypass -File tools\check.ps1
```

覆盖编码、JS 语法、HTML 引用、密钥、git 卫生，以及六份文档是否与源码一致。
动了数据层或导航，再跑 `node _local/tests/run-all.mjs --group=数据源` 或 `--group=导航`（都不需要令牌）。

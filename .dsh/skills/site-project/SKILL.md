---
name: site-project
description: 维护 D:\CPU\关于CPU的网页 的约定：目录与模块、编码、数据源与兜底、组织验证、上传、地图坐标、跨模块引用、文档生成与校验。主站、guitu、quyu 以及以后新增的模块共用这一份，读或改任何文件前加载。
---

# 本站约定（所有模块共用）

项目根 `D:\CPU\关于CPU的网页` 就是工作区根，用 `write` / `edit` 直接读写，不需要提权。

```
index.html about.html projects.html   主站（不加载脚本）
css/style.css + style-2/3.css          全站样式（按顺序加载）
suggest/ guitu/ quyu/                  三个模块
_local/                                不推送：sql/ docs/ notes/ preview/ tests/ pw/ tools/
```

**新增模块不写新 skill**：在 `_local/tools/docgen.config.js` 里加一条配置，跑一次生成脚本即可（流程见「新增模块」）。

## 写文件与编码

单点改动用 `edit`；一次改三个以上文件，先备份或用 `git checkout HEAD -- <路径>` 兜底。
批量替换与本机 PowerShell 5.1 的坑（here-string、`.Replace()` 参数、CRLF、没有 `utf8NoBOM`、没有 `-SkipCertificateCheck`）见 [powershell-坑.md](powershell-坑.md)。

编码：UTF-8 无 BOM，LF。项目含大量中文，编码一变全站乱码；`.gitattributes` 与 `.vscode/settings.json` 已强制。

## 提交前

`git add -A` 会把工作区**所有**改动一次带走（含用户自己没提交的半成品、误建临时文件）。
每次提交前先 `git status --short` 逐行看：不属于本次任务的改动要么先单独提交并说明，要么写进提交信息。
`_local/` 已被忽略，但 `*.docx`、`*.sql`、编辑器锁文件仍要看一眼。

## 跨模块共用与复制（最容易踩）

| 东西 | 状态 | 改的时候 |
|---|---|---|
| `gui-gate.js` | guitu 与 quyu **各一份副本**；`suggest/` 直接加载 guitu 那份，不复制 | 改 gui-gate 要同时看 guitu、quyu；suggest 自动跟随 guitu |
| `relation-utils.js` / `relation-box.js` / `refs-list.js` | 只有 quyu 一份，guitu 的 3 个页面直接加载 | 改它会同时影响鬼图鉴 |
| `heic2any.min.js` | 只有 `guitu/js/lib/` 一份，quyu 与主站动态加载 | 别复制第二份 |
| `guitu/data/config.js` | `suggest/` 两个页面直接读；quyu 有自己的 `quyu/data/config.js` | 改配置会同时影响建议模块 |
| `gui-upload.js` / `zone-upload.js` | 两份，逻辑同源 | 改上传要两边对照 |
| 页头导航 | 每个 HTML 各一份，逐页复制 | 改导航要碰所有页面 |

`架构.md` 第五节把「谁直接加载了对方的文件」按页面列全，改跨模块文件前先看那一节。

## 数据与权限

| 事项 | 规则 |
|---|---|
| 数据源 | 数据库是唯一来源；`gui-entries.js` / `zone-seeds.js` / `*.json` 只在云端失败时兜底 |
| 兜底合并 | 只在 `list()` 的 fallback 分支合并；云端成功又合并种子会出现重复条目 |
| 表名 | guitu 用 `GUI_CLOUDBASE.table`，quyu 用 `ZONE_APP.table`；混用会打到对方的表（实测 400） |
| 站点建议的表名 | `suggest/js/suggest-data.js` 里写死 `site_suggestions`，**不读** `config.table`（那是图鉴的表） |
| 字段定义 | `gui-data.js` 的 `ENTRY_FIELDS`、`zone-data.js` 的 `ZONE_FIELDS` 各定义一次 |
| 令牌 | guitu、quyu、suggest 共用 `public.gui_token_ok()` 与 `gui-images` 桶 |
| 关联条目 | `related` 单向存储、双向显示；删反向关联前先把对方归档成版本 |
| 坐标 | 库里存 WGS-84；渲染高德底图转 GCJ-02，标点页再反算回来 |

密钥：`publishableKey` 可公开，service_role 绝不能进前端。`_local/` 永不推送。
浏览器端 key（天地图 tk）按**行**在 `.gitleaks.toml` 放行，不要放行整个文件。取令牌与天地图白名单的细节见 [powershell-坑.md](powershell-坑.md)。

## 读文件的成本

`read` 是历史上最贵的工具：全项目 1795 次、结果 17MB，占上下文构成的大头，而且是**每一步都重发**。

- 不整读 >15KB 的文件：先 `grep` 定位键名/函数名，再 `read` 带 `offset/limit`，只读要改的那一段。
- `edit` 之后不要重读整文件：结果里已经回显了改动片段。
- 定位顺序：`改动索引.md` → 模块的 `架构.md` → `grep` → 片段 `read`。
- 实测被同一会话重复整读最多的文件（数字是重复次数）：`quyu/js/zone-data.js` 29、`rpg6.0/js/engine/effect-ops.js` 21、`rpg6.0/js/battle/battle-page.js` 13、`rpg6.0/css/battle.css` 12、`_local/tools/build-docs.js` 11、`rpg6.0/data/battle-skills.js` 8、`rpg6.0/js/battle/battle-view.js` 8、`guitu/js/gui-data.js` 8。
- 数据表类文件（`gui-data.js`、`zone-data.js`、`battle-skills.js`）先 `grep` `ENTRY_FIELDS`/`ZONE_FIELDS`/技能 id 再读片段。

## 文档生成

```
node _local/tools/build-docs.js          # 生成 md + 渲染 PNG + 预览索引
node _local/tools/build-docs.js --check  # 只比对，不写盘（check.ps1 会调）
```

- `docgen.config.js` 是唯一人工入口；生成物：每个模块（含主站）的 `架构.md` 与 `访客流程图.md`，有 `preview/` 的再出 PNG。
- 别手改 `AUTO-GENERATED` 区间；区间外的手写说明保留。
- 渲染 mermaid 用本地 `_local/tools/vendor/mermaid.min.js`，别改回 unpkg/CDN（本机连不上 unpkg，会卡几分钟再整批失败）。

## 新增模块

1. 建目录：页面 `<模块>/*.html`、脚本 `<模块>/js/`、数据 `<模块>/data/`（可省）；现成例子 `suggest/`。
2. `docgen.config.js` 加一条：`id`（主站空串）、`access`（public/gate/editor）、`roles`、`backend`（没有写 `nodes: []`）、`flow`（`lock: []` 不画虚线框）。
3. 跑 `build-docs.js` 生成两份 md 骨架，手工补「怎么读」。
4. 跑 `tools\check.ps1`：未登记的模块直接报错。
5. `改动索引.md` 与根 `README.md` 目录树登记；导航用例按 `a[href]` 写死的入口要跟着改。

## 新增页面

1. 抄同类页，配自己的页面脚本。
2. `docgen.config.js` 的 `access`、`roles`、`flow.nodes` 三处都登记，漏了 `--check` 失败。
3. 跑 `check.ps1`，必要时 `node _local/tests/run-all.mjs --group=导航`。

## 新模块不要写新 skill

模块特有的坑写进 `<模块>/README.md`，结构写进 `<模块>/架构.md`；本 skill 只放跨模块约定。
`docgen.config.js` 的 scriptNote/tableNote/crossNote/readTable 可写模块特有说明，生成进架构图，不用额外文件。

## 改完必跑

```
powershell -NoProfile -ExecutionPolicy Bypass -File tools\check.ps1
```

动了数据层或导航，再跑 `node _local/tests/run-all.mjs --group=数据源` 或 `--group=导航`（都不需要令牌）。

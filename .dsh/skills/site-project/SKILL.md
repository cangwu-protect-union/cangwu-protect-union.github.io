---
name: site-project
description: 维护 D:\CPU\关于CPU的网页 的约定：目录与模块、编码、数据源与兜底、组织验证、上传、地图坐标、跨模块引用、文档生成与校验。主站、guitu、quyu 以及以后新增的模块共用这一份，读或改任何文件前加载。
---

# 本站约定（所有模块共用）

项目根 `D:\CPU\关于CPU的网页` 就是工作区根，用 `write` / `edit` 直接读写，不需要提权。

```
index.html about.html projects.html   主站（不加载脚本）
css/style.css                          全站样式
suggest/                               站点建议：提交 + 审核
guitu/                                 鬼图鉴
quyu/                                  异常区域档案
_local/                                不推送：sql/ docs/ notes/ preview/ tests/ pw/ tools/
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
| `WriteAllLines` 写出 CRLF，`check.js` 报「有 CRLF 换行，项目要求 LF」 | 用 `WriteAllText($p, ($lines -join "`n"), $enc)`，或写完统一转换 |
| 多行文本靠猜空白改 | 先 `IndexOf` 定位，再花括号配对 |
| `Set-Content -Encoding utf8NoBOM` 报「无法匹配枚举器名称」 | 本机 `powershell` 是 5.1，没有 `utf8NoBOM`；用上面的 `UTF8Encoding($false)` + `WriteAllText` |
| `Invoke-WebRequest -SkipCertificateCheck` 报「找不到参数」 | 同样只在 PowerShell 7 有；测接口改用浏览器（Playwright）里 `page.evaluate(fetch)`，顺带验证 CORS |

一次改三个以上文件，先备份或用 `git checkout HEAD -- <路径>` 兜底。

## 编码

UTF-8 无 BOM，LF。项目含大量中文，编码一变全站乱码；`.gitattributes` 与 `.vscode/settings.json` 已强制。

## 提交前

`git add -A` 会把工作区里**所有**改动一次带走，包括不是这次任务产生的：

- 用户自己没提交的界面改动（可能改到一半）
- 误建的空文件、临时导出

所以每次提交前先 `git status --short` 过一遍。发现不属于本次任务的改动，
要么先单独提交并说明，要么在提交信息里写清楚；不要让它躺在你的提交里却只字未提。

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

浏览器端 key（天地图 tk）也是设计上要出现在前端的，需要用 `.gitleaks.toml` **按行**放行
（`regexTarget = "line"` + 只匹配 `tiandituKey` 这一行），不要放行整个文件——那样 service_role
被误写进去也扫不出来。

要一个令牌（例如给测试或测接口）：浏览器开
`http://127.0.0.1:9300/_local/tests/lib/token.html`，答两题后页面显示令牌，可复制。
`_local/tests/lib/token.html` 是唯一入口，不要再造第二个取令牌页面。

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
- 渲染 mermaid 用的是 `_local/tools/vendor/mermaid.min.js`（本地文件）。**不要改回 unpkg/CDN**：
  本机连不上 unpkg，会卡在「等待 mermaid 加载」好几分钟然后整批渲染失败。

## 新增模块

1. 建目录：页面放 `<模块>/*.html`，脚本放 `<模块>/js/`，数据放 `<模块>/data/`（可省）。
   现成例子：`suggest/`（2 个页面、3 个脚本、没有 `data/`，配置跨模块读 `guitu/data/config.js`）。
2. `docgen.config.js` 加一条：
   - `id`：目录名（主站是空串）
   - `access`：每页 `public` / `gate` / `editor`
   - `roles`：图上显示的中文名，不给就用文件名
   - `backend`：后端节点与连线（没有就写 `nodes: []`）
   - `flow`：访客流程图的节点与边；`lock: []` 时不画虚线框（引擎已处理空数组）
3. 跑 `node _local/tools/build-docs.js`，第一次会生成两份 md 的骨架，再手工补「怎么读」。
4. 跑 `powershell -File tools\check.ps1`：目录里出现未登记的模块会直接报错。
5. 在 `改动索引.md` 与根 `README.md` 的目录树里登记；`_local/tests` 的导航用例里如果按
   `a[href="..."]` 写死了入口，路径要跟着改。

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

覆盖编码、JS 语法、HTML 引用、密钥、git 卫生，以及八个生成文档是否与源码一致
（4 个模块 × `架构.md` + `访客流程图.md`）。
动了数据层或导航，再跑 `node _local/tests/run-all.mjs --group=数据源` 或 `--group=导航`（都不需要令牌）。

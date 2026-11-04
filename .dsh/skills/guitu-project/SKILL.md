---
name: guitu-project
description: 维护 D:\CPU\关于CPU的网页（CPU 组织官网 + 鬼图鉴）的硬性约定：目录、编码、数据源、PowerShell 写文件陷阱、校验命令。读写本项目任何文件前先加载。
---

# CPU 官网项目约定

项目根 `D:\CPU\关于CPU的网页` 就是工作区根，用 `write` / `edit` 直接读写，不需要提权。

```
index.html about.html projects.html   主站三页
css/style.css                          全站共用样式
guitu/                                 鬼图鉴：12 个页面 · data/ · js/
_local/                                不推送：sql/ docs/ notes/ preview/ pw/ tools/
```

## 写文件

单点改动用 `edit`。批量替换：

```powershell
$enc = New-Object System.Text.UTF8Encoding($false)
$t = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8).Replace($old, $new)
[System.IO.File]::WriteAllText($p, $t, $enc)
```

`[System.IO.File]` 用进程工作目录，不认 `Set-Location`，跨目录写绝对路径。

| 陷阱 | 做法 |
|---|---|
| here-string 结束符不在行首 → 整段被吞、替换静默失败 | `'@` 独占一行 |
| `.Replace()` 报「参数计数为 3」 | 只传两个纯字符串 |
| `@(@('a','b'))` 被展平 | ``@('a','b') -join "`n"`` |
| `Set-Content -NoNewline` 吞换行 | 用 `WriteAllText` |
| 双引号里反引号是转义符 | 代码围栏用单引号 |
| 多行文本靠猜空白改 | 先 `IndexOf` 定位，再花括号配对 |

一次改三个以上文件，先备份或用 `git checkout HEAD -- <路径>` 兜底；发现写坏立刻从 HEAD 恢复，不要在坏文件上继续改。

## 编码

UTF-8 无 BOM，LF。项目含大量中文，编码一变全站乱码；`.gitattributes` 与 `.vscode/settings.json` 已强制。

## 数据源

数据库是唯一数据源，`data/gui-entries.js` 的种子只作云端不可用时的兜底。`list()` 云端读成功就只用数据库，失败才合并种子 + `entries.json` + 本机未同步条目。两边同时参与合并会让同一条显示两份。

## 改完必跑

```
powershell -NoProfile -ExecutionPolicy Bypass -File tools\check.ps1
```

覆盖编码、JS 语法、HTML 标签栈与重复 id、本地引用、CSS 配平、密钥、git 卫生。退出码 0 才算过。

## 文档与配图

项目较大推进时跑一次（约 40 秒，会起无头浏览器）：

```
node _local/tools/build-docs.js
```

| 产物 | 注意 |
|---|---|
| `guitu/架构.md` | 只改 `AUTO-GENERATED` 区间，区间外手写说明保留 |
| `guitu/访客流程图.md` | 人工维护，改界面时同步改 `build-docs.js` 的 `writeFlow()` |
| `guitu/preview/*.png` | 新增截图要在 `PREVIEW_DESC` 登记 |
| `_local/preview/gui_preview/` | 公开目录的本地镜像 |

图表变乱时优先砍「渲染辅助类」的边，不要硬塞进一张图。

## 不能碰

- `guitu/data/config.js` 的 `publishableKey` 设计上可公开；`API Key`（service_role）绝不进前端。
- `_local/` 永不推送：SQL 含答案哈希，文档含密码。
- 成员真实姓名不上面，页脚统一用组织名；题库答案只存在 `gui_secrets` 表。

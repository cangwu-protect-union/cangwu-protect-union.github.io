---
name: guitu-project
description: 维护 D:\CPU\关于CPU的网页（CPU 组织官网 + 鬼图鉴）时的硬性约定：目录结构、编码换行、数据源原则、PowerShell 写文件陷阱、改完的校验命令。读或改该项目任何文件之前先加载。
---

# CPU 官网项目约定

## 位置

项目根 `D:\CPU\关于CPU的网页`，**本身就是工作区根**。读写项目文件直接用 `write` / `edit` 工具即可，不需要提权。

```
index.html about.html projects.html   主站三页
css/style.css                          全站共用样式
guitu/                                 鬼图鉴模块
  *.html 12 个页面 · data/ 配置与兜底 · js/ 数据层·验证·上传·页面逻辑
_local/                                不推送：sql/ docs/ notes/ preview/ tools/
```

## 写文件的固定姿势

审阅过的单点改动用 `edit` 工具。需要批量替换、或脚本生成时用 PowerShell：

```powershell
$enc = New-Object System.Text.UTF8Encoding($false)   # UTF-8 无 BOM
$t = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)
$t = $t.Replace($old, $new)
[System.IO.File]::WriteAllText($p, $t, $enc)
```

`[System.IO.File]` 用的是**进程工作目录**，不认 PowerShell 的 `Set-Location`。跨目录操作时写绝对路径最稳。

**PowerShell 陷阱**（每一个都实际踩过，其中一次把三个 JS 文件写坏）：

| 陷阱 | 正确做法 |
|---|---|
| here-string 结束符不在行首 → 整段被吞、替换静默失败 | `'@` 必须独占一行 |
| `$s.Replace($a, $b)` 报"参数计数为 3" | 只接受两个纯字符串，不要传数组或换行拼接 |
| `@(@('a','b'))` 被展平 → `$pair[0]` 变成单个字符 | 用 `@('a','b') -join "`n"` |
| `Set-Content -NoNewline` 吞掉换行，整个文件变一行 | 用 `WriteAllText` |
| 双引号字符串里的反引号是转义符，`"```"` 会把引号吃掉 | 代码围栏用单引号 `'```'` |
| 改多行文本靠猜空白 | 先 `IndexOf` 定位，再用花括号配对取函数体 |

一次改三个以上文件，先各自备份或用 `git checkout HEAD -- <路径>` 兜底；发现写坏立刻从 HEAD 恢复，不要在坏文件上继续改。

## 编码与换行

UTF-8 无 BOM，LF。项目含大量中文，编码一变全站乱码。`.gitattributes` 与 `.vscode/settings.json` 已强制。

## 数据源原则

**数据库是唯一数据源，代码里内嵌的数据只作兜底。**

云端读成功 → 只用数据库（`list()` 里 `merge(rows, readLocal())`）。
云端失败 → 才合并 `data/gui-entries.js` 种子 + `data/entries.json` + 本机未同步条目。

两边同时参与合并会让同一条内容显示两份，且编辑图鉴只看到数据库那份。新增示例内容时先用脚本写进数据库，种子副本只留作兜底。

## 改完必做校验

一条命令，不要临时拼脚本：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\check.ps1
```

覆盖编码（BOM / CRLF / 非法 UTF-8）、JS 语法、HTML 标签栈与重复 id、本地引用、CSS 配平、密钥与凭据、git 跟踪卫生。退出码 0 才算过。加 `-Staged` 会额外检查暂存区。检查项清单与已知误报见 `tools/README.md`。

## 文档与配图

一条命令生成全部文档与图片：

```powershell
$node = "<load_workspace_dependencies 返回的 node>"
$env:DSH_PYTHON = "<load_workspace_dependencies 返回的 python>"
& $node "D:\CPU\关于CPU的网页\_local\tools\build-docs.js"
```

| 产物 | 内容 |
|---|---|
| `guitu/架构.md` | 两张架构图（页面↔脚本、脚本↔模块↔后端）+ 脚本矩阵表 |
| `guitu/访客流程图.md` | 面向访客的界面跳转图 |
| `guitu/preview/*.png` | 上述三张图渲染出的 PNG |
| `guitu/preview/README.md` | 预览图索引 |
| `_local/preview/gui_preview/` | 公开目录的本地镜像 |

**只在项目有较大推进时跑**，不需要每次改完都跑（约 40 秒，会启动无头浏览器）。

改图时注意：

- `架构.md` 只覆盖 `AUTO-GENERATED` 标记区间，区间外的手写说明保留
- 访客流程图是**人工维护**的（卡片、详情这类跳转由 JS 生成，扫不出来），改界面时同步改 `build-docs.js` 的 `writeFlow()`
- 新增截图要在 `PREVIEW_DESC` 里补一句描述，否则索引显示「未登记」
- 图表变乱时优先砍「渲染辅助类」的边，不要硬塞进一张图

## 不能碰的东西

- `guitu/data/config.js` 里的 `publishableKey` 是设计上可公开的；`API Key`（service_role）绝不能出现在前端。
- `_local/` 永不推送：SQL 里含答案哈希，文档里含密码。
- 成员真实姓名不得出现在公开页面，页脚统一用组织名。
- 题库答案只存在数据库 `gui_secrets` 表，任何 JS 文件里都不能出现明文或哈希。
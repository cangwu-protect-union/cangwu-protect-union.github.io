---
name: session-archive
description: 会话归档与交接的固定流程：盘点本轮改动、补 skill 与 AGENTS、重生成文档、跑校验、写交接、清点未提交改动。用户说"归档""交接""这个会话要结束""会话将会被归档"时加载。
---

# 会话归档

## 什么时候加载

用户提到「归档」「交接」「这个会话要结束」「会话将会被归档」，或者任务收尾需要把成果交给下一个会话时。

先跑盘点，再按结果做事；不要凭记忆列清单。

## 一条命令盘点

```
node tools/archive-check.mjs --since=<会话开始前的 commit>
```

`--since` 取本会话动手前的 `git log --oneline -1`。不确定就给 `--since=HEAD~10`，脚本会按范围算。

输出六段：本轮提交、领域与对应 skill（含"该更新但没更新"）、工作区状态（哪些不属于本轮）、提交前要看的、校验命令、交接正文骨架。加 `--out=_local/docs/xxx-交接.md` 直接落盘。

## 五步

### 1. 盘点

跑上面的脚本。重点看两列：

- **skill 有更新 = 否**：这个领域改了代码却没写 skill，要么补，要么在交接里说明为什么不用补。
- **不属于本轮改动**：别人没提交的活。不要 `git add -A` 把它们带走；要带走就在提交信息里逐条写明。

### 2. 补 skill 与 AGENTS

- 新增的规则、命令、踩过的坑写进对应 `.dsh/skills/*/SKILL.md`。
- 出现新子系统（新目录、新工具、新数据表）就新建 skill，并在 AGENTS.md 的 skill 表加一行。
- AGENTS 只放"每轮都必须生效"的规则；细节留在 skill 里，别把 skill 内容抄进 AGENTS。
- 改了 skill 必须提交：`.dsh/skills/` 受版本管理，不能只留在本地。

### 3. 重生成文档

```
node _local/tools/build-docs.js
```

改了页面、脚本、数据或 `docgen.config.js` 之后必跑，否则 `check.ps1` 的 docs freshness 会失败。

### 4. 校验

```
powershell -NoProfile -ExecutionPolicy Bypass -File tools\check.ps1
```

退出码 0 才算过。按领域补跑：

| 领域 | 补跑 |
|---|---|
| 策略实验室 | `node rpg6.0/strategy-lab/selftest.mjs` |
| 战斗引擎 | `node _local/tests/engine/run.mjs`、`batch.mjs --pairs=smoke --seeds=1` |
| 页面改动 | 浏览器实测（`guitu-browser-test`） |
| 数据层/导航 | `run-all.mjs --group=数据源` / `--group=导航` |

### 5. 写交接 + 提交

交接文档放 `_local/docs/<模块>-交接.md`（不推送），必须回答五个问题：

1. 现在能跑到哪一步（可运行、已上线、还是设计稿）
2. 这一轮的判断与取舍（为什么这么做，放弃了什么）
3. 没做完 / 卡在哪（具体到文件、命令、缺的权限）
4. 下一轮先做什么（一条，不是清单）
5. 复现命令（可直接粘贴）

提交：只 add 本轮路径，逐行看 `git status --short`；提交后再跑一次 `check.ps1`（gitleaks 只扫 commit）。推送后用本次特有的字符串轮询确认生效。

## 判断标准

| 该做 | 可以不做 |
|---|---|
| 新命令、新坑、新口径写进 skill | 把实现细节抄进 AGENTS |
| 新子系统建 skill + AGENTS 挂钩 | 给只跑一次的临时脚本建 skill |
| 交接写"下一轮先做什么" | 罗列所有历史 |
| 提交 skill 与生成文档 | 提交 `_local/`、`*.sql`、运行产物 |

## 坑

1. **`git add -A` 会带走别人的活**。工作区常有另一个会话的未提交改动（本次就遇到引擎升版一半的状态）。
2. **skill 不提交等于没交接**。下一个会话读的是磁盘，但换机器/克隆就没了。
3. **AGENTS 引用了未提交的文件**：例如写了 `js/engine/version.js` 但该文件还没 track，新克隆会找不到。提交信息里说明，或等那批文件一起提交。
4. **生成文档过期**：`build-docs --check` 是硬失败，改完页面不重生成一定红。
5. **产物进了仓库**：`runs/`、`preview/` 之类要么进 `_local`，要么加进 `.gitignore`，否则 `check.ps1` 的文件扫描会越来越多。
6. **归档不是终点**：交接里要写清楚"下一轮先做什么"，否则下一个会话会重做一遍已经做完的事。

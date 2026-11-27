# 三角色协作计划（Trae SOLO 版）

写于 2026-11-27，替代 `关于多anget协作完成简单任务.txt` 与 `关于简单项目的工作流程.txt`。
旧文件的两条主线保留：先规划再动手、任务拆到能一次做完；删掉的是"多进程交接"那套机械。

本文件是给人看的说明书，也是主 Agent 开工前要读的协议。放 `.trae/` 下，不进 `check.ps1` 的检查面。

---

## 1. 三角色

| 角色 | 谁 | 能做什么 | 不能做什么 |
|---|---|---|---|
| 总工程 | Trae 内置 Agent（主 Agent，常驻） | 读规则与 spec、拆任务卡、调子智能体、跑闸门命令、问你、提交 | 不越过 spec 改范围；不在执行中改任务卡 |
| 程序 | `.trae/agents/implementer.md`（子智能体） | 按任务卡改文件、跑验收命令 | 不问你、不提交、不改 `.trae/`、不碰任务卡外文件 |
| 测试 | `.trae/agents/adversary.md`（子智能体） | 只读 + 跑命令，推翻"已完成" | 不写文件、不修代码 |

没有"咨询"角色：盘问由主 Agent 按 `AGENTS.md` 第一条做，问完出 spec 给你确认。咨询如果要独立存在，就得占一个任务、一份上下文，产出的还是同一份 spec，不值。

子智能体是文件定义、由主 Agent 调用、返回结论就结束；只有内置 Agent 能调它们，它们之间不能互相调用，也不能向你提问。这是平台限制，不是取舍。

## 2. 一次任务

```
你给一行目标
  → 主 Agent 定位（改动索引 / 范围收敛计划 / git status）
  → 出或改 spec（.trae/specs/<线>/spec.md + tasks.md + checklist.md）
  → 【闸口 1】你确认 spec
  → 逐张任务卡：implementer → 闸门命令 → adversary
        adversary 不通过 → 回 implementer（同卡，最多两轮；两轮不过就停，报你）
  → 收尾：check.ps1、交接 10 行、按路径提交
  → 【闸口 2】上线（只有发布才需要）
```

闸口 1 是唯一的需求入口。执行中想到要改范围，停下来重新确认，不在任务卡上就地改。
闸口 2 只在你点头后跑 `publish.ps1`。

## 3. 双线并行

两条活跃线保持同时活着：对局（4 项）、角色（剩 4 人 17 技能）。默认形态是**交替并行**——两条线各有 spec 和任务卡，随时切换，但同一时刻只有一个任务在写工作区。

原因：`check.ps1` 扫的是整个工作区，`git status` 和 `git add -A` 也是全仓的。两个任务同时写，会出现三种污染：

- A 线跑 `check.ps1` 因为 B 线半成品 JS 报红，分不清责任；
- A 线提交时 `git add -A` 把 B 线没验完的改动带走；
- 两边都改 `version.js` 或 `config.js`，版本号对不上，`rpg6-lint` 直接红。

### 3.1 路径分区

| 线 | 允许改（前缀） | 说明 |
|---|---|---|
| A 对局 | `rpg6.0/test.html`、`rpg6.0/css/battle.css`、`rpg6.0/js/battle/`、`rpg6.0/data/rule-docs.js`、`rpg6.0/js/engine/rules.js`、`rpg6.0/js/engine/timeline.js` | 认输/终局、规则页、卡死审计、陌生人入口 |
| B 角色 | `rpg6.0/data/skills/`、`rpg6.0/js/engine/ops/`、`rpg6.0/js/rpg-data.js`、`rpg6.0/js/rpg-form.js` | 4 人 17 技能；ops 归属 B，A 要动按共享文件处理 |
| 共享（一次只一条线改） | `rpg6.0/js/engine/version.js`、`rpg6.0/data/config.js`、`tests/engine/`、`tools/size-budget.json` | 版本号两处必须同步；测试运行器两边都会加文件 |

这张表按 `改动索引.md` 推的，不是实测清单。第一轮开工时用 `git status --short` 和实际 diff 校正一次，改这张表，然后照用。

### 3.2 并行的三个硬条件

1. 任务卡的路径前缀不相交；相交就退回串行，不做例外。
2. 改共享文件前先 `git status --short`，确认另一条线没有未提交改动；有就等它提交。
3. 提交按路径，不用 `publish.ps1`（它 `git add -A`）。用它内部那五步：

```
git add <本线路径>
powershell -NoProfile -ExecutionPolicy Bypass -File tools\check.ps1 -Staged
git commit -F <消息文件>
git push origin main
powershell -NoProfile -ExecutionPolicy Bypass -File tools\check.ps1 -Last
```

`check.ps1 -Staged` 只看暂存区，所以不会因另一条线的工作区改动报红。

### 3.3 什么时候必须退回串行

- 同一张任务卡跨两条线的文件（例如改 `engine/ops` 同时动对局页）。
- 任一条线要升 `ENGINE_VERSION`（版本号、`rpg6-stats --write`、`plan.mjs --write` 一起走）。
- 一边在跑 `verify.ps1 -Browser` 或手机实测，另一边要提交——浏览器用例读的是同一份工作区。

## 4. 规则

1. 写串行、读并行。两个任务不得同时改工作区；审查、检索可以并行。
2. 未确认 spec 不动手；任务卡不写完"允许改的路径 + 验收命令"就不算写完。
3. 只有主 Agent 能问你；子智能体只能返回"需决定：…"。
4. 闸门顺序不可跳：spec 确认 → 改 → 命令绿 → adversary 过 → 提交。任一不过不提交。
5. 权限最小化：审查角色只读；程序只在任务卡路径内写。
6. 单卡规模：文件 ≤ 5 个（`data/skills/` 一角色一文件按 1 个算）、必须带一条能跑的命令、超 ~40 步就拆卡。
7. 上下文不是指标：换阶段或超 ~40 步就收尾交接、开下一个任务；`AGENTS.md` 的 100 步/150k 阈值仍然有效。
8. skill 与 `AGENTS.md` 只在"不改就会重复犯错"时改，单独提交；冻结面不扩检查规则。

## 5. 闸门命令

| 什么时候 | 命令 |
|---|---|
| 每张卡改完 | 任务卡里写的那条；没写就是不合格的卡 |
| 收尾（每次提交前） | `powershell -NoProfile -ExecutionPolicy Bypass -File tools\check.ps1` |
| 动了对局/引擎/技能 | `powershell -NoProfile -ExecutionPolicy Bypass -File .dsh/skills/rpg6-character-batch/scripts/verify.ps1` |
| 改了界面/结算 | 上一条加 `-Browser` |
| 日常两组 | `node tests/engine/run.mjs`、`node _local/tests/run-all.mjs --group=回合制` |
| 角色线盘点 | `node .dsh/skills/rpg6-character-batch/scripts/inventory.mjs --remaining` |

hook 只做两件事：会话开始报工作区状态、拦截 `git clean` / `git reset --hard` 这类会毁掉 `_local/` 的命令。**没有配 `Stop` 自动跑 `check.ps1`**：Stop 在每次"结束这一轮"时都触发，包括 Agent 停下来问你的时候；树是脏的就会把你刚要回答的问题顶掉。检查交给收尾和 `publish.ps1` 的 `-Staged` 闸。

## 6. 开工设置（Trae 面板，一次做完）

1. 打开 `D:\CPU\关于CPU的网页`，把该目录设为**可信目录**（否则项目规则、技能、hook 都不生效）。
2. 设置 > 规则 > 导入设置：打开**将 AGENTS.md 包含在上下文中**。
3. 设置 > Beta：打开**启用 Subagents 目录**（否则 `.trae/agents/` 不生效）。
4. 设置 > 技能与命令：确认项目技能里出现 6 个（来自 `.trae/skills/`，正文指向 `.dsh/skills/`）。
5. 设置 > Hooks：确认项目 `hooks.json` 已启用，运行方式选**沙箱运行**。
6. 设置 > 权限审批：选**自动审批**；给 `check.ps1`、`verify.ps1`、`node tests/engine/run.mjs` 加放行规则；`git` 与 `publish.ps1` 保留人工确认。
7. 模式切 SOLO，`@` 选内置 Agent。不要用 `/Goal`（它会自己推进到目标，绕过 spec 闸口）；用 `/Spec` 生成文档没问题，落盘位置正好是本计划的 `.trae/specs/`。

## 7. 提示词

**开场**（每条线一个任务，各粘一次）

```
读 AGENTS.md 与 .trae/team-plan.md。本次只做对局线（或：角色线）：<一行目标>。
先不要改代码。用 /Spec 或按 .trae/specs/_template 在 .trae/specs/battle/（或 chars/）下建 spec、tasks、checklist，
任务卡写到"允许改的路径 + 验收命令"这一层，列出来等我确认。
```

**做一张卡**

```
做 battle-02。按任务卡范围调 implementer，跑卡片里的验收命令，
再调 adversary 判定；不通过就同卡修，最多两轮；通过后写交接、按路径提交。
```

**收工**

```
收工：跑 check.ps1，写 10 行交接，按路径提交本线文件，然后停下，不要开始下一张卡。
```

## 8. 与旧计划的差异

| 旧 | 新 | 为什么 |
|---|---|---|
| 咨询、总工程、程序、测试 四个独立进程 | 三角色：主 Agent + 2 个子智能体 | 咨询的产出就是 spec，单独开一个进程只是多一份上下文 |
| 咨询开启总工程、总工程开启代码 | 主 Agent 依次调用 | 子智能体不能互相调用，只有内置 Agent 能调 |
| 代码可以直接问用户 | 子智能体把问题写进返回值 | 子智能体没有用户交互能力 |
| 代码开启一个新的测试 | 主 Agent 调 adversary | 不存在嵌套子智能体 |
| 不允许任何并行 | 写串行、读并行；两条线交替并行 | 平台默认会并行，规则写"禁止"只会被绕开 |
| 上下文 70% 交接 | 换阶段或 40 步收尾，交接写文件 | 上下文会自动压缩，新任务清空，70% 不可控 |
| 每完成一个最小项目就优化 skill 和 agent.md | 只在重复犯错时改，单独提交 | 本项目 43/114 次提交是流程类，元工作已经超重 |
| 结束时删除所有中间文件、重写架构 | 只清 `.trae/` 临时稿，不删代码、不重写 `架构.md` | 与"不撤入口、不删代码"和文档冻结冲突 |
| 下载工具链 | 只按需加 MCP，加完写进规则 | 纯静态站，没有依赖要装 |
| 技术栈拍板 | 只在新增一类基础设施时拍板 | 栈已定，见 `AGENTS.md` 架构升级那条 |

## 9. 失效与回退

- 子智能体没被调用：在提示词里点名（"调 implementer"）；`description` 写触发场景，不写角色名。
- 并行时 `check.ps1` 报红：先看红的是不是本线文件，不是就记下来、继续，提交前要求对方线干净。
- 提交带进了对方的文件：`git reset --soft HEAD~1` 退回提交，按路径重提，不要 `--hard`。
- 任务卡两轮不过：停卡，写交接，报你。不要在同卡上无限试。
- 想加新东西：先看 `range` 那条（`范围收敛计划.md` §7），从活跃面里划掉等量的，记 `backlog.md`。

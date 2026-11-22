---
name: rpg6-character-batch
description: 回合制正传 6.0 的批量加角色/技能工作流。要从剩余角色里选人、逐条确认技能逻辑、判断现有引擎能否落地、制定并执行实现方案、补引擎/数据/测试/文档时加载；含盘点、缺口分诊、计划校验/脚手架、文档计数审计与验收脚本。
---

# 回合制 6.0 批量加角色

这是一条**流程** skill；引擎、DSL、对局页的细节在 `rpg6-battle`。本 skill 管「先做什么、什么时候必须停、交付什么」。

## 什么时候加载

- 用户说「再加几个角色」「把剩下的角色做了」「这批技能能不能实现」
- 要从剩余角色里选一批，先评估可行性再决定做不做；或给 `rpg6.0` 补引擎能力（新 op/钩子）
- 要审计角色/技能数、测试数或文档是否同步

## 流程

### 0. 定范围（先盘点，不写代码）

```powershell
node .dsh/skills/rpg6-character-batch/scripts/inventory.mjs --remaining
```

盘点读 `rpg6.0/data/seeds/characters*.js`（33 人，数据库导出，只作离线盘点）与 `rpg6.0/data/skills/index.js`（技能库聚合入口，一个角色一个 ESM 文件），输出已接入/剩余角色、逐技能状态。**数据库才是唯一数据源**：正式落地前用对局页/DB 核对角色的 `skills[]` 与 `condition`，不一致先修 seed/DB 再继续。
把候选清单交给用户确认；**这一步不要读技能效果就开写**。

### 1. 读档案，逐条确认技能逻辑（硬门禁）

每个候选读三处互相校对：`rpg6.0/archive/6.0doc/回合制角色/` 原始档案、`rpg6.0/data/seeds/characters*.js` 的 `skills[]`、`_local/docs/回合制6.0测试功能-角色机制.md` 逐条裁定。产出**逻辑确认表**，每个技能写清：名称与条件文本（与档案忽略空白一致）、目标、费用（蓝/力/血）、冷却、持续回合、触发时机、与原文不同的裁定（取整、从哪回合算、是否可叠加、受击溃/眩晕影响）、不确定处标「待确认」。旧档案与 seed 冲突时以 seed 为准，并在表里写明差异。
**用户明确确认这张表之前，不写数据、不写引擎。**

### 2. 引擎可行性分诊

```powershell
node .dsh/skills/rpg6-character-batch/scripts/triage.mjs --remaining
```

分诊只是**启发式**筛子（扫 effect 里的护盾、复活/回溯、额外行动、破免、动态召唤数等关键词），不能替代逐 op 映射；误报要人工消掉。每个技能三选一：

| 结论 | 含义 | 下一步 |
|---|---|---|
| `existing` | 现有 op/钩子能表达 | 直接写 plan 的 `ops`/`hooks` |
| `engine-gap` | 需要新 op/钩子/状态 | 先写引擎方案，按 AGENTS「架构升级不要走捷径」找用户确认 |
| `unsupported` | 数据缺口、外部交互或本版不做 | 写具体原因，界面置灰 |

### 3. 实现方案（plan.json）

用 `assets/plan.template.json` 写，一个角色一块，**覆盖该角色档案里的全部技能**（不做的也留 `unsupported`，界面能解释）。字段：`status` ∈ implemented/unsupported/engine-gap；`unsupported` 只在后两种填可核对理由；`tests` 至少一条。
面板与 seed 不一致时（档案攻击格写成注记、不是数字），plan 里加 `statOverrides:{atk:"0"}` 声明覆盖值：`--check` 会要求 `stats.atk` 等于覆盖值、放开与 seed 的比对，`--scaffold` 生成的 CHAR fixture 也用覆盖值。实际覆盖要在技能库 `index.js` 的 `panels` 里登记，否则 `makeUnit` 仍会读到 seed 的注记而抛错。

```powershell
node .dsh/skills/rpg6-character-batch/scripts/plan.mjs --check plan.json
node .dsh/skills/rpg6-character-batch/scripts/plan.mjs --scaffold plan.json
```

`--scaffold` 只输出可粘贴的一个角色一个文件（`rpg6.0/data/skills/<拼音>.js`）、`index.js` 的 import/characters/marks/summons 登记行、`SHEET`/`CHAR`、测试清单与文档计数，不直接改源码。
**用户确认 plan 后才进入实现**；`engine-gap` 非空时 `engine.changes` 要列出每个新 op/钩子及其测试，不能边写边发明。

### 4. 实现（依赖顺序）

1. **引擎**（有 gap 才做）：state/damage/effect-ops/skills/actions/conditions/timeline/summons；同步 `rpg6-battle` 的 op/钩子表；补单测；升 `data/config.js` 的 `engineVersion`。
2. **数据**：`rpg6.0/data/skills/<拼音>.js` 新文件 + `index.js` 登记 `characters`/`marks`/`summons`；`conditionText` 逐字对齐；`unsupported` 写原因。
3. **测试**：`skills.test.mjs` 的 `SHEET`/`CHAR`、角色/技能数断言；每个 implemented 技能至少「条件不足 + 正常释放」两条；多段/召唤/目标选择补引擎用例；浏览器补 `run-all` 用例。
4. **文档**：机制文档新一节带 `<!-- skill:id -->` 锚点、plan、`游戏说明`、`架构`、`README` 与 `rpg6-battle` 的能力表；数字一律 `node _local/tools/rpg6-stats.js --write` 写回（`test.html` 运行时算）。

### 5. 验收

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .dsh/skills/rpg6-character-batch/scripts/verify.ps1 -Plan plan.json
```

默认：`plan --check` → `run.mjs` → `batch --pairs=smoke` → `run-all --group=回合制` → `check.ps1` → `audit-docs`。没有 Edge 加 `-SkipBrowser`；全量压测加 `-Full`。
看：引擎异常 0、僵局按规则分类、新角色浏览器可选且技能行条件/置灰正确（有召唤物 844×390 一屏）、audit-docs 无漂移、check.ps1 提交后仍 0。
`audit-docs` 现在直接复用 `_local/tools/rpg6-stats.js` 的区间渲染，不再逐条正则匹配文档；`_local` 缺失时整步跳过。

**沙箱**：DSH 文件沙箱里 node 派生不了子进程，`check.ps1` 会打一行「46 个 ESM 文件无法派生 node 校验，语法交给 biome」，不阻塞、也不是技能库坏了（2026-11 之前这里会报 46 条假语法错误）。同一原因 `.git/` 不可写，`git add`/`commit` 要一次 full-access。

### 6. 文档与推送

按 `guitu-deploy` 提交；提交信息写清本批角色/技能数与未落地原因。提交后**再跑一次 check.ps1**（gitleaks 只扫 commit；`key:` 误报按路径+行正则放行，不要整文件放行）。

## 当前引擎能力与缺口

完整能力表（已具备的 op/钩子/动态数值落点）与常见缺口清单见 [引擎能力表.md](引擎能力表.md)；DSL 细节在 `rpg6-battle` 与 `_local/docs/回合制6.0测试功能-plan.md`。

## 脚本

脚本清单见 [引擎能力表.md](引擎能力表.md)。脚本自动定位仓库根、只读源码，只有 `--out` 写脚手架文本，不直接改游戏文件。

## 硬规则

- **`plan.mjs` 有两种模式**：`--check` 默认是实现前校验（角色已在技能库里算错，`plan.docs` 的期望值参与比对）；`--check --mode=verify` 是实现后验收（允许已在库里，不再比对 `plan.docs`，计数打印的是技能库现状）。`verify.ps1 -Plan` 用 `--mode=verify`，不需要再手改 `allowExisting:true` 或清空 `docs` 块。
- **`tools/check.ps1` 有 40960 字节单文件上限**（md/js/css/ps1，vendor 豁免）：改大文件前先量余量；真撞上了再拆函数到分片文件（拆法示例见 `rpg6-battle` 的踩坑 45）。上限 2026-11 从 20480 提到 40960，因为当时的余量只剩几十字节，分割又不减少阅读量。
- 逻辑未确认不写代码；用户确认的是逐技能表，不是「大概懂了」。
- 数据库是唯一数据源；`data/seeds/characters*.js` 只用于离线盘点，不一致先修再继续。
- 技能库是 ESM 分文件（`data/skills/*.js` + `index.js`），不是当年的 `data/battle-skills.js`；脚本按 ESM 直接 import，别改回 vm 读 window 全局。
- 不静默近似：只能用现有 op 近似时 plan 写 `notes` 并让用户签字；否则标 `engine-gap`/`unsupported`。
- 每个角色至少 1 个 implemented 技能，否则默认不加；全技能覆盖，不做的也留 `unsupported`。
- `conditionText` 逐字一致（忽略空白）；改规则升 `engineVersion`；召唤物/新钩子进 `state.hash` 与回放。
- 新增 op/钩子/数值表达式/状态名/字段时同步 `_local/tools/rpg6-spec.js`，否则 `rpg6-lint.js` 会按白名单报错。
- `_local/` 不推送；机制文档在 `_local` 也要更新；提交后重跑 check.ps1。
- 同一工作区多会话：提交前看 `git status` 与 `git log`，别混别人的改动。

## 交付前检查

- [ ] 用户已确认逐技能逻辑表与 plan；`plan --check` 通过；engine-gap 都有引擎方案与用户确认
- [ ] `run.mjs` 全绿；`batch --pairs=smoke` 无引擎异常；`run-all --group=回合制` 全绿
- [ ] `audit-docs` 无漂移；机制文档新节、plan、游戏说明、架构、test.html 同步
- [ ] 每批 unsupported/engine-gap 有可核对原因；check.ps1 提交后 0；`_local/` 未进提交

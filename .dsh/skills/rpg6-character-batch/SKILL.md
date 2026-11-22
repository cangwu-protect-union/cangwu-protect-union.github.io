---
name: rpg6-character-batch
description: 回合制正传 6.0 的批量加角色/技能工作流。要从剩余角色里选人、逐条确认技能逻辑、判断现有引擎能否落地、制定并执行实现方案、补引擎/数据/测试/文档时加载；含盘点、缺口分诊、确认表、plan 落盘、文档计数与验收脚本。
---

# 回合制 6.0 批量加角色

这是一条**流程** skill；引擎、DSL、对局页与命令细节在 `rpg6-battle`，能力表与脚本清单在 [引擎能力表.md](引擎能力表.md)。本 skill 只管「先做什么、什么时候必须停、交付什么」。

## 什么时候加载

- 用户说「再加几个角色」「把剩下的角色做了」「这批技能能不能实现」
- 要从剩余角色里选一批，先评估可行性再决定做不做；或给 `rpg6.0` 补引擎能力（新 op/钩子）
- 要审计角色/技能数、文档计数是否同步（现在由 `rpg6-stats --check` 与 `verify.ps1` 负责）

## 流程（每批 7 步，手写只剩 3 处）

### 0. 盘点 + 分诊（一条命令）

```powershell
node .dsh/skills/rpg6-character-batch/scripts/inventory.mjs --remaining --triage
```

输出已接入/剩余角色、逐技能状态与启发式缺口标记。分诊只是筛子，不是结论；**这一步不要读技能效果就开写**。

盘点读 `rpg6.0/data/seeds/characters*.js`（33 人，数据库导出）与 `rpg6.0/data/skills/index.js`。**数据库才是唯一数据源**：正式落地前用对局页/DB 核对角色的 `skills[]` 与 `condition`，不一致先修 seed/DB 再继续。把候选清单交给用户确认。

### 1. 读档案，写 plan（唯一作者面）

每个候选读三处互相校对：`rpg6.0/archive/6.0doc/回合制角色/` 原始档案、`seed` 的 `skills[]`、`_local/docs/回合制6.0测试功能-角色机制.md` 逐条裁定。按 `assets/plan.example.json` 写 `plan.json`，一个角色一块，**覆盖该角色档案里的全部技能**（不做的也留 `unsupported` 与原因）。

必须写的字段：`fixture`（小写拼音，技能文件名）、每条技能的 `id`、`name`、`condition`（与档案忽略空白一致）、`target`、`cost`/`charge`/`cooldown`、`ops`、`status`、`unsupported`（未实现时）、`tests`、`notes`（裁定：取整、从哪回合算、是否叠加、受击溃/眩晕影响；不确定处标「待确认」）。

```powershell
node .dsh/skills/rpg6-character-batch/scripts/plan.mjs --check plan.json
node .dsh/skills/rpg6-character-batch/scripts/plan.mjs --check plan.json
```

`--check` 直接输出逐技能确认表（条件/目标/费用/蓄力/冷却/状态/裁定），不再手抄。**用户明确确认这张表之前，不写数据、不写引擎。**

panel 与 seed 不一致时（档案攻击格是注记），plan 里加 `statOverrides:{atk:"0"}`；实际覆盖要在技能库 `index.js` 的 `panels` 里登记，否则 `makeUnit` 仍读 seed 注记而抛错。

### 2. 引擎可行性分诊（写 plan 时逐条判定）

每个技能三选一：

| 结论 | 含义 | 下一步 |
|---|---|---|
| `implemented` | 现有 op/钩子能表达 | 直接写 `ops`/`hooks` |
| `engine-gap` | 需要新 op/钩子/状态 | 先写引擎方案，按 AGENTS「架构升级不要走捷径」找用户确认 |
| `unsupported` | 数据缺口、外部交互或本版不做 | 写可核对原因，界面置灰 |

不静默近似：只能用现有 op 近似时 plan 写 `notes` 并让用户签字；否则标 `engine-gap`/`unsupported`。每个角色至少 1 个 implemented 技能，否则默认不加。

### 3. 落盘（一条命令）

```powershell
node .dsh/skills/rpg6-character-batch/scripts/plan.mjs --scaffold plan.json --write
```

它做四件事，全部自动：

1. 新建 `rpg6.0/data/skills/<fixture>.js`（已存在则拒绝，覆盖加 `--force`）；
2. 按 `index.js` 里的四行 `/* RPG6-SCAFFOLD:* */` 锚点登记 import / characters / marks / summons（锚点被删会拒绝写盘）；
3. 在机制文档追加角色一节，每条技能一行 `<!-- skill:id -->：` 加 plan 的 `notes`（`notes` 为空才写「待补」）；
4. 调 `rpg6-stats` 写回所有文档里的角色数/技能数/op 数/unsupported 表/版本号。

写前会先查重复（角色已在库、fixture 已 import、mark/summon key 已存在），有问题一处不写。`--scaffold` 不加 `--write` 只打印，用于预览。

### 4. 实现引擎与测试（有 gap 才做）

依赖顺序：`state/damage/effect-ops/skills/actions/conditions/timeline/summons` → 同步 `_local/tools/rpg6-spec.js` → 补单测 → 升版本。升版本一条命令：`node tools/rpg6-bump.mjs 6.0-engine.12`（同时改 `version.js`、`data/config.js` 与文档）。

技能库测试不用手抄：`skills.test.mjs` 的 `SHEET`/`CHAR` 从 seed 现算，`全技能释放` 那条会把每条技能机械跑一遍。手写只写数值或裁定要盯住的（多段、掷骰分支、召唤、目标选择、状态交互）。

机制文档正文不用再抄一遍：它取的是 plan 的 `notes`，也就是你在确认表里签过的那一列。`notes` 空着的会留「待补」，`rpg6-lint` 会把「待补」和缺的锚点当错误报出来。

### 5. 验收（一条命令）

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .dsh/skills/rpg6-character-batch/scripts/verify.ps1 -Plan plan.json
```

依次跑 plan 验收（`--mode=verify`）→ 引擎单测 → 冒烟压测 → `check.ps1`（编码/lint/文档计数/biome/gitleaks）。改了对局页、技能结算或样式加 `-Browser` 跑浏览器组（默认不跑，结尾会打一行提示）；全量压测加 `-Full`。

看：引擎异常 0、僵局按规则分类、新角色浏览器可选且技能行条件/置灰正确（有召唤物 844×390 一屏）、`check.ps1` 退出 0。

### 6. 提交

一条命令：`powershell -NoProfile -ExecutionPolicy Bypass -File tools\publish.ps1 -Message msg.txt`（内部跑 `check.ps1 -Staged`、提交、push、`check.ps1 -Last`）。提交信息写清本批角色/技能数与未落地原因。

## 硬规则

- **逻辑未确认不写代码**；用户确认的是逐技能表（`--check` 打印的那张），不是「大概懂了」。
- 数据库是唯一数据源；seed 只用于离线盘点，不一致先修再继续。
- `conditionText` 逐字一致（忽略空白）；改规则升 `engineVersion`；召唤物/新钩子进 `state.hash` 与回放。
- 新增 op/钩子/数值表达式/状态名/字段时同步 `_local/tools/rpg6-spec.js`，否则 `rpg6-lint.js` 按白名单报错。
- `index.js` 的四行 `RPG6-SCAFFOLD` 锚点不要删，`plan.mjs --write` 靠它们定位。
- 文档里的数字、unsupported 表、op 一览都不要手写：`rpg6-stats.js --write` 写回（`verify` 会自动跑）。
- `_local/` 不推送；机制文档在 `_local` 也要更新；同一工作区多会话，提交前看 `git status` 与 `git log`。

## 交付前检查

- [ ] 用户已确认 `--check` 打印的逐技能表；`plan --check` 通过；engine-gap 都有引擎方案与用户确认
- [ ] `plan --scaffold --write` 已落盘；`index.js` 四处登记正确；机制文档锚点齐全且没有「待补」
- [ ] `verify.ps1 -Plan plan.json` 全绿（改了页面再加 `-Browser`）
- [ ] 每批 unsupported/engine-gap 有可核对原因；提交后 `check.ps1 -Last` 通过；`_local/` 未进提交

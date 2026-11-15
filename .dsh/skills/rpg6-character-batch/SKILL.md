---
name: rpg6-character-batch
description: 回合制正传 6.0 的批量加角色/技能工作流。要从剩余角色里选人、逐条确认技能逻辑、判断现有引擎能否落地、制定并执行实现方案、补引擎/数据/测试/文档时加载；含盘点、缺口分诊、计划校验/脚手架、文档计数审计与验收脚本。
---

# 回合制 6.0 批量加角色

这是一条**流程** skill；引擎、DSL、对局页的细节在 `rpg6-battle`。两者一起用：本 skill 管「先做什么、什么时候必须停、交付什么」，`rpg6-battle` 管「这个 op/钩子怎么写」。

## 什么时候加载

- 用户说「再加几个角色」「把剩下的角色做了」「这批技能能不能实现」
- 要从剩余角色里选一批人，先评估可行性再决定做不做
- 要给 `rpg6.0` 补引擎能力（新 op/钩子）来做角色
- 要审计角色/技能数、测试数或文档是否同步

## 流程

### 0. 定范围（先盘点，不写代码）

```powershell
node .dsh/skills/rpg6-character-batch/scripts/inventory.mjs --remaining
```

盘点会读 `data/characters.js`（33 人兜底）与 `data/battle-skills.js`（已接入的技能块），输出：已接入/剩余角色、已实现/unsupported/未加技能、每个剩余角色的逐技能状态。

`characters.js` 只是离线盘点的兜底；**数据库才是唯一数据源**。正式落地前用对局页/DB 核对角色的 `skills[]` 与 `condition`，不一致先修 seed/DB，再让 `plan.mjs` 通过；浏览器 e2e 的 33 人选项会再验一次。

把候选清单交给用户确认。**这一步不要读技能效果就开写**；先确认「这批做谁、做到什么程度」。

### 1. 读档案，逐条确认技能逻辑（硬门禁）

每个候选角色读三处，互相校对：

1. `rpg6.0/archive/6.0doc/回合制角色/` 的原始档案（技能原文）；
2. `data/characters.js` 的 `skills[]`（名称、条件、effect，通常是校对后的版本）；
3. `_local/docs/回合制6.0测试功能-角色机制.md` 的逐条裁定与「剩余」表。

产出**逻辑确认表**，每个技能至少写清：

- 名称、条件文本（必须与档案忽略空白后一致）
- 目标、费用（蓝/力/血）、冷却、持续回合、触发时机
- 与原文不同的裁定（四舍五入、取整、持续回合从哪回合算、是否可叠加、是否受击溃/眩晕影响）
- 不确定处标「待确认」，让用户逐条拍板

**用户明确确认这张表之前，不写数据、不写引擎。** 这是项目已有的约定；历史批次里反复出现「先做后改」的返工。

### 2. 引擎可行性分诊

```powershell
node .dsh/skills/rpg6-character-batch/scripts/triage.mjs --remaining
```

分诊只做**启发式**筛子：把未加技能的 effect 扫一遍，标出护盾、复活/回溯、额外行动、`noBasic`、自动普攻、破免、伤害转化、法伤专属易伤、每回合选择/对话、反弹次数、动态召唤数、状态快照等关键词。它不能替代逐 op 映射。

对每个技能给出三选一：

| 结论 | 含义 | 下一步 |
|---|---|---|
| `existing` | 现有 op/钩子能表达，必要时组合 | 直接写 plan 的 `ops`/`hooks` |
| `engine-gap` | 需要新 op/钩子/状态，或现有能力只够近似 | 先写引擎方案，按 `AGENTS.md` 的「架构升级不要走捷径」找用户确认 |
| `unsupported` | 数据缺口、外部交互或本版不做 | 写具体原因，界面置灰 |

分诊的误报要人工消掉：`triage` 说 needs engine 不等于一定不能做；说 likely 也不等于语义完全一致。

### 3. 实现方案（plan.json）

用 `assets/plan.template.json` 写 `plan.json`，一个角色一块，**覆盖该角色档案里的全部技能**（不能静默漏掉）。每个技能包含：

```json
{
  "name": "技能名",
  "condition": "2蓝",
  "id": "owner.skill",
  "target": "enemy",
  "cost": { "mp": 2 },
  "charge": 0,
  "cooldown": 0,
  "passive": false,
  "once": false,
  "ops": [],
  "hooks": {},
  "status": "implemented",
  "unsupported": "",
  "tests": ["条件不足/正常释放/回放"],
  "notes": ""
}
```

- `status`: `implemented` / `unsupported` / `engine-gap`
- `unsupported` 只在后两种填，写可核对的理由
- `tests` 至少一条；`unsupported` 可以为空
- 计划里的角色/属性/条件必须和 seed 对得上；`plan.mjs` 会校验

```powershell
node .dsh/skills/rpg6-character-batch/scripts/plan.mjs --check plan.json
node .dsh/skills/rpg6-character-batch/scripts/plan.mjs --scaffold plan.json
```

`--scaffold` 只输出可粘贴的 `battle-skills.js` 角色块、marks/summons、`SHEET` 行、`CHAR` fixture、测试清单与文档计数，不直接改源码。把输出贴进文件后再按 `rpg6-battle` 的 DSL 调整。

**用户确认 plan 后才进入实现。** 如果 `engine-gap` 非空，plan 里的 `engine.changes` 要列出每个新 op/钩子及其测试，不能边写边发明。

### 4. 实现

按依赖顺序：

1. **引擎**（有 `engine-gap` 才做）：`state/damage/effect-ops/skills/actions/conditions/timeline/summons`；同步 `rpg6-battle` 的 op/钩子表；补单元测试；升 `data/config.js` 的 `engineVersion`。
2. **数据**：`data/battle-skills.js` 的 `characters`、`marks`、`summons`；`conditionText` 逐字对齐；`unsupported` 写原因。
3. **测试**：`skills.test.mjs` 的 `SHEET`/`CHAR`；每个 implemented 技能至少一条条件不足 + 一条正常释放；多段/召唤/目标选择补引擎用例；`run-all` 补浏览器用例。
4. **文档**：机制文档新一节、plan、`游戏说明`、`架构`、`test.html`、`README` 与 `rpg6-battle` 的数字/能力表。

### 5. 验收

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .dsh/skills/rpg6-character-batch/scripts/verify.ps1 -Plan plan.json
```

默认跑：`plan.mjs --check` → `run.mjs` → `batch --pairs=smoke` → `run-all --group=回合制` → `check.ps1` → `audit-docs.mjs`。没有 Edge 时加 `-SkipBrowser`；要跑全量压测加 `-Full`。

验收看的是：

- 引擎异常 0；僵局按规则分类，不混算
- 新角色在浏览器可选、技能行条件/置灰正确、有召唤物时 844×390 一屏
- `audit-docs` 无计数漂移
- `check.ps1` 提交后仍为 0（gitleaks 只扫 commit）

### 6. 文档与推送

按 `guitu-deploy` 提交；提交信息写清本批角色/技能数与未落地原因。提交后**再跑一次 `check.ps1`**：gitleaks 扫 commit，工作区通过不代表提交后通过；数据里的 `key: "..."` 可能误报，按 `.gitleaks.toml` 的路径 + 行正则放行，不要整文件放行。

## 当前引擎能做什么（2026-11-15 基线）

完整 DSL 见 `rpg6-battle` 与 `_local/docs/回合制6.0测试功能-plan.md`。批量加角色时先看这张表：

| 已具备 | 常用落点 |
|---|---|
| 伤害/强扣/回血/蓝/上限/属性/Buff/状态/标记 | `damage` `directLoss` `heal` `mp` `maxHp` `stat` `buff` `status` `mark` |
| 持续效果/延迟/周期 | `tick`（`unit`、`gate`、`period`、`breakOnSourceStatus`）、`schedule` |
| 随机/多段/连续骰 | `dice`（`times`）、`roll`、`damage.times` |
| 条件/分支/计数器 | `if`（`cond.status/gender/summon/summonCount`）、`counter`、`requires` |
| 召唤物 | `summon` + `summons` 定义 + `state.summons` |
| 被动钩子 | `battleStart` `basicGate` `basicMod` `basicMode` `basicHit` `beforeDamage` `damageDealt` `damageTaken` `statDrained` `afterAction` |
| 目标/群体 | `enemy/self/ally/allEnemies/allAllies/any`；`combatantsOf`；最高嘲讽 + `ignoreTaunt` |
| 费用 | `cost.mp`、`charge`、`cooldown`、`cost.hp`、`costFromLost`、`once` |
| 动态数值 | `{stat}` `{hpPercent}` `{plus}` `{minus}` `{per}` `{mult}` `{counter}` `{mark}` |
| 击溃/蓄力交互 | `breakValue` `forceBreak` `noBreak` `noStun` `noBreakOut`（输出侧）、`chargeUnbreakable`（职业） |

常见**缺口**（分诊会标出来，逐条确认能否用现有组合近似）：

- 护盾、复活/免死、状态快照/回到第 N 回合
- 每回合额外行动、`noBasic`（状态名存在但 basic 侧未接线）、每回合玩家选择/对方对话
- 英雄侧的不可击溃/不可眩晕/免疫 Debuff、法伤专属易伤、伤害转血上限
- 按次数反弹、动态召唤数加成、伤害低于某百分比免疫
- 公式里读「本次伤害值」的表达式（目前 `evalValue` 无 `amount`）

## 计划文件与脚本

| 路径 | 用途 |
|---|---|
| `assets/plan.template.json` | 空计划模板 |
| `assets/plan.example.json` | 赵云哲的真实候选示例（不写入游戏，只演示 schema/scaffold） |
| `scripts/lib.mjs` | 读 seed/library、覆盖率、计数 |
| `scripts/inventory.mjs` | 盘点：`--remaining`、`--character`、`--json` |
| `scripts/triage.mjs` | 缺口分诊：`--remaining`、`--character`、`--json` |
| `scripts/plan.mjs` | `--check` 校验；`--scaffold` 输出数据/测试/文档骨架 |
| `scripts/audit-docs.mjs` | 角色/技能数是否同步 |
| `scripts/verify.ps1` | 计划 + 引擎 + 冒烟 + 浏览器 + check + 文档审计 |

脚本都自动定位仓库根；在仓库任意目录可跑。它们只读源码，只有 `--out` 写脚手架文本，不直接改游戏文件。

## 硬规则

- **逻辑未确认不写代码**；用户确认的是逐技能表，不是「大概懂了」。
- **数据库是唯一数据源**：`characters.js` 只用于离线盘点；角色的 `skills[]`/`condition` 以 DB 为准，e2e 会验；不一致先修再继续。
- **不静默近似**：如果某个效果只能用现有 op 近似，plan 里写 `notes` 并让用户签字；否则标 `engine-gap`/`unsupported`。
- **每个角色至少 1 个 implemented 技能**，否则默认不加；只做预览要用户明确同意。
- **全技能覆盖**：角色块里不能漏掉档案技能；不做的也留 `unsupported`，让界面能解释。
- **`conditionText` 逐字一致**（忽略空白），不一致会被校验器禁用。
- **改规则升 `engineVersion`**；旧战报才会标「旧引擎」。
- **召唤物/新钩子进 `state.hash` 与回放**；否则回放发散。
- **`_local/` 不推送**；机制文档在 `_local` 也要更新。
- **提交后重跑 `check.ps1`**；gitleaks 只扫 commit。
- **同一工作区多会话**：提交前看 `git status` 与 `git log`，别把别人的改动混进来。

## 交付前检查

- [ ] 用户已确认逐技能逻辑表与 plan
- [ ] `plan.mjs --check` 通过；`engine-gap` 都有引擎方案与用户确认
- [ ] `inventory` 的角色/技能计数与文档一致
- [ ] `run.mjs` 全绿；`batch --pairs=smoke` 无引擎异常
- [ ] `run-all --group=回合制` 全绿（含新角色可选、844×390）
- [ ] `check.ps1` 退出码 0（提交后再跑一次）
- [ ] `audit-docs` 无漂移；机制文档新节、plan、游戏说明、架构、test.html 同步
- [ ] 每批的 `unsupported`/`engine-gap` 有可核对原因
- [ ] 提交并推送；`_local/` 未进提交

---
name: rpg6-battle
description: 回合制正传 6.0 的战斗引擎、技能库与对局页。加角色、改技能、改规则、跑引擎单测或批量压测时加载；含代码地图、技能 DSL、已定口径、校验规则与踩过的坑（种子、committed、set 与 add、回合制效果、标记、引擎版本）。
---

# 回合制 6.0 战斗模块

## 什么时候加载

- 往技能库里加一个能上场的角色，或改已有技能
- 改伤害、取整、速度条、击溃、Buff、标记这类规则
- 对局页（`rpg6.0/test.html`）或战报（`battles.html`）出问题
- 要跑引擎单测 / 批量压测，或怀疑数值对不上

## 代码地图

| 路径 | 职责 |
|---|---|
| `rpg6.0/js/engine/rng.js` | 种子随机，`state.rng` 可序列化 |
| `.../rules.js` | 常量、取整、三种伤害、Buff 乘算、速度条推演 |
| `.../traits.js` | 8 主业 + 6 副业；主业/副业写反也能查（两张表都找） |
| `.../state.js` | 建单位、面板结算（set→add→mul）、标记、深拷贝、指纹 |
| `.../damage.js` | 伤害/回血/强扣、击溃值、蓄力打断、不会死亡、死亡判定 |
| `.../effect-ops.js` | 效果解释器（27 个 op）、持续效果计时、反射、打断、标记 |
| `.../timeline.js` | 标准回合、速度条、行动队列、跳过无法行动者 |
| `.../conditions.js` | 技能条件（蓝/力/冷却/封锁/一次性/标记门槛） |
| `.../skills.js` | 技能执行、蓄力、校验、被动钩子、标记初始化 |
| `.../actions.js` | 普攻/击溃/蓄蓝，普攻前被动改判 |
| `.../battle.js` | 门面：create / apply / available / hash / replay |
| `rpg6.0/data/battle-skills.js` | 角色技能与标记声明（唯一数据源） |
| `rpg6.0/js/battle/*` | 渲染、选中状态、战报、页面装配 |
| `_local/tests/engine/run.mjs` | 引擎单测入口 |
| `_local/tests/engine/batch.mjs` | 两两配对压测与僵局分类 |

规则文档与逐条裁定：`_local/docs/回合制6.0测试功能-plan.md`、`_local/docs/回合制6.0测试功能-角色机制.md`。

## 加一个能上场的角色

1. 档案里已经有这个角色（`rpg6.0` 的角色表或 `data/characters.js` 兜底），`skills[]` 有名称与条件文本。
2. 在 `data/battle-skills.js` 的 `characters` 下加一个角色块，每条技能：
   - `conditionText` **与档案逐字一致**（忽略空白），否则 `skills.validate` 会把这条技能标成不可用；
   - `target` 取值 `enemy / ally / self / allEnemies / allAllies / any`；
   - 条件里写到的蓝、力、冷却，要和 `conditionText` 对得上（`cost.mp`、`charge`、`cooldown`）。
3. 需要计数器就在同文件的 `marks` 里声明 `{ key, name, max, init }`，技能用 `mark` / `markClear` 读写，用 `requires` 卡层数。
4. 跑 `run.mjs`，把新角色补进 `skills.test.mjs` 的 `SHEET` 与 `CHAR`，再跑一次批量压测冒烟。

## 技能 DSL 速查

- op 全表见 plan 第 5 节；常用的：`damage`（`type` 可为 `phys/magic/true/last/basic`、`times`、`noBreak`、`fromBuff`、`healBack`、`factor`）、`directLoss`、`heal`、`mp`、`maxHp`/`maxMp`、`stat`、`buff`、`status`、`breakValue`、`forceBreak`、`tick`、`schedule`、`reflect`、`interrupt`、`dispel`、`dice`、`if`、`counter`、`mark`、`dispel marks`、`use`、`note`。
- 数值表达式：常量、`{stat:"self.atk"}`、`{per:…,factor}`、`{hpPercent:"self.lost",percent}`、`{plus:[…]}`、`{minus:[…]}`、`{counter:"…"}`、`{mark:"…"}`。
- 技能字段：`cost.mp`、`charge`、`cooldown`、`once`、`requires`、`chargeOps`（蓄力时生效，如肥肥反弹）、`hooks.basicMod`（普攻前改判）、`hooks.basicHit`/`breakAction`（被动）、`unsupported`（本版不做，界面置灰并显示原因）。

## 已经定死的口径（不要再改）

| 项 | 结论 |
|---|---|
| 法伤 | `攻击 ÷ 100 × (100 − 法抗)`，结果 round5；法抗 ≥100 为 0 |
| 取整 | 伤害与回血结果向 5 的倍数上取整；技能文本写了取整方式的优先 |
| 强扣 | 不减免、不加击溃值 |
| 击溃 | 是一次行动，需击溃值 ≥3；击溃状态 `(击溃值−1)×2` 标准回合 |
| 眩晕 | 只由技能给，防御与法抗视为 0 |
| 蓄蓝/蓄力 | 各消耗 1 行动；力绑定单个技能 |
| 先手 | 速度低者先，同速开局用种子随机 |
| 计时 | 持续效果施加当回合就扣一层（回合结束时 −1） |
| 混伤 | 同时造成等量普伤与真伤两段 |
| 标记 | 对手可见、可被对手技能削减或清空 |

## 测试

```powershell
$node = (Get-ChildItem "$env:USERPROFILE\.dsh\dsh-runtimes\*\dependencies\node\bin\node.exe" |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName   # 本机 PATH 没有 node

& $node _local/tests/engine/run.mjs
& $node _local/tests/engine/batch.mjs --seeds=4
& $node _local/tests/engine/batch.mjs --pairs=smoke --seeds=1
& powershell -NoProfile -ExecutionPolicy Bypass -File tools\check.ps1
```

压测把「引擎异常」与「僵局」分开算：异常（崩溃、越界、残留状态、重放不一致）才算失败；僵局是规则问题，列进报告。

## 踩过的坑

1. **`state.seed` 存原始种子**，`state.rng` 存随机数状态。把混淆后的值再喂回 `createBattle` 会让回放从第一步发散。
2. **战报存 `committed` 动作**。点技能但蓄力不足时引擎会把动作归一化成 `charge`，存原始动作会重放出不同结果。
3. **`set` 不会清掉已有的 `add`**。要封顶就加「差值」而不是 `set` 一个绝对值（宋知远·电摩冲击）。
4. **回合制效果看 `unit` 字段**（`selfRound`/`targetRound`），以前按 `"turn"` 过滤导致永远不触发；现在由 `isDueForTurn` 判断是谁的回合。
5. **状态/Buff 事件要带 `label`**，否则界面提示会显示内部 kind。
6. **标记必须先声明**，没声明就 `return`，不会报错也不会生效。
7. **技能条件与档案不一致会被禁用**，这是特性不是 bug；改档案后要同步 `conditionText`。
8. **改了规则就升 `data/config.js` 的 `engineVersion`**，旧战报才会被标成「旧引擎战报」。
9. **`docgen` 只扫模块根下的 `js/*.js`**，`js/engine/` 与 `js/battle/` 不进架构图，说明写在 `rpg6.0/架构.md` 手写区。
10. **技能禁用与点击**：只有「不是这个角色的回合」才拦截点击；条件不满足（缺蓝、层数不够）要放行点击并给出原因。
11. **随机策略跑久了必然撞僵局**（治疗抵平、击溃锁死），先分类再判断是不是 bug。
12. **取整只做一次**：多段伤害每段各自 round5，Buff 乘算合并成一个乘数再取整。

## 交付前检查

- [ ] `run.mjs` 全绿
- [ ] `batch --pairs=smoke` 无引擎异常
- [ ] `check.ps1` 退出码 0
- [ ] 文档里的角色数/技能数同步（`test.html` 提示、`rpg6.0/README.md`、`架构.md`、plan、机制文档）
- [ ] 新角色写进机制文档，`unsupported` 的技能写明原因

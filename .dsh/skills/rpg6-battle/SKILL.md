---
name: rpg6-battle
description: 回合制正传 6.0 的战斗引擎、技能库、召唤物与对局页。加角色（含召唤物）、改技能、改规则、跑引擎单测/批量压测/浏览器用例时加载；含代码地图、技能 DSL、召唤物口径、已定规则、校验与踩坑（种子、committed、set 与 add、标准回合、标记、引擎版本）。
---

# 回合制 6.0 战斗模块

## 什么时候加载

- 往技能库里加一个能上场的角色，或改已有技能
- 改伤害、取整、速度条、击溃、Buff、标记这类规则
- 对局页（`rpg6.0/test.html`）或战报（`battles.html`）出问题
- 要跑引擎单测 / 批量压测，或怀疑数值对不上
- 要**批量**加一批角色（选人、逐条确认逻辑、可行性分诊、plan、验收）时，先加载 `rpg6-character-batch`；本 skill 负责 DSL 与引擎细节

## 代码地图

| 路径 | 职责 |
|---|---|
| `rpg6.0/js/engine/rng.js` | 种子随机，`state.rng` 可序列化 |
| `.../rules.js` | 常量、取整、三种伤害、Buff 乘算、速度条推演 |
| `.../traits.js` | 8 主业 + 6 副业；主业/副业写反也能查（两张表都找）；`ignoreTaunt` |
| `.../state.js` | 建单位、面板结算（set→add→mul）、标记、`summons/side/hpLost`、深拷贝、指纹 |
| `.../damage.js` | 伤害/回血/强扣、击溃值、蓄力打断、不会死亡、英雄/召唤物死亡判定 |
| `.../effect-ops.js` | 效果解释器框架、注册表与出口（opNames 从注册表推导）、群体目标 `sideUnits`、持续效果/周期计时、反射、打断、标记；op 实现按伤害/状态/流程拆在 `ops/`，helpers 在 `effect-ops-helpers.js` |
| `.../timeline.js` | 标准回合、速度条、行动队列、跳过无法行动者；空回合会连续推进 |
| `.../conditions.js` | 技能条件（蓝/力/冷却/封锁/一次性/标记门槛、`costFromLost` 动态费用） |
| `.../skills.js` | 技能执行、蓄力、校验、动态费用、嘲讽、被动钩子、标记初始化 |
| `.../summons.js` | 召唤物创建/移除/上限/计时/光环/到期自爆/按速度攒条的自动攻击 |
| `.../actions.js` | 普攻/击溃/蓄蓝、普攻前改判、`afterAction` 行动后钩子 |
| `.../battle.js` | 门面：create / apply / available / hash / replay |
| `rpg6.0/data/skills/` | 角色技能、标记、`summons` 召唤物定义（唯一数据源；一个角色一个文件，`index.js` 聚合） |
| `rpg6.0/js/battle/*` | 渲染（五块 + 折叠 + 召唤物带）、选中状态、嘲讽目标、战报、页面装配（存档/回放与界面细节拆在 battle-page-record.js / battle-page-ui.js） |
| `_local/tests/engine/run.mjs` | 引擎单测入口 |
| `_local/tests/engine/batch.mjs` | 两两配对压测与僵局分类 |
| `_local/tests/cases/rpg-battle.mjs` | 浏览器用例（19 人可选、召唤物带、墓回血、844×390） |

规则文档与逐条裁定：`_local/docs/回合制6.0测试功能-plan.md`、`_local/docs/回合制6.0测试功能-角色机制.md`（第 13 节是召唤物批次）。当前 <!-- RPG6-STATS:START charsSkillsShort -->25 人 88 条技能<!-- RPG6-STATS:END charsSkillsShort -->，引擎 `<!-- RPG6-STATS:START version -->6.0-engine.10<!-- RPG6-STATS:END version -->`；`test.html` 只引一个模块入口 `js/battle/entry.js`（引擎与技能库由它 import，另有 <!-- RPG6-STATS:START scripts -->7<!-- RPG6-STATS:END scripts --> 个经典 `<script>`），`summons.js` 在 `skills.js` 之后、`actions.js` 之前（顺序见 `js/engine/index.js`）。数字不要手改，跑 `node _local/tools/rpg6-stats.js --write`。

## 加一个能上场的角色

单个角色可按本节手写；批量/多角色用 `rpg6-character-batch` 的 `plan.mjs`/`--scaffold`/`verify.ps1`，避免漏技能、漏 unsupported 原因和计数漂移。

1. 档案里已经有这个角色（`rpg6.0` 的角色表或 `data/characters.js` 兜底），`skills[]` 有名称与条件文本。
2. 在 `data/skills/` 新建该角色的文件（拼音命名，`export default [...]`）并在 `index.js` 的 `characters` 里登记，每条技能：
   - `conditionText` **与档案逐字一致**（忽略空白），否则 `skills.validate` 会把这条技能标成不可用；
   - `target` 取值 `enemy / ally / self / allEnemies / allAllies / any`；
   - 条件里写到的蓝、力、冷却，要和 `conditionText` 对得上（`cost.mp`、`charge`、`cooldown`）；有累计失血降费就加 `costFromLost:{per}`。
3. 需要计数器就在 `index.js` 的 `marks` 里声明 `{ key, name, max, init }`，技能用 `mark` / `markClear` 读写，用 `requires` 卡层数。
4. 要生成召唤物：
   - 在 `index.js` 的 `summons` 块加定义（`stats`、`ttl`、`targetable`、`breakImmune`、`taunt`、`aura`、`attack`、`onExpire`）；
   - 技能 ops 写 `{op:"summon", key:"..."}`；
   - 记住无血计时物 `targetable:false`，有血单位才会进单体目标列表。
5. 跑 `node _local/tools/rpg6-lint.js`：op 名、字段、mark/counter/summon 引用、锚点、版本号，一次报全；再跑 `run.mjs`，把新角色补进 `skills.test.mjs` 的 `SHEET` 与 `CHAR`，再跑一次批量压测冒烟；有召唤物/目标选择就补一条浏览器用例。
6. 在机制文档里给每条技能加锚点 `<!-- skill:角色拼音.技能 -->`（`### 1.1 技能名（条件） <!-- skill:... -->` 或 `- **技能名（条件）** <!-- skill:... -->：`），漏了 lint 会按「缺少锚点」报。
7. 跑 `node _local/tools/rpg6-stats.js --write` 把 `test.html` 之外的计数写回 `游戏说明.md`、`架构.md` 机制文档、`README.md` 和本 skill；`test.html` 的数字是运行时算的，不用改。计数不要手写，`--check` 会抓住。

## 技能 DSL 速查

- op 全表见 plan 第 5 节（由 `_local/tools/rpg6-stats.js` 生成，来源是 op 注册表，即 `engine/ops/` 里的 `registerOp`）；常用：`damage`（`type` 可为 `phys/magic/true/last/basic`、`times`、`noBreak`、`addStun`、`fromBuff`、`healBack`、`factor`）、`directLoss`、`heal`、`mp`、`maxHp`/`maxMp`、`stat`（可带 `restore`）、`buff`、`status`、`breakValue`、`forceBreak`、`tick`（可带 `breakOnHolderStatus`）、`schedule`、`reflect`、`interrupt`、`dispel`、`dice`（`times` 连续独立掷）、`if`、`counter`、`mark`、`markClear`、`clearMods`（可带 `stats` 只清指定属性）、`summon`（`key`）、`setBasicMode`、`strike`、`deny`、`roll`、`use`、`note`。
- `tick` 的 `period` 表示每 N 个标准回合才结算一次（王霸之气 3 回合），`gate` 是行动前掷骰跳过，`breakOnSourceStatus` 是来源被击晕/击溃即断；`dice` 的 `times` 用于涌泉相报这类连续独立骰。
- 群体目标：`who:"allEnemies"` = 敌方英雄 + 有血召唤物；`who:"allAllies"` = 己方英雄（不含召唤物）。技能 `target:"allEnemies"/"allAllies"` 时，默认 `who:"target"` 会自动展开到对应群体。
- 数值表达式：常量、`{stat:"self.atk"}`、`{per:…,factor}`、`{hpPercent:"self.lost",percent}`、`{plus:[…]}`、`{minus:[…]}`、`{counter:"…"}`、`{mark:"…"}`、`{summonCount:"key"}`（己方该召唤物存活数量）。
- 技能字段：`cost.mp`、`charge`、`cooldown`、`once`、`costFromLost:{per}`、`requires`、`chargeOps`（蓄力时生效，如肥肥反弹）、`hooks.basicMod`（普攻前改判）、`hooks.basicMode`（把普攻改成给召唤物回血）、`hooks.basicHit`/`breakAction`（被动）、`hooks.afterAction`（每个动作结束后）、`unsupported`（本版不做，界面置灰并显示原因）。
- 召唤物定义字段：`name`、`stats:{atk,def,mres,hp,mp,spd}`、`ttl`、`targetable`、`breakImmune`、`taunt`、`aura`（每标准回合末）、`attack`（按速度攒行动条，满 100 出手一次，所以 `stats.spd` 必须为正数）、`onExpire`（到期）；无 `stats.hp`/`hp:0` 就是无血计时物。

## 召唤物与目标（第四批）

- `state.summons` 独立于 `state.units`：不进速度条、不占行动、不获得角色回合；英雄死亡立即 `clearSide`，胜负只看英雄。
- 有血召唤物 `targetable:true` 才能被单体选中；无血计时物 `hp:0`、`targetable:false`，只显示虚线 chip。判活用 `targetable ? hp>0 : true`，不要用 `hp>0` 一刀切（否则计时物永远不 tick）。
- 单体选目标先在该侧 `combatantsOf` 里取最高嘲讽，只有最高者可选；`射手` 的 `ignoreTaunt` 例外。召唤物默认嘲讽 0。
- 普攻可指定有血召唤物；羊书含的普攻是「给墓回血」这个特例，`basicHealTarget` 要同时接进 `requireTarget`、`onBasic`、`basicAttack`。
- 召唤物造成的伤害**一律**不造成击溃/眩晕（`damage.hit` 里按 `source.isSummon` 强制），不要只依赖数据里的 `noBreak`；也不触发召唤者的「造成伤害」类被动。
- 标准回合末顺序：`aura → attack 行动条 → 到期 onExpire → ttl-1`；`attack` 按自身速度攒条（每标准回合末 +速度，满 100 打一次；速度 10 = 每 10 个标准回合一次），攒满那一拍无法行动则作废；`breakImmune` 免疫击溃。`period` 按 `bornRound` 计算，`bornRound` 至少为 1（`battleStart` 时 `state.round` 是 0）。
- 速度条会跨过没有单位可行动的空标准回合；`beginTurn` 会连续调 `roundEnd`。所以召唤物/持续效果会按**每个**标准回合结算，UI 下一次渲染时 ttl 可能已经从 4 跳到 1；浏览器用例断言日志/召唤事件，别断言「刚召唤时一定看到剩 4」。
- 累计失血 `hpLost` 在 `damage`、`directLoss`、血上限被压低导致当前血下降时增加；治疗不回退。羊书含墓的 `costFromLost` 按它实时算。
- 召唤物进 `state.hash`（uid/side/key/hp/gauge/ttl/状态/效果/标记/hpLost），回放和旧战报按版本区分。
- UI：角色卡底部召唤物带；`[data-summon]` 点击要先于 `[data-unit]` 处理；目标选择时在 `targetsOf`/`onBasic` 用 `combatantsOf` + 最高嘲讽，不要再用 `otherUid` 只给英雄。

## 已经定死的口径（不要再改）

| 项 | 结论 |
|---|---|
| 法伤 | `攻击 ÷ 100 × (100 − 法抗)`，结果 round5；法抗 ≥100 为 0 |
| 取整 | 伤害与回血结果向 5 的倍数上取整；技能文本写了取整方式的优先 |
| 强扣 | 不减免、不加击溃值 |
| 击溃 | 是一次行动，需击溃值 ≥3；击溃状态 `(击溃值−1)×2` 标准回合 |
| 眩晕 | 只由技能给，防御与法抗视为 0 |
| 眩晕值 | **默认伤害不加**；伤害 op 标 `addStun` 才 +1，上限 5。只有技能文本明确写「造成/算眩晕值」才标 |
| 眩晕余波 | `daze` 状态不阻止行动，但防御、法抗视为 0；`duration:{unit:"turnStart",count:N}` 在该单位回合开始时计时 |
| 击溃值 | 常规伤害默认 +1（`noBreak` 或 Buff 持续伤害除外）；`tick.breakOnHolderStatus` 让持续效果在持有者进入击溃时立即结束 |
| 对手标记 | `marks[角色][]` 里写 `on:"opponent"` 的标记不挂自己，建单位后挂到对方英雄 |
| 归零恢复 | `stat` 用 `mode:"set"` + `restore:N`：记住改动前原值，每标准回合 +N，最后一跳补足后移除 |
| 蓄蓝/蓄力 | 各消耗 1 行动；力绑定单个技能 |
| 先手 | 速度低者先，同速开局用种子随机 |
| 混伤 | 同时造成等量普伤与真伤两段 |
| 标记 | 对手可见、可被对手技能削减或清空 |
| 召唤物 | 独立单位、不进英雄速度条；无血计时物不可选；伤害无击溃/眩晕；`attack` 按自身速度攒条（每 100/速度 个标准回合一次，速度 10 = 每 10 回合；攒满那一拍无法行动则作废）；死亡不判负，英雄死亡清场 |
| 嘲讽 | 单体选目标取该侧最高；召唤物默认 0；射手 `ignoreTaunt` 例外 |
| 动态费用 | `costFromLost:{per}` 按累计失血每 per 点降 1 蓝 1 力，最低 0；费用在每次蓄力/释放时重算 |
| 标准回合 | 持续效果施加当回合就扣一层；空标准回合也会推进（一次 `apply` 可能跨多个 `roundEnd`） |
| 蓄力打断 | 受到非 Buff 伤害清空力；**盾卫与重装例外**（`traits.chargeUnbreakable`），「肥肥反弹」蓄力时也不打断 |
| 受击掷骰免疫 | `rollDodge:{sides,values}` 在 `damage.hit` 最前面、每段伤害各掷一次；命中就整体不结算（不掉血、不加击溃/眩晕值、不清蓄力、不触发命中后被动）；对 Buff 持续伤害、反弹、被动强制普攻同样生效；强扣不是伤害，不掷 |
| Buff 免疫 | `buffImmune:[kind]` 由 `skills.immuneBuffs` 汇总，`addBuff` 拦截并推 `buffImmune` 事件；标准回合开始再兜底清一次。与召唤物的 `breakImmune` 不是一回事 |
| 标准回合开始钩子 | `roundStart`，在速度条结算之前跑（宋知远血 ≤600 回 25） |
| 防护层 `guard` | 挂在 `tick` 上：`{remaining,onBreak,ops}`，每次伤害取消一次（同一动作多段只算一次，靠 `actionId` 去重）；`onBreak` 让击溃也触发；用完移除并执行 `ops`（目标取敌方英雄）；配 `immune.buffs/statuses`、`breakImmune`、`chargeGuard`、`enemyNoSkill`、`selfNoBasic`；进 hash |
| 护盾 | `shield` op → `unit.shield`：独立血量池，`damage.hit` 全额吸收、不扣血，破盾多余伤害消失；强扣穿透；标准回合末计时，到期执行 `onExpire`（坚若磐石 +5 防），提前破盾不加防；进 hash |
| 动态普攻面板 | 技能库 `panels:{角色:{atk}}` 覆盖面板，`basicAtk:{角色:表达式}` 算实际攻击值，优先级高于面板与 Buff 修正（孙嘉怿：面板 0、普攻按目标当前血 20%）；界面攻击栏显示 `−` 加注记 |
| 解锁动作 | `kind:"unlock"`：`actions.list` 在单位身上有 `lockAtk/lockDef/lockMres`（0=未解锁）时列出，支付 1 蓝解锁一个，不消耗行动、可重复、全部解锁后隐藏；解锁后 3 标准回合用 `schedule` 写回原值（原值开局存 counter） |
| 防御代价 | `cost.def`：`conditions` 判防御是否足够（不足置灰），`releaseSkill` 扣永久防御，可到 0 |
| 无动作兜底 | 被锁到没有任何可选动作时（下潜 + 旋转同时锁普攻与蓄力、蓝已满），`actions.list` 追加 `basic/pass`「跳过本回合」 |

## 手机横屏与折叠（对局页）

- **断点**：`(orientation: landscape) and (max-height: 520px)`。不要用 `max-width`——手机横屏宽 844px，会被当成竖屏走单列，一屏要滑三屏。
- **遮罩**：JS 判「粗指针 + `maxTouchPoints > 0` + 视口短边 ≤520」才给 `<html>` 加 `is-phone`，CSS 只在 `is-phone` + 竖屏显示。唯一按钮 = 请求全屏 + `screen.orientation.lock("landscape")`；iOS 没有该 API，退化成「请手动横过来」。不要加第二个出口。
- **一屏布局**：`html.is-battle` 隐藏站点 header/footer；`.battle-page` 锁 `100dvh`；grid 两列（`speed` / `unitA unitB` / `queryA queryB` / `log`），各格自己滚，页面不滚。角色卡底部的召唤物带在紧凑断点下 `flex-wrap:nowrap + overflow-x:auto`，只占一行；844×390 带墓的用例已断言 `docH <= vh`。
- **四处折叠**（状态都在 JS 变量里，`render()` 重建 DOM 后按它恢复，不要直接读 DOM）：
  - 速度条、战斗日志：原生 `<details>`；`speedOpen` / `battleLogOpen`。
  - 展开态统一 `position: fixed; inset: 0` 铺满视口，`<summary>` 用 `position: sticky` 顶住当关闭入口；这套规则**只写在紧凑断点里**。战斗日志桌面与手机都输出 `<details>`（`renderBattleLog(state, open, preview)`），桌面传 `preview`（`!compact`）在 `<summary>` 里预览上一个有效回合（`renderLogPreview` 找最近一个有非 `is-round` 展示事件的标准回合，不含「第 N 标准回合」分隔行），展开时高度用 `matchLogHeight()` 对齐速度条面板实测高度；手机传 `preview=false`、只留标题行。
  - 伤害记录（手机独有）：绝对定位浮层，靠 `.battle-unit { overflow: visible }` 才盖得出去；高度由 `applyLogPanel()` 现算——`max-height` 取「卡片底边 → 底栏顶边」，`min-height` 至少盖到整张技能卡，少了会露出半行技能文字；`.bu-status` 要 `position: relative; z-index: 4`，否则浮层可能盖住自己的「收起」按钮。
  - Buff 详情：手机没有 hover，点 chip 弹气泡（`data-detail` + `BattleView.chipDetail`），点别处或滚动关闭。
- **改完必看两个视口**：844×390（不滚、双方并排、操作栏可见；有召唤物时召唤物带只占一行）与 1280×900（战斗日志是 `DETAILS`、`position: static`、默认 `open`，展开高度与速度条面板对齐）。

## 测试

```powershell
$node = (Get-ChildItem "$env:USERPROFILE\.dsh\dsh-runtimes\*\dependencies\node\bin\node.exe" |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName   # 本机 PATH 没有 node

& $node _local/tests/engine/run.mjs
& $node _local/tests/engine/batch.mjs --pairs=smoke --seeds=1
& $node _local/tests/engine/batch.mjs --seeds=4
& $node _local/tools/rpg6-lint.js
& $node _local/tools/rpg6-stats.js --check
& $node _local/tests/run-all.mjs --group=回合制
& powershell -NoProfile -ExecutionPolicy Bypass -File tools\check.ps1
```

压测把「引擎异常」与「僵局」分开算：异常（崩溃、越界、残留状态、重放不一致）才算失败；僵局是规则问题，列进报告。浏览器用例需要本机 Edge，不需要令牌；跑完会把战报写进数据库。当前基线：引擎单测 158 条（含 `lint.test.mjs` 14 条）、浏览器 12 条；19 人 4 seed 压测 0 引擎异常（2026-11-15 加「皮糙肉厚」后 20 局僵局，全是宋知远/江雨轩的盾卫回血，规则问题不是引擎异常）。

`rpg6-lint.js` 与 `rpg6-stats.js --check` 已经挂在 `check.ps1` 里，单跑是为了看细项。`--warn` 只提醒不阻断，`--json` 给机器读；`rpg6-stats.js --write` 改数字，手改会被 `--check` 抓。

## 交付前检查

- [ ] `run.mjs` 全绿
- [ ] `batch --pairs=smoke` 无引擎异常
- [ ] `rpg6-lint.js` 退出码 0（结构、锚点、版本号）
- [ ] `rpg6-stats.js --check` 退出码 0（文档数字；改了数据先 `--write`）
- [ ] `run-all.mjs --group=回合制` 全绿（含 `844×390` 横屏用例；带召唤物时一屏）
- [ ] `check.ps1` 退出码 0
- [ ] 文档里的角色数/技能数由 `rpg6-stats.js --write` 写回，没有手写数字（`test.html` 是运行时算的）
- [ ] 新角色写进机制文档并带 `<!-- skill:id -->` 锚点，`unsupported` 的技能写明原因；召唤物写进 `summons` 块与 `state.hash`
- [ ] 动过对局页：桌面 1280×900 与手机 844×390 各截一张图核对，确认没有任何一块要横向滚动
- [ ] 会话要归档时，把新增口径/命令/坑写进本 skill 和根 `AGENTS.md`，再推送

## 踩过的坑

见 同目录 [踩过的坑.md](踩过的坑.md)。


# rpg6.0 —— 回合制正传 6.0 角色档案

以档案形式维护回合制正传 6.0 的角色与规则：角色公开查阅、开放投稿、成员编撰与审核；规则只由开发人员改代码编撰。
`test.html` 是可以真打一局的 1v1 对局测试页，`battles.html` 是战报列表。对局功能的玩法、引擎、技能库、测试与未完成项另有一份交接文档：[游戏说明.md](游戏说明.md)。

## 五条硬规则

1. **图片只能随投稿进入系统。** 建档后图片只读；审核转正时也不能改图。
2. **没有「新增角色」入口。** 新角色只能由「投稿 → 审核 → 转正」产生。
3. **审核时的修改不写回投稿。** 改动只写进角色表，投稿行只更新状态、审核人、审核时间与备注。
4. **规则只能由开发人员改代码。** 正文写在 `data/rule-docs.js`，网页上没有编辑入口，也不进数据库。
5. **战报只增不改。** 匿名只能插入与读取，没有 update / delete 权限；写错的战报要 service_role 手工删。唯一会删的是 30 天前的旧战报，由 `rpg_battles_purge()` 负责。

## 页面

### 公开（不需要验证）

| 文件 | 作用 |
|---|---|
| `rpg6.0.html` | 角色列表：关键词、评级、职业筛选，时间正序/倒序，12 条一页。不显示图片 |
| `character.html?id=` | 角色详情。图片折叠在页面最底部，默认收起；审核人与最近编辑各一行；底部「上一个 / 下一个」沿用列表的筛选与排序 |
| `rules.html` | 规则列表：只有条目名，点进去看正文；不读数据库，无搜索框 |
| `rule.html?id=` | 规则正文。内容来自 `data/rule-docs.js`，公开只读 |
| `provide-tip.html` | 投稿表单，文本 + 图片，不需要验证 |
| `test.html` | 对局测试：选两名角色开打，1v1 双方手动；结束后战报自动入库，`?record=` 回放，回放可从中间某一步接管继续打。手机竖屏会被「请横屏」遮罩挡住，横屏下走紧凑布局（导航隐藏、双方并排、页面不滚） |
| `battles.html` | 战报列表，所有人共享，可按参与角色筛选；时间倒序，每页 20 条可加载更多，点开即逐步回放；进页面顺手删掉 30 天前的记录 |

### 编辑区（需要组织验证）

| 文件 | 作用 |
|---|---|
| `edit-characters.html` | 编撰列表：全部角色（含已删除），编辑 / 删除 / 恢复 |
| `edit-character.html?id=` | 角色编辑器；`?submission=` 时是审核转正表单 |
| `review.html` | 投稿审核：待审 / 已通过 / 已驳回 |
| `old-characters.html` | 旧档案总览 |
| `old-character.html?id=` | 某角色的全部历史版本，可恢复已删除角色 |
| `version.html?v=` | 单版本只读，可「应用这个版本」 |

## 脚本

```
js/
├── rpg-data.js        数据层：所有数据库读写的唯一出口（写入/版本/投稿在 rpg-data-write.js，战报在 rpg-data-battles.js，两片先加载）
├── rpg-form.js        表单渲染/收集/校验、人员下拉、确认框、图片上传
├── list.js            公开列表
├── character.js       角色详情
├── rules.js           规则列表
├── rule.js            单条规则
├── provide-tip.js     投稿
├── review.js          投稿审核
├── edit-characters.js 编撰列表
├── edit-character.js  编辑器 / 转正表单
├── old-characters.js  旧档案总览
├── old-character.js   某角色的历史版本
├── version.js         单版本查看
├── engine/            战斗引擎（纯函数，不碰 DOM）
│   ├── version.js     引擎版本号，唯一来源
│   ├── rng.js         种子随机
│   ├── rules.js       数值与公式（取整、三种伤害、速度条）
│   ├── traits.js      8 主业 + 6 副业
│   ├── state.js       建局、面板结算、深拷贝、状态指纹
│   ├── damage.js      伤害/回血/强扣/死亡
│   ├── effect-ops.js  效果解释器框架、注册表与出口（opNames 从注册表推导；helpers 在 effect-ops-helpers.js，op 实现按伤害/状态/流程拆在 ops/）
│   ├── timeline.js    标准回合、速度条、行动队列
│   ├── conditions.js  技能条件
│   ├── skills.js      技能执行、校验与被动钩子
│   ├── skills-target.js 单体目标校验、嘲讽最高的可选集合、普攻模式
│   ├── summons.js     召唤物：创建、计时、光环、自动攻击
│   ├── actions.js     普攻/击溃/蓄蓝
│   └── battle.js      门面：create / apply / available / hash / replay
└── battle/            对局界面
    ├── battle-view.js 三板块渲染与速度条预测（事件行与效果文案在 battle-view-effects.js）
    ├── battle-pick.js 选中状态
    ├── battle-record.js 战报构建与回放
    ├── battle-page-bind.js 事件绑定（DOM 事件接到 P 上的处理函数）
    ├── battle-page.js 页面装配（存档/回放在 battle-page-record.js、界面细节在 battle-page-ui.js、事件在 battle-page-bind.js，三片先加载）
    └── battle-list.js 战报列表
```

角色页面脚本只依赖 `rpg-data.js` 与 `rpg-form.js`，彼此之间没有横向依赖；规则两页只读 `data/rule-docs.js`。
对局页另外按顺序加载 `js/engine/*` 与 `js/battle/*`，引擎之间靠 `window.RPG6B` 组合，见 [架构.md](架构.md) 的「战斗引擎」一节。

## 数据

数据在腾讯云 CloudBase（PostgreSQL），六张表：

| 表 | 说明 |
|---|---|
| `rpg_characters` | 角色。软删除用 `deleted`，作者与人员字段都在这里 |
| `rpg_character_versions` | 旧档案，只增不改，`applied` 标记已应用 |
| `rpg_submissions` | 投稿，`status` ∈ pending / approved / rejected |
| `rpg_battles` | 战报：种子 + 双方角色 id + 归一化动作序列 + 最终指纹；匿名只读、只插，不可改删；30 天前的记录由 `rpg_battles_purge()` 删除 |
| `rpg_rooms` | 联机房间：8 位房间码、状态、引擎版本、种子、双方角色与昵称、座位密钥 md5、结局与计数；匿名不可直读，只走 `rpc/rpg_room_*` |
| `rpg_room_actions` | 联机动作日志：房间码 + 递增序号、座位、`committed` 动作、该步状态指纹；同样只走 RPC |

两个只读函数：`rpg_search`（筛选 + 分页 + 总数）、`rpg_facets`（筛选下拉的选项）。
迁移脚本在 `_local/sql/rpg-setup.sql`，旧档案导入在 `_local/sql/rpg-seed-characters.sql`。
联机两张表的迁移在 `_local/sql/rpg-room-setup.sql`（不提交），须在 CloudBase 控制台执行；没执行时 `rpc/rpg_room_*` 返回 `PGRST202`，页面只提示「联机服务未部署」，热座不受影响。

`data/seeds/characters.js` 是 33 条内置副本，**只在云端不可用时兜底**；正常页面只读数据库。副本由 `_local/tools/gen-rpg-seed.js` 生成，拆成 4 个文件（characters-2/3/4.js 只做 push）。

`data/skills/` 是技能库（角色技能 + marks + summons）：一个角色一个文件，`index.js` 聚合并导出。

## 技能 op 表

由 `effect-ops.js` 的 `opNames` 与 `rpg6-spec.js` 的参数字典生成，不要手改；改 op 后跑 `node tools/rpg6-stats.js --write`。

<!-- RPG6-STATS:START ops-table -->
| op | 参数 | 作用 |
|---|---|---|
| `ask` | `kind` answer/guess、`key` 响应 key、`sides` guess 面数，默认 6、`prompt` 弹窗文案、`options` answer 选项数组、`default` answer 默认选项、`value` guess 要比对的数值表达式 | 挂起等待对方选择：answer 选首项走 then、否则走 else；guess 猜中走 then、否则走 else |
| `breakValue` | `delta` 必填 | 击溃值增减，钳制在 0..上限 |
| `buff` | `kind` strong/fragile/brave/panic、`percent` 必填、`duration`、`stacking` false 则不叠层 | 四类 Buff |
| `clearMods` | `source` 来源标记、`stats` 属性名数组 | 按来源移除属性修正，`stats` 只清指定属性 |
| `clearSummons` | `who` self 或侧 | 清除一侧全部召唤物 |
| `convert` | `to` 必填 | 配合 beforeDamage 钩子：把这次受击标记为伤害转血上限（不扣血、等量加血上限） |
| `counter` | `key` 必填、`delta` 默认 +1、`perTarget` 默认 true | 计数器增减，供 `{counter}` 读取 |
| `damage` | `value` 必填、`type` phys/magic/true/last/basic、`times` 段数、`factor` 倍率、`noBreak`、`addStun` 计眩晕值、`fromBuff`、`healBack` | 造成伤害；默认只加击溃值，`addStun` 才加眩晕值；`healBack` 按造成的伤害给自己回血 |
| `decay` | `kind` 必填、`delta` 必填 | 把目标身上指定 kind 的 Buff 百分比减 delta，减到 0 移除（我是天才的勇猛逐回合 −20%） |
| `deny` | `reason` | 否决这次动作，`reason` 显示给玩家 |
| `dice` | `sides` 默认 6、`times` 掷几次、`cases` [{in|roll, ops}]、`else` 都没命中时 | 掷骰分支；`times` 连续独立掷 |
| `directLoss` | `value` 必填 | 强扣：不减免、不加击溃值 |
| `dispel` | `scope` debuff/all/status/marked/breakValue/marks，默认 debuff | 清 Debuff / 清异常状态 / 清带标记的负面修正 / 清击溃值 / 清标记 |
| `dodge` | 无 | 把这次受击标记为已闪避 |
| `flag` | `key` 必填、`value` 数值表达式、`who` | 写单位 flags（说帅回合等） |
| `forceBreak` | 无 | 按当前击溃值直接进入击溃，击溃值不足时不生效 |
| `heal` | `value` 必填、`bonus` 额外值、`rounding` round5/int/ten/none | 回血，受血量上限钳制 |
| `healFull` | 无 | 回满血 |
| `if` | `cond` 必填、`then` 必填、`else` 可选 | 条件分支；`cond` 支持 gender/status/effect/summon/summonCount/left+op+right |
| `interrupt` | `tag` | 打断带 `tag` 的持续效果 |
| `mark` | `key` 必填、`mode` add/set，默认 add、`value` set 时必填、`delta` 默认 +1 | 标记层数增减，`mode:"set"` 直接赋值；delta 支持数值表达式 |
| `markClear` | `key` | 清空标记，不写 `key` 就清该单位全部标记 |
| `maxHp` | `delta` 增减量、`percent` 按当前上限的百分比、`untilRecast` removeEffect 按 key 回滚、`debuff` 负面标记，dispel marked 清除 | 血上限增减，常驻修正 |
| `maxMp` | `delta` 增减量、`percent` 按当前上限的百分比、`untilRecast` removeEffect 按 key 回滚、`debuff` 负面标记，dispel marked 清除 | 蓝上限增减，常驻修正 |
| `mp` | `delta` 必填 | 蓝增减，钳制在 0..蓝上限 |
| `note` | `text` 必填 | 只产出日志，不改变状态；用于「无法打断」这类声明的落点 |
| `reflect` | `factor` 默认 2、`stunRounds`、`charges` 固定反弹次数、`value` 固定反弹伤害、`type` phys/magic/true，默认 magic、`noBreak` 反弹不加击溃值 | 蓄力期间的伤害反射（江雨轩）；带 `charges` 时改为固定值 + 次数的反弹（泥浩恺扣分!） |
| `removeEffect` | `key` 必填 | 按 key 移除持续效果，并把 `untilRecast` 标记为该 key 的属性修正一并回滚（剃发为僧复原） |
| `rewind` | 无 | 反方向的钟：奇数次记录全状态快照，偶数次回到快照；独立 clock 计时，回溯不重置 |
| `roll` | `sides` 默认 6、`key` 计数器名、`perTarget` 默认 true | 掷骰并存进计数器，供 `{counter}` 读取 |
| `schedule` | `after` 必填、`ops` 必填、`atPhase` 默认 roundEnd；roundStart 表示回合开始、`capture` 调度时求值的数值快照 | 延迟结算；`after` 是几个标准回合后；`atPhase:"roundStart"` 改在下一标准回合开始时结算；`capture` 把数值在调度时快照下来供 ops 用 `{ctx:键}` 读取 |
| `setBasicMod` | `type`、`factor`、`healInstead`、`healBack` 普攻回复实际造成的伤害、`hits`、`noBreak`、`misfire` | 改这次普攻：类型、倍率、段数、回血、无击溃、哑火 |
| `setBasicMode` | `healSummon` 召唤物 key、`mode` | 把普攻改成给召唤物回血 |
| `shield` | `hp` 必填、`duration` 标准回合数，默认 1、`label`、`onExpire` 到期执行的 ops | 护盾：独立血量池，伤害全额吸收；标准回合末计时，到期执行 `onExpire`（杨冬明坚若磐石） |
| `stat` | `stat` 必填、`mode` add/set/mul，默认 add、`value`、`duration` 数字或 {unit,count}、`restore` 每标准回合恢复量（配合 mode:set）、`untilRecast` removeEffect 按 key 回滚、`debuff` 负面标记，dispel marked 清除 | 面板修改，进 `mods`；`restore` 让 set 归零后逐标准回合恢复原值 |
| `status` | `kind` 必填、`duration` 数字或 {unit,count}、`rounds` 同 duration、`permanent` 整局、`skillId` 只封锁该技能时填、`chargeOk` noSkill 下仍可蓄力（只禁释放） | 状态，按标准回合计时；permanent 表示整局 |
| `strike` | `target` source 表示打来源、`victim` 显式指定打谁（target/enemyHero 等）、`times` 重复次数、`noBreak` | 立刻执行一次普攻 |
| `stunValue` | `delta` 必填 | 眩晕值增减，钳制在 0..上限 |
| `summon` | `key` 必填、`ttl` 覆盖定义里的 ttl | 生成召唤物，`key` 指向 `summons` 定义 |
| `taunt` | `delta` 必填 | 嘲讽值增减 |
| `tick` | `ops` 必填、`duration`、`period` 每 N 回合、`permanent`、`unstoppable`、`desc` chip 说明、`when` turnStart 时在持有者回合开始时结算；roundStart 时在每个标准回合开始时结算、`tag` 给 interrupt 用、`key` 给 if.cond.effect 用、`gate` {sides,cancel}、`breakOnSourceStatus`、`breakOnHolderStatus`、`fromBuff`、`debuff` 负面标记，dispel marked 清除、`guard` {remaining,onBreak,ops}、`immune` {buffs,statuses}、`breakImmune`、`chargeGuard`、`enemyNoSkill`、`selfNoBasic`、`onExpire` 到期时执行的 ops、`ignoreTaunt` 效果在身时无视嘲讽等级、`autoBreakAtCap` 效果在身时敌方击溃值到上限自动击溃 | 逐标准回合重复执行的持续效果（DoT、回蓝、属性）；`when:"turnStart"` 改为持有者回合开始时结算并在此时扣层；`gate` 是持有者行动前掷骰跳过行动，`period` 是每 N 个标准回合结算一次，`breakOnSourceStatus` 是来源被击晕/击溃即结束，`breakOnHolderStatus` 是持有者进入指定状态即结束；`guard` 是防护层（取消 N 次伤害 + onCancel ops），`immune`/`breakImmune`/`chargeGuard` 是防护声明 |
| `use` | `skillId` 必填、`times` 重复次数 | 内联执行另一个技能的 ops |
<!-- RPG6-STATS:END ops-table -->

`data/rule-docs.js` 是规则条目的标题与 HTML 正文，也是规则唯一的来源。改它等于改规则，刷新页面就生效，不写数据库、没有后台界面。

## 响应与暂停

个别技能要等对方（或受击方）先选择，引擎用「挂起 + 重放」实现，不把界面状态写进规则：

- 什么时候弹窗：「我帅不帅？」让对方选「帅 / 不帅」；「抽象艺术」每个标准回合让对方猜 1–6；「卫委壮观」每段伤害前让受击方选「花 15 防 / 花 10 抗 / 不闪」。
- 执行到询问点，`battle.apply` 只写 `state.pendingResponse`（含 `responderUid`、`defaultChoice`、`resumeAction`），原动作的扣费、伤害、日志都不生效、不扣行动；界面用 `kind:"respond"`（带 `uid`、`id`）提交，只有 `responderUid` 一方能提交，不消耗行动、不触发 `afterAction`。
- 10 秒不选由界面提交 `defaultChoice`：说帅默认「帅」、猜数默认「未猜中」、闪避默认「不闪」。
- 响应后从同一份输入 state 重放 `resumeAction`，按 `state.responses` 读选择，RNG 与随机序列一致；所以 `[原动作, respond]` 整串可完整重算、状态指纹一致，回放只按记录推进、不再询问。

新 op 与技能字段：`ask`（answer/guess 分支，带 then/else）、`flag`（写 `unit.flags`，如说帅回合）、`clearSummons`（清一侧召唤物）是 op；`activeDodge`（每段伤害前主动闪避）、`basicGroupWhen`（满足条件时普攻改全体）、`toggleEffect`（开关技能）是技能字段；`requires.once` 只在从 0 蓄第一层时检查该条条件。

## 与其它模块的共用

| 共用物 | 方式 |
|---|---|
| `../guitu/data/config.js` | 直接加载，提供 `GUI_CLOUDBASE`；不复制密钥 |
| `../guitu/js/gui-gate.js` | 直接加载，与鬼图鉴共用同一套组织验证与令牌 |
| `../guitu/js/gui-upload.js` | 直接加载，共用 `gui-images` 桶 |

改这三个文件会同时影响其它模块。`gui-upload.js` 里的 HEIC 库路径已经改成按脚本自身地址解析，本模块直接加载不会再 404。

## 数据流

读：

```
页面 → rpg-data.js → POST /v1/rdb/rest/rpc/rpg_search → 渲染
                   ↘ 云端不可用 → data/seeds/characters.js
```

写（必须带令牌）：

```
gui-gate.js → POST /rpc/gui_verify → 令牌存 sessionStorage
写操作 → rpg-data.js → Prefer: return=minimal, gui-token=<令牌> → RLS 校验
```

规则（不经过数据层）：

```
rules.html / rule.html → data/rule-docs.js → 渲染列表或正文
```

对局（引擎在浏览器里跑，只有战报落库）：

```
test.html → 选人 → RPG6B.battle.create({seed, a, b})
          → 每次操作 apply(state, action) → { state, events, committed }
          → 结束 BattleRecord.build(state, meta, committed[]) → rpg-data.createBattle → rpg_battles
battles.html → rpg-data.listBattles → 列表
test.html?record=<id> → rpg-data.getBattle → BattleRecord.states → 逐步回放
```

联机（准实时轮询，房间与动作只走 RPC）：

```
test.html 远程联机 → rpg-data-rooms.js → POST /v1/rdb/rest/rpc/rpg_room_* → rpg_rooms / rpg_room_actions
结算 → BattleRecord.build → rpg-data.createBattle → rpg_battles（id 固定 room-<房间码>，两端都尝试保存，重复视为已保存）
```

## 远程联机

两位朋友各用自己的设备打一局；v1 只做准实时轮询，不做账号、观战、聊天与强反作弊。

入口与流程：

- `test.html` 设置区展开「远程联机」，甲填昵称、选自己的角色、点「创建房间」；页面给出 8 位房间码与链接，复制发给乙。
- 乙打开链接，填昵称、选自己的角色、点「加入房间」；乙一加入即开始，双方只在自己回合操作，对方回合只读。
- 轮询间隔 2 秒（`POLL_MS`），页面隐藏时降到 10 秒（`HIDDEN_MS`），连续失败指数退避到 15 秒并显示「同步中断，重试中」。
- 座位密钥 32 位十六进制，存 `localStorage` 的 `rpg6-room-seats`（最多 8 个房间，按时间淘汰），昵称存 `rpg6-nick`；创建/加入后 URL 写入 `?room=CODE`，离开时去掉。
- 刷新：地址带 `?room=` 且本机有该房间座位时，自动拉全量动作重放；换设备、清缓存、无痕窗口都不能恢复。

RPC（`rpg_rooms` / `rpg_room_actions` 对 anon 不可读，只调函数）：

| 函数 | 用途 |
|---|---|
| `rpg_room_create` | 建房，生成房间码与种子，返回 `side:"a"` |
| `rpg_room_join` | 加入，只允许 `waiting` 且乙位为空，返回 `side:"b"` |
| `rpg_room_get` | 按 `after_seq` 拉房间状态与动作，单页 500 条 |
| `rpg_room_append` | 追加一步动作：校验座位密钥、`expected_seq`、房间状态、引擎版本 |
| `rpg_room_abandon` | 取消 / 离开 / 指纹中止时关闭房间 |
| `rpg_rooms_purge` | 删除 `updated_at` 早于 30 天的房间 |

服务端只校验座位密钥、动作序号、房间状态与引擎版本，**不校验招式合法性**；招式靠两端用同一份引擎重算，并在每一步比对状态指纹。指纹不一致就停止轮询、调用 `rpg_room_abandon`，对方看到房间关闭，不会静默继续。

引擎版本必须一致（建房时写入 `engine_version`，加入与追加都比对）；联机本身不升 `ENGINE_VERSION`。

限制：只支持 1v1、两人；无观战、聊天、账号；无撤销，联机下隐藏撤销按钮；没有服务端权威，朋友局不防改本机脚本；房间 30 天未活动由 `rpg_rooms_purge` 清理。

动作上限：刷新恢复最多拉 5 页 × 500 步（`MAX_PAGES` 4 加首页，共 2500 步），超出显示「对局步数过多」。

## 容易踩的坑

- `Prefer` 头必须拼接：`"return=minimal, gui-token=" + token`，覆盖会丢令牌。
- 写 `rpg_submissions` 不能用 `return=representation`：它的读策略按状态过滤，会把 PATCH 挡成 `42501`。
- 转正是两步写入（建角色 → 改投稿状态）。第二步失败时再点一次保存：先查 `source_submission_id`，已有角色就只补状态，不会建重复。
- 六维是文本列，不校验数字：旧档案里 31 号的攻击值是「受攻击者当前血量的20%」。
- 审核人、操作人每次都要重选，不记忆上次选择。
- 成员名单的唯一定义在 `js/members.js`（`window.CPU_MEMBERS`）；`rpg-data.js` 优先读它、读不到才用内置那份。改成员要同时改 `about.html` 的公开代号。
- 写操作会往站点共用的 `site_edit_log` 记一行，统计页的成员贡献度靠它；日志写失败只打 warn，不影响保存。
- 规则正文是手写 HTML，直接 `innerHTML`；它只能由开发人员改，所以没有 sanitize。以后若要开放网页编辑，必须先补 sanitize 与权限层。
- 规则数据文件不能叫 `data/rules.js`：会和 `js/rules.js` 撞名，`docgen.config.js` 的 `roles` 按文件名取值，两个节点会显示成同一个标签。

对局与战报：

- `state.seed` 必须存**原始种子**。存混淆后的 `rng` 值会再混淆一次，回放从第一步就发散；`state.rng` 才是随机数状态。
- 引擎文件按 `<script>` 顺序加载、靠 `window.RPG6B` 组合，`battle-record.js` 依赖 `RPG6B.state.hash`，顺序不能乱。
- 战报存的是 `committed` 动作。点技能但蓄力不足时引擎会把动作归一化成 `charge`，存原始动作会重放出不同结果。
- 战报记的是角色 id 不是快照。角色被改过之后回放可能对不上指纹，页面会标「与当前角色数据不一致」，这是提示不是 bug。
- 改了引擎规则要顺手把 `data/config.js` 的 `engineVersion` 加一版，旧战报会被标成「旧引擎战报」；不升版本就只能靠指纹对不上来发现。
- 面板数值（攻/防/法抗/血上限/速）统一向下取 5 的倍数（`B.rules.panelRound`），斗士 105×1.5=157.5 变 155；蓝上限例外，只向下取整到个位，否则「蓝上限 ±3」这类改动会被吃掉。
- 旧引擎战报在新规则下可能算不下去：`BattleRecord.states` 在第一个失败的动作处停下，页面标「只能回放到第 N 步」。
- 匿名对战报只有 select / insert 权限，PATCH 与 DELETE 返回 `401 42501`；写错的战报只能 service_role 手工删。唯一例外是 `rpc/rpg_battles_purge`：它 `security definer`、期限写死 30 天、不收参数，所以匿名调它也只能删过期的行。
- 清理搭在 `battles.html` 的加载路径上（与 `gui_tokens`、`site_suggest_hits` 同一个做法）：没人打开列表就不会清，旧行留着也不影响任何人看到的内容。
- 中途刷新靠 `localStorage` 的 `rpg6-live-battle` 恢复，和数据库无关；结束后保存成功才清掉它。
- 手机适配的断点是 `(orientation: landscape) and (max-height: 520px)`，不是 `max-width`：手机横屏宽 844px，用宽度断点会误判成竖屏。竖屏遮罩的条件带 `(pointer: coarse)`，桌面窄窗口不该弹。三项细节（速度条 details、技能效果展开、Buff 气泡）见 [游戏说明-坑.md](游戏说明-坑.md)。
- `docgen` 只扫模块根下的 `js/*.js`，`js/engine/`、`js/battle/` 不进架构图，说明写在 [架构.md](架构.md) 的「战斗引擎」一节。

联机：

- 未执行 `_local/sql/rpg-room-setup.sql` 时，`rpc/rpg_room_*` 返回 `PGRST202`，数据层映射成「联机服务未部署」；热座与战报不受影响。
- 房间码输入先转大写、去掉非字母数字，最后才校验 8 位；输入框 `maxlength` 是 16，别改成 8，否则带分隔符的粘贴会在归一化前被截断。
- 两端结算时都保存 `room-<房间码>`；后到的一端拿到 409 / `23505` 属正常幂等，不要当保存失败。
- 晚到的轮询响应可能带回已经应用过的 seq；`applyRemote` 必须跳过 `seq <= 本地 seq`，否则会被误判成序号不连续或失步。

## 原始资料

`archive/6.0doc/回合制角色/*.txt` 是 44 份原始角色档案（技能原文，编号与出处见 `0 清单.txt`），导入数据库后不再参与渲染，保留作核对依据。
`archive/picture/5–19.jpeg` 被 `data/seeds/characters.js` 直接引用；角色与图片按人物对应，同一张合影可对应多名角色。

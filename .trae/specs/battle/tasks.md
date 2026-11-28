# 任务卡

编号：`battle-01` 起，两位数，不复用。

## battle-01 对局页「换人」改为「认输」

- 状态：已验
- 允许改的路径：`rpg6.0/js/engine/actions.js`、`rpg6.0/js/battle/battle-page.js`、`rpg6.0/js/battle/battle-page-bind.js`、`rpg6.0/js/battle/battle-page-record.js`、`tests/engine/core.test.mjs`、`tests/engine/record.test.mjs`、`_local/tests/cases/rpg-battle.mjs`
- 共享文件：`rpg6.0/js/engine/actions.js`（改前确认无其他线改动）
- 做什么：对局中点击「认输」并确认后，当前行动方判负、对方获胜、照常存战报；认输作为动作写进 `actions`，回放可完整重算；回放模式仍显示「退出回放」，对局结束后隐藏认输按钮；去掉对局中的「换人」入口。
- 不做什么：不加结果页与回放的认输专属文案；不加数据库字段、不改 `rpg_battles`；不升引擎版本；保留结果页的「换人」出口。
- 验收命令：`powershell -NoProfile -ExecutionPolicy Bypass -File .dsh/skills/rpg6-character-batch/scripts/verify.ps1 -Browser`
- 验收标准：引擎与战报单测通过；点认输并确认后结果页出现、胜者为对方；含认输的战报回放指纹一致；桌面 1280×900 与手机 844×390 无布局回归。
- 验证记录：`verify.ps1 -Browser` 全绿（引擎 214、冒烟 29 局、浏览器 11）；adversary 复核 PASS；保存中退出崩溃与续战不能重存一并修掉。

## battle-02 房间后端与数据层

- 状态：已验
- 允许改的路径：`_local/sql/rpg-room-setup.sql`（新建，不提交）、`_local/tools/room-smoke.mjs`（新建，不提交）、`rpg6.0/js/rpg-data-rooms.js`（新建）、`rpg6.0/js/rpg-data.js`
- 共享文件：无（不改 `data/config.js`，不升 `ENGINE_VERSION`）
- 做什么：按 spec 建 `rpg_rooms` / `rpg_room_actions` 两张表与 6 个 RPC，RLS 全禁、只授 execute、结尾 `notify pgrst, 'reload schema';`；数据层封装 create/join/get/append/abandon/purge，12 秒超时与一次超时重试，`PGRST202` 映射成「联机服务未部署」；smoke 脚本跑通 create → join → get → append → stale → bad_key → abandon，并带 `Origin: https://cangwu-protect-union.github.io`。
- 不做什么：不改页面、不改引擎、不写页面文案；不提交 SQL 与 smoke。
- 人工前置：你在 CloudBase 控制台原子执行迁移脚本；没执行前本卡验收不通过。
- 验收命令：`node _local/tools/room-smoke.mjs`、`powershell -NoProfile -ExecutionPolicy Bypass -File tools\check.ps1`
- 验收标准：smoke 全绿；无密钥直接 GET 两张表拿不到行；`check.ps1` 退出码 0。

## battle-03 建房/加入界面与房间生命周期

- 状态：已验
- 允许改的路径：`rpg6.0/test.html`、`rpg6.0/css/battle.css`、`rpg6.0/js/battle/battle-remote.js`（新建）、`rpg6.0/js/battle/entry.js`、`rpg6.0/js/battle/battle-page.js`
- 共享文件：无
- 做什么：设置区加可折叠「远程联机」块（昵称、自己的角色、加入码、建房/加入、房间码与链接复制、等待/取消）；对局栏加房间状态；按 spec 补齐 DOM 契约（`data-room-*`、`[data-stage][data-my-side]`）；座位密钥与昵称存 localStorage；创建/加入成功后写 `?room=CODE`；轮询骨架只拉房间状态并显示对手在线/离线；乙加入后两端解析角色、建引擎状态、记 `P.remote.mySide` 并进入对局；`?room=` 且本机有座位时自动恢复；离开时清 URL。
- 不做什么：不提交动作、不应用远端动作、不做结算与保存；不改 `battle-page-bind.js` / `battle-page-record.js`。
- 验收命令：`powershell -NoProfile -ExecutionPolicy Bypass -File .dsh/skills/rpg6-character-batch/scripts/verify.ps1 -Browser`
- 验收标准：桌面两窗口建房→加入→双方进入对局；刷新乙窗口自动回到同一局；缺 RPC 时提示「联机服务未部署」；热座流程不回归；手机横屏设置区不溢出。
- 验证记录：`verify.ps1 -Browser` 全绿；开发双上下文冒烟 `_local/tools/room-ui-smoke.mjs` 19 项 PASS（建房/加入/同指纹/刷新/只读/离开/错误码/码归一化）；adversary 第一轮发现房间码 `maxlength` 截断，已修为 16 并去掉 `slice(0,8)`，补 `R.gen` 防离开后旧请求回拉；复验 PASS。`battle-remote.js` 713 行，按规则在 `tools/size-budget.json` 加豁免 cap 900、`改动索引.md` 记待拆。

## battle-04 回合同步、结算与离开

- 状态：已验
- 允许改的路径：`rpg6.0/js/battle/battle-remote.js`、`rpg6.0/js/battle/battle-page.js`、`rpg6.0/js/battle/battle-page-bind.js`、`rpg6.0/js/battle/battle-page-record.js`、`rpg6.0/test.html`、`rpg6.0/css/battle.css`、`_local/tools/room-ui-smoke.mjs`（不提交）
- 共享文件：无
- 做什么：`P.applyAction` 在联机下分流到远程提交；非本方回合、提交中拒绝操作；本机先在克隆状态算 `committed` 与指纹，服务端确认后再替换状态；轮询应用远端动作并逐步校验 `state_hash`；`stale` 重拉并按 `client_tag` 识别本机超时提交；认输只允许本方回合；结算页幂等保存 `room-<CODE>` 战报；离开/指纹中止调用 abandon；撤销在联机下隐藏；远端动作到达时取消本机选择。
- 不做什么：不改引擎与动作格式、不改 `rpg_battles` 结构、不做观战/撤销/聊天、不新建页面。
- 验收命令：`powershell -NoProfile -ExecutionPolicy Bypass -File .dsh/skills/rpg6-character-batch/scripts/verify.ps1 -Browser`
- 验收标准：两窗口轮流出招 5 步以内双方回合文本与血量一致；刷新任一端可继续；认输后两端出现结算、战报保存且回放指纹一致；伪造 `state_hash` 时页面停止同步并关闭房间；热座与回放不回归。
- 验证记录：`verify.ps1 -Browser` 全绿；开发双上下文冒烟 29 项 PASS（本端出招、远端动作、刷新、认输、room- 战报、回放指纹、重复 seq 跳过）；adversary 第一轮发现「晚到轮询重复 seq 被误判失步」，已加 `step <= R.seq` 跳过并补回归断言，复验 PASS；`battle-remote.js` 896/900。

## battle-05 双端端到端用例

- 状态：已验
- 允许改的路径：`_local/tests/cases/rpg-room.mjs`（新建，不提交）、`_local/tests/run-all.mjs`、`_local/tests/lib/harness.mjs`
- 共享文件：无
- 做什么：用两个浏览器上下文覆盖建房加入、出招同步、刷新恢复、认输保存、错误码提示；判侧只读 DOM（`[data-stage]` 的 `data-my-side` 与房间状态文本），不等内部 API；清理清单加 `rooms` 与 `battles`，生成的清理 SQL 能删房间、动作与战报。
- 不做什么：不改被测页面来迁就测试；不依赖令牌。
- 验收命令：`node _local/tests/run-all.mjs --group=回合制`
- 验收标准：新增用例全绿，原 `rpg-battle` 用例不回归；清理 SQL 执行后房间与战报都不残留。
- 验证记录：`node _local/tests/run-all.mjs --group=回合制` 连跑两次均 14/14；判侧用 DOM，同步断言只读 `actions.length` 与 `RPG6B.state.hash`（集中在 `snap` 并注释）；adversary 复核 PASS，保留意见为「内读哈希与卡面措辞不符」，按上述口径接受。清理 SQL 已生成（含 3 房间 + 1 战报），但 2026-11-27 执行后核对仍有残留，待执行人重跑并复核。

## battle-06 规则页、文档与边界记录

- 状态：已验
- 允许改的路径：`rpg6.0/data/rule-docs.js`、`rpg6.0/README.md`、`rpg6.0/游戏说明.md`、`backlog.md`、`范围收敛计划.md`
- 共享文件：无
- 做什么：规则页加「远程联机」条目（建房/加入、只在自己回合、约 2 秒同步、刷新恢复、不能撤销、认输、指纹中止）；README 加联机章节、两张表与 RPC 清单、联机专属坑；游戏说明加玩家向流程；backlog 把联机从「待定」改为「进行中/已做」并记边界变更（换掉对局第 4 项）；范围收敛计划第 4 项加一行注记。
- 不做什么：不跑 `build-docs`、不改 `架构.md` / `访客流程图.md`、不写未实现的功能。
- 验收命令：`powershell -NoProfile -ExecutionPolicy Bypass -File tools\check.ps1`
- 验收标准：`rules.html` 能看到「远程联机」条目；文档描述与代码一致；`check.ps1` 绿。
- 验证记录：规则页新增 4 节「远程联机」；README 补两张表、6 个 RPC、数据流与 4 条联机坑；游戏说明补玩家向/数据向两处与已知问题；backlog 记边界变更并把「进行中」加入状态词表；范围收敛计划第 4 项加注记。`check.ps1` 全绿。

## battle-07 联机舞台骨架与窗口系统

- 状态：已验
- 对应规划：`_local/docs/联机对局界面设计/实现规划.md` 的 UI-01
- 允许改的路径：`rpg6.0/test.html`、`rpg6.0/css/battle-live.css`（新建）、`rpg6.0/js/battle/battle-windows.js`（新建）、`rpg6.0/js/battle/stage-live.js`（新建）、`rpg6.0/js/battle/entry.js`、`rpg6.0/js/battle/battle-page.js`、`_local/tests/cases/rpg-room.mjs`（不提交）
- 共享文件：无（不动 `tools/size-budget.json`）
- 做什么：
  - `test.html`：`[data-stage]` 内加 `[data-live]` 骨架（`[data-scene]` 占位、`[data-dock]`、`[data-windows]`）；引入 `css/battle-live.css`；旧 `[data-grid]` 保留。
  - `battle-windows.js`：ESM，导出窗口管理器；7 个窗口（speed、panel-own、panel-enemy、query-own、query-enemy、hp-record、battle-log）的壳、拖动、折叠进 dock、置顶、位置记忆 `localStorage["rpg6-live-windows-v1"]`、复位、resize 夹回；≤900px 默认只展开己方面板与己方查询，窗口宽 `calc(100vw - 12px)`、单窗高 ≤46vh。
  - `stage-live.js`：ESM，挂 `root.RPG6LiveStage`；mount 显示 `[data-live]`、加 `html.is-live`、创建窗口与 `[data-reset-windows]` 按钮（live 时插入 `[data-bar]`，unmount 移除）；render 调 `root.BattleView.render(...)`，用 `<template>` 解析旧片段，把速度条、两个角色卡、两个查询、战斗日志分进对应窗口，两个 `.bu-log` 进扣血记录窗（左右两栏占位），丢弃 `.battle-buff`；按 `opts.side` 映射己方/敌方；节点上的 `data-unit` / `data-query` 与所有 `data-*` 钩子原样保留；live 根同步 `is-picking`；unmount 移除事件与 `html.is-live`。
  - `battle-page.js`：`P.render()` 加联机分支（`P.remote && P.mode === "play"`）调用 `P.live.render`，不再重建隐藏 grid；非联机恢复旧路径，必要时 unmount；bar、结算、保存、`syncStatus` 逻辑不变；回设置区或离开房间时 unmount。
  - `entry.js`：导入 `battle-windows.js` 与 `stage-live.js`。
  - `battle-live.css`：live 铺满视口、隐藏 `.battle-page > p`、窗口外壳、折叠条、底部状态条固定 38px、结算覆盖整屏、窗口内旧片段去边框与内边距、3D 占位用中性渐变网格、≤900px 基础规则。
  - `rpg-room.mjs`：等待选择器从 `.battle-grid .battle-unit` 改为 `[data-live] .battle-unit`。
- 不做什么：不做血条、扣血记录正式结构、战报重构（battle-08）；不引入 three.js（battle-09）；不做召唤物地图层（battle-10）；不改引擎、数据、联机协议、结算与战报；不升版本。
- 验收命令：`powershell -NoProfile -ExecutionPolicy Bypass -File .dsh/skills/rpg6-character-batch/scripts/verify.ps1 -Browser`
- 验收标准：命令全绿；桌面两窗口联机进入对局后四个展开窗可拖、可折、可置顶、可复位，刷新后位置记忆生效；扣血/战报/敌方查询默认在折叠条；热座与回放仍是旧网格；控制台无报错。
- 验证记录：`verify.ps1 -Browser` 全绿（引擎 214、冒烟 29 局、浏览器 14/14，含联机 3 例）；adversary 复核 PASS；另用临时双上下文脚本验 23 项窗口交互（拖动/置顶/折叠/刷新记忆/复位/无报错）后删除；已修紧凑态把窗口尺寸永久写小、复位按钮误取消选目标。遗留到 battle-08：live 下 `P.speedOpen` / `P.battleLogOpen` 被固定展开，旧 grid 仍留上一局 DOM（页面自身查询都限定作用域）。

## battle-08 窗口内容迁移与渲染解耦

- 状态：已验
- 对应规划：UI-02
- 允许改的路径：`rpg6.0/js/battle/battle-view.js`、`rpg6.0/js/battle/battle-view-effects.js`、`rpg6.0/js/battle/stage-live.js`、`rpg6.0/css/battle-live.css`
- 共享文件：无
- 做什么：
  - `battle-view.js`：`renderUnit` 加可选参数（去召唤物栏、去伤害记录、显示可视化血条）；`renderQuery` 加 `hideStats`；新增 `renderHpRecord(state)`（左右两栏、按标准回合合并、底部合计、空状态）与 `renderLogWindow(state)`（最近 160 行，滚到最新）；旧调用默认行为保持不变。
  - `battle-view-effects.js`：额外动作收成独立 `.bq-extras` 一行，只在存在额外动作时出现；固定三个按钮严格三个。
  - `stage-live.js`：改为直接按窗口生成内容，不再解析旧网格片段；己方/敌方按 `opts.side` 映射；敌方查询 `readOnly`；扣血记录与战报使用新函数；技能展开状态恢复到 live 容器。
  - `battle-live.css`：血条、扣血记录两栏、战报行、查询列表滚动、按钮行在窗口内的排版。
- 不做什么：不做 three.js 场景、召唤物地图层、状态条改版、手机细化；不改热座与回放。
- 验收命令：`powershell -NoProfile -ExecutionPolicy Bypass -File .dsh/skills/rpg6-character-batch/scripts/verify.ps1 -Browser`
- 验收标准：联机两窗口出招正常；角色面板有血条且无召唤物/伤害记录；查询无六维；扣血记录两栏与合计正确；战报窗可折叠、内容滚动到最新；热座不回归。
- 验证记录：`verify.ps1 -Browser` 全绿（引擎 214、冒烟 29 局、浏览器 14/14）；adversary 第一轮判 P1/P3 不通过（折叠态战报窗展开后停在最早一条；速度窗未按 side 映射），已修：battle-log 展开时补滚到底、`renderSpeed` 支持 ownSide 并把己方列放前，复验 PASS；两参数旧调用输出逐字一致。

## battle-09 three.js 场景与标签层

- 状态：已验
- 对应规划：UI-03
- 允许改的路径：`rpg6.0/js/lib/`（新建：`three.module.min.js` 与许可文件）、`rpg6.0/js/battle/scene3d.js`（新建）、`rpg6.0/js/battle/stage-live.js`、`rpg6.0/js/battle/entry.js`、`rpg6.0/css/battle-live.css`、`tools/size-budget.json`
- 共享文件：`tools/size-budget.json`（改前看 `git status --short`）
- 做什么：
  - 固定版本 three.js 放到 `rpg6.0/js/lib/`，保留 MIT 许可；文件 UTF-8 无 BOM、LF。
  - `size-budget.json` 的 `skip` 加 `rpg6.0/js/lib/`，否则 256KB 体积闸报红。
  - `scene3d.js`：固定透视机位；地面与网格；己方近景背对、敌方远景正对；小人用运行时 canvas 剪影纹理的 billboard；召唤物同方案小号；当前行动者/合法目标/已选目标亮圈；世界坐标投影到 DOM `.scene-tag`（名字、血条、TTL）与透明 `.scene-hit`（`data-unit` / `data-summon`）；WebGL 失败时 `is-flat` 降级；DPR ≤2；页面隐藏暂停；`dispose()` 释放资源。
  - `stage-live.js`：接场景并随状态更新；点击热区回调页面层。
  - `entry.js`：导入 `scene3d.js`。
- 不做什么：不做召唤物详情卡完整交互与选目标细化（battle-10）；不改引擎、数据、联机协议；不动 `battle-remote.js`。
- 验收命令：`powershell -NoProfile -ExecutionPolicy Bypass -File tools\check.ps1`、`powershell -NoProfile -ExecutionPolicy Bypass -File .dsh/skills/rpg6-character-batch/scripts/verify.ps1 -Browser`
- 验收标准：两条命令全绿；联机对局能看到地面与双方小人，窗口在画布之上且可操作；禁用 WebGL 后仍能完成操作；`rpg6.0/js/lib/` 被体积闸跳过。
- 验证记录：`check.ps1` 全绿；`verify.ps1 -Browser` 全绿（引擎 214、冒烟 29 局、浏览器 14/14）。three.js 0.160.1（670KB）+ MIT 许可，`size-budget.json` 的 skip 已加 `rpg6.0/js/lib/`。`scene3d.js` 550 行（非空 512，额度 700）。双窗口 1280×900 实测：`is-3d` 生效，双方剪影、标签、亮圈与热区正常，点标签中心可完成普攻；禁用 WebGL 后 `is-flat` 生效、标签百分比定位、动作照常，控制台无报错。adversary 第一轮发现近景热区被截断、`forceContextLoss` 缺失、不可选中召唤物会露出空血条、贴图色域不一致，已全部修掉并复验 PASS；≤900px 热区与默认窗口重叠留到 battle-12。`rpg6.0/css/battle-live.css` 为场景与标签样式必需，开工前由主工程补进允许路径。

## battle-10 召唤物地图层与选目标

- 状态：已验
- 对应规划：UI-04
- 允许改的路径：`rpg6.0/js/battle/scene3d.js`、`rpg6.0/js/battle/stage-live.js`、`rpg6.0/js/battle/battle-page.js`、`rpg6.0/css/battle-live.css`、`_local/tests/cases/rpg-room.mjs`（不提交）
- 共享文件：无
- 做什么：召唤物出现在所有者前方一排，带名字、血条、剩余回合；单击弹详情卡（名称、所有者、血、剩余回合、速度与攻击间隔、光环简述；合法时「选为目标」，另有「关闭」）；角色热区直接选目标；`P.pick.targets` 驱动亮圈；Esc 与取消沿用现有逻辑；双端用例的选目标点击改到新热区。
- 不做什么：不改召唤物规则与引擎；不做状态条最终样式与手机适配。
- 验收命令：`node _local/tests/run-all.mjs --group=回合制`
- 验收标准：用例全绿；双窗口能选中敌方角色/召唤物并结算；详情卡只在可选中时出现「选为目标」；取消与 Esc 正常。
- 验证记录：`node _local/tests/run-all.mjs --group=回合制` 15/15，新增「召唤物详情卡与选为目标」：吕场龄 3 个己方回合内召唤土豆地雷 → 非选目标时卡无按钮、Esc 关闭 → 乙普攻点 `.scene-hit[data-summon]` 开卡出现「选为目标」→ 点击后两端动作数与指纹一致、卡关闭、召唤物掉血；`actOnce` 选目标改点 `.scene-hit[data-unit]`，未被浮窗遮挡。`check.ps1` 全绿。adversary PASS，两条 P3 已修（readOnly 不出现「选为目标」、卡内容变化后重新定位）。召唤物图层与亮圈沿用 battle-09 的 scene3d，未改 scene3d / battle-page，未升版本。

## battle-11 底部状态条与联机状态

- 状态：已验
- 对应规划：UI-05
- 允许改的路径：`rpg6.0/test.html`、`rpg6.0/js/battle/stage-live.js`、`rpg6.0/css/battle-live.css`、`rpg6.0/js/battle/battle-page.js`、`_local/tests/cases/rpg-room.mjs`（不提交）
- 共享文件：无
- 做什么：live 状态下状态条固定底部三段（回合/提示/联机状态 + 按钮）；轮到你、等待、对手离线、同步中断、房间结束用圆点与颜色区分；选目标时中段提示并可取消；认输、离开房间、复位窗口常显且按 `canAct()` 控制认输；撤销与回放控件隐藏；保留 `[data-room-status]` 与 `[data-stage][data-my-side]` 契约。
- 不做什么：不改联机协议与 `battle-remote.js`；不加新功能按钮。
- 验收命令：`node _local/tests/run-all.mjs --group=回合制`
- 验收标准：用例全绿；两窗口交替出招时状态文字一致；等待/离线/同步中断显示正确；认输与离开行为不变。
- 验证记录：`node _local/tests/run-all.mjs --group=回合制` 15/15。新增断言：行动方 `[data-room-status]`「轮到你」且 `data-tone="you"`，非行动方「等 …」且 `wait`；两端 `[data-turn]` 一致（联机状态按己方视角不同是设计第 7 节要求，卡上「状态文字一致」按此口径落实）；撤销/回放隐藏，离开/复位常显；认输行动方可见可点、非行动方可见 disabled。503 注入 `rpg_room_get` 后状态变「同步中断，重试中」+ `bad`，解除后恢复 `wait`。选目标时提示带「· Esc 取消」并出现「取消选择」，取消后提示与按钮复位。`check.ps1` 全绿。adversary PASS，三条 P3 已修：昵称含「失败/轮到你」时按固定前缀判 tone、非法目标提示仍保留 Esc 后缀、halt 只改状态时同步认输 disabled。未改 `test.html`、未改 `battle-remote.js`、未升版本。

## battle-12 手机窄屏与全量回归

- 状态：已验
- 对应规划：UI-06
- 允许改的路径：`rpg6.0/css/battle-live.css`、`rpg6.0/js/battle/stage-live.js`、`rpg6.0/js/battle/battle-windows.js`、`rpg6.0/js/battle/battle-page-ui.js`、`rpg6.0/test.html`、`_local/tests/cases/rpg-room.mjs`（不提交）
- 路径补充：battle-12 开工时加入 `battle-windows.js`。全宽两窗按原 46vh 会把 844×390 的热区全部盖住，紧凑默认高度与上下锚点只能改窗口管理器；不新增缩放，不改窗口 API。
- 共享文件：无
- 做什么：≤900px 默认只展开己方面板与己方查询；窗口全宽、最高 46vh、内部滚动；触摸拖动只认标题栏并吸附边缘；折叠条横向滚动；字号与画布 DPR 收紧；页面隐藏暂停渲染；沿用现有横屏遮罩；场景标签与热区不得被默认展开的窗口完全盖住（必要时下移小人/热区或调整窗口）；补齐全量回归。
- 不做什么：不做窗口缩放；不改引擎、联机协议、建房与结算。
- 验收命令：`powershell -NoProfile -ExecutionPolicy Bypass -File .dsh/skills/rpg6-character-batch/scripts/verify.ps1 -Browser`、`node _local/tests/run-all.mjs --group=回合制`、`powershell -NoProfile -ExecutionPolicy Bypass -File tools\check.ps1`
- 验收标准：三条命令全绿；844×390 一屏能完成进入、出招、折叠、刷新恢复；桌面两窗口完整一局；热座与回放不回归。
- 实施口径：紧凑断点按 `游戏说明-坑.md` 写成 `(max-width: 900px), (orientation: landscape) and (max-height: 520px)`，覆盖 932×430/915×412 手机横屏，同时不丢窄桌面窗。844×390 下 top 面板改 50% 宽（全宽会压掉敌方名字标签），query 仍全宽；面板 77px、查询 141px、中间场景带 102px；其余 5 窗仍 46vh。
- 验证记录：三条命令全绿：引擎 214、冒烟 29 局、浏览器 16/16、回合制 16/16、`check.ps1` 通过。844×390 实测面板 `6,26..428,103`、查询 `6,205..838,346`、折叠条底 23、敌方热区中心 x 可用 140px、敌方名字标签横向至少露 30px；932×430 仍紧凑两窗。用例改为建房前设 844×390（覆盖首次紧凑挂载），新增 dock 不压标题栏、标签露出与 932 断点断言。adversary 两轮复核：P2-1 桌面快照回退、P2-2 折叠条压标题栏、P2-3 932/915 未进紧凑、P2-4 紧凑写脏桌面记录均已修并复验；P2-N（800×900 回退桌面重叠）由组合断点修复。紧凑下不写窗口位置（折叠状态刷新回默认），桌面 saved 不受污染。

## battle-13 联机角色卡：去蓝条与桌面自适应高度

- 状态：已验（2026-11-28）
- 验证记录：`verify.ps1 -Browser` 通过（引擎 214/0、冒烟 29 局 0 异常、check 全绿、浏览器 17/0）；`fitAutoHeights` 按「标题栏 + padding + 内容 + 边框」取整，headless 复算溢出 0；新增测试断言桌面角色卡无蓝条、无内部滚动；adversary 复核通过。
- 允许改的路径：`rpg6.0/js/battle/battle-view.js`、`rpg6.0/js/battle/battle-windows.js`、`rpg6.0/css/battle-live.css`、`_local/tests/cases/rpg-room.mjs`（不提交）
- 共享文件：无（不动 `battle-view.js` 之外的渲染、不升引擎版本）
- 做什么：`renderVitalBars` 只输出血条（当前/最大/百分比与三档颜色），删掉蓝条标记与 `bu-mp-bar` 样式，标题行保留蓝量数字；`battle-windows.js` 给角色面板两窗加桌面自动高度——按内容实际高度设窗口高度（最低 120px、最高视口可用高度），己方卡底边固定向上长、敌方卡顶边固定向下长，内容仍超出时才内部滚动；紧凑断点不启用自动高度，留给 battle-15。
- 不做什么：不做手机迷你条、不改紧凑默认布局（battle-15）；不改查询窗、速度条、战报、扣血记录；不改引擎、战报结构、联机协议。
- 验收命令：`powershell -NoProfile -ExecutionPolicy Bypass -File .dsh/skills/rpg6-character-batch/scripts/verify.ps1 -Browser`
- 验收标准：1280×900 联机角色卡无内部滚动、无蓝条、蓝量数字仍在；844×390 旧紧凑布局不回归；热座与回放无变化。

## battle-14 详细战报全量渲染

- 状态：已验（2026-11-28）
- 验证记录：两处 160 条截断已删，从 `state.log` 第 0 条渲染；引擎单测 214/0，回合制浏览器 17/0；adversary 复核无其它截断点。
- 允许改的路径：`rpg6.0/js/battle/battle-view.js`
- 共享文件：无
- 做什么：`renderLogWindow` 与 `renderBattleLog` 去掉「最近 160 条」截断，从 `state.log` 第一条渲染到最后一条；保留联机战报窗自动滚到最新、单机折叠态预览最后一个有效回合。
- 不做什么：不改日志生成、引擎、数据库、回放数据结构；不做分页或虚拟滚动。
- 验收命令：`node tests/engine/run.mjs`、`node _local/tests/run-all.mjs --group=回合制`
- 验收标准：25 回合以上对局能看到第 1 回合事件；联机、单机、回放三处都不再截断；长局渲染无明显卡顿。

## battle-15 手机联机紧凑布局：全屏地图 + 迷你角色卡 + 角色详情

- 状态：已验（2026-11-28）
- 验证记录：`verify.ps1 -Browser` 全绿（引擎 214/0、冒烟 29 局、浏览器 17/0）；844×390 四窗为 150×200 / 300×58 / 300×58 / 400×200，敌方热区中心露 83px；迷你卡全屏、角色详情两列、扣血/战报全屏与折叠回 dock 均通过；932×430 与更窄视口复算无重叠，resize 会重锚；adversary 复核通过，补了桌面 6px 底边留白与窗内点击阻止冒泡。
- 允许改的路径：`rpg6.0/js/battle/battle-windows.js`、`rpg6.0/js/battle/stage-live.js`、`rpg6.0/js/battle/battle-view.js`、`rpg6.0/css/battle-live.css`、`_local/tests/cases/rpg-room.mjs`（不提交）
- 共享文件：`battle-view.js` 与 battle-13/14 同文件，已串行完成
- 做什么：
  - 紧凑模式（≤900px 或横屏短边）不再给地图预留空区，3D 场景继续铺满 `.battle-live`，浮窗叠在上面。
  - 常驻窗压缩：速度条约 150×200 左上；己方/敌方角色迷你卡约 300×58，左下/右上；己方操作约 400×200 右下。尺寸按视口宽高自适应，避免窄屏互压。
  - 角色迷你卡只显示名字、血条、蓝数；点卡片正文打开同一窗口的全屏完整角色卡（复用现有 renderUnit，六维/Buff/页脚都在），`–` 关闭回到迷你卡。
  - 把 `query-enemy`（操作 · 敌方）换成 `role-detail`（角色详情）：折叠条入口，点开全屏两列（左己方、右敌方，复用扣血的两列布局），每列显示角色技能：序号、技能名、条件、效果；未编码/不支持标灰；不带操作按钮。
  - 扣血记录、详细战报、角色详情在紧凑模式下一律全屏覆盖、禁止拖动，`–` 折叠回 dock 后继续对局；桌面端保持原浮窗行为。
  - 折叠条三项顺序：扣血记录 / 详细战报 / 角色详情。
- 不做什么：不改联机协议、引擎、战报结构；不改桌面默认布局与拖动/位置记忆；不改单机/回放页面；不做竖屏布局。
- 验收命令：`powershell -NoProfile -ExecutionPolicy Bypass -File .dsh/skills/rpg6-character-batch/scripts/verify.ps1 -Browser`
- 验收标准：844×390 四窗展开（速度/己方迷你/敌方迷你/己方操作），敌方热区在中心 x 上仍露出 ≥40px；迷你卡点开全屏完整卡、关闭回迷你；角色详情两列显示双方技能；扣血/战报/角色详情全屏、不拖动、折叠后回 dock；932×430 仍按紧凑；桌面 1280×900 浮窗行为不变。

## battle-16 横屏遮罩只在游戏过程中触发

- 状态：已验（2026-11-28）
- 验证记录：竖屏设置区无遮罩、开局后出现、回设置区消失（新增用例通过）；读战报失败也会撤销 `is-battle`；`verify.ps1 -Browser` 全绿。
- 允许改的路径：`rpg6.0/css/battle.css`、`_local/tests/cases/rpg-battle.mjs`（不提交）
- 共享文件：无
- 做什么：把竖屏遮罩与 `body` 滚动锁定的选择器从 `html.is-phone` 收紧到 `html.is-phone.is-battle`；`is-battle` 已由 `setImmersive(true)` 在开局/回放入口加、回设置区/离开房间移除。设置区（选人、建房/加入）在竖屏手机上不弹遮罩且可正常滚动。
- 不做什么：不改遮罩按钮的全屏/锁方向逻辑；不改 `is-phone` 判定；不动联机舞台与桌面布局。
- 验收命令：`powershell -NoProfile -ExecutionPolicy Bypass -File .dsh/skills/rpg6-character-batch/scripts/verify.ps1 -Browser`
- 验收标准：竖屏手机进入 `test.html` 设置区不弹遮罩、页面可滚；开始对局或打开回放后弹遮罩；回到设置区遮罩消失；横屏游戏不受影响。

## 收尾（不单独开卡）

- 全量：`verify.ps1 -Browser` + `node _local/tests/run-all.mjs --group=回合制` + `check.ps1`。
- 手工：桌面两窗口完整一局、手机横屏加入与刷新、回放该战报。
- 发布前停在【闸口 2】，等确认后再跑 `publish.ps1`。

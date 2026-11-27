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

## 收尾（不单独开卡）

- 全量：`verify.ps1 -Browser` + `node _local/tests/run-all.mjs --group=回合制` + `check.ps1`。
- 手工：桌面两窗口完整一局、手机横屏加入与刷新、回放该战报。
- 发布前停在【闸口 2】，等确认后再跑 `publish.ps1`。

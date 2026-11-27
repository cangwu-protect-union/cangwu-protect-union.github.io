# 任务卡

编号：`battle-01` 起，两位数，不复用。

## battle-01 对局页「换人」改为「认输」

- 状态：在做
- 允许改的路径：`rpg6.0/js/engine/actions.js`、`rpg6.0/js/battle/battle-page.js`、`rpg6.0/js/battle/battle-page-bind.js`、`tests/engine/core.test.mjs`、`tests/engine/record.test.mjs`、`_local/tests/cases/rpg-battle.mjs`
- 共享文件：`rpg6.0/js/engine/actions.js`（改前确认无其他线改动）
- 做什么：对局中点击「认输」并确认后，当前行动方判负、对方获胜、照常存战报；认输作为动作写进 `actions`，回放可完整重算；回放模式仍显示「退出回放」，对局结束后隐藏认输按钮；去掉对局中的「换人」入口。
- 不做什么：不加结果页与回放的认输专属文案；不加数据库字段、不改 `rpg_battles`；不升引擎版本；保留结果页的「换人」出口。
- 验收命令：`powershell -NoProfile -ExecutionPolicy Bypass -File .dsh/skills/rpg6-character-batch/scripts/verify.ps1 -Browser`
- 验收标准：引擎与战报单测通过；点认输并确认后结果页出现、胜者为对方；含认输的战报回放指纹一致；桌面 1280×900 与手机 844×390 无布局回归。

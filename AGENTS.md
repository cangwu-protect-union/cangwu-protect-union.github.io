# 项目约定

每次会话自动加载，只放必须每轮生效的规则；细节在 skill 里。

## 复杂任务先盘问、确认清单再开工

任务复杂、需要多步才能完成时，不要直接动手。顺序是：先仔细盘问我，直到需求明确而完善 → 输出具体任务清单 → 等我修改并明确决定开工，再开工。

## 写 SQL 不加注释

写 SQL 程序（迁移脚本、查询、RPC/函数定义）时不要加注释。

## 架构升级不要走捷径

新增一类基础设施时不要为省事选临时方案。典型是**后端**（可信执行点、共享数据、密钥保护、支付回调、定时任务），也包括前期将就、后期返工代价高的：认证、数据模型、权限模型、数据库选型、构建部署方式、数据访问层边界。

做法：停下来说明「现在这个做法的欠账、什么条件下会爆」→ 给出可行方案与取舍 → 等我确认再实施。

判断依据：**数据必须可信 / 必须跨用户共享 / 必须存在我控制的地方**，任一条成立前端就不够了。

例外：纯可替换、且访问已收敛到单一模块（如 `api.ts`）的实现细节，可以直接换。

## 红线

- **编码**：UTF-8 无 BOM，LF。项目含大量中文，编码一变全站乱码。
- **数据源**：数据库是唯一数据源，`data/gui-entries.js` 的种子只作云端不可用时的兜底。
- **密钥**：`guitu/data/config.js` 的 `publishableKey` 可公开；`API Key`（service_role）绝不能出现在前端。
- **`_local/` 永不推送**：SQL 迁移脚本含题库答案哈希，文档含密码。
- **题库答案**只存在数据库 `gui_secrets` 表，任何 JS 里都不能出现明文或哈希。
- **真实姓名**不上面，页脚统一用组织名。

## 改代码前先加载对应 skill

| 场景 | skill |
|---|---|
| 读或改任何项目文件（主站 / guitu / quyu / 新模块） | `site-project` |
| 改完页面要实测 | `guitu-browser-test` |
| 跑或写端到端测试（`_local/tests`） | `site-e2e-tests` |
| 改样式或调整视觉 | `guitu-design` |
| 改 rpg6.0 战斗引擎、技能库、召唤物或对局页 | `rpg6-battle` |
| 准备上线 | `guitu-deploy` |
| 动数据库或权限 | `cloudbase-pg` |

## 不确定改哪里时

先看 `改动索引.md`：按「要做的事」列了要动的文件与连带项。

## 改完必跑校验

```
powershell -NoProfile -ExecutionPolicy Bypass -File tools\check.ps1
```

覆盖编码、JS 语法、HTML 标签栈、本地引用、CSS 配平、密钥、git 卫生，以及文档是否过期（`build-docs.js --check`）。退出码 0 才算过，细节见 `tools/README.md`。

动了数据层（`list()` 的兜底合并）或导航，再跑对应测试，两组都不需要令牌：

```
node _local/tests/run-all.mjs --group=数据源
node _local/tests/run-all.mjs --group=导航
```

### 回合制 6.0

改 `rpg6.0/js/engine`、`data/battle-skills.js`、召唤物、对局页或战报时，加载 `rpg6-battle`，并在 `check.ps1` 之外跑：

```
node _local/tests/engine/run.mjs
node _local/tests/engine/batch.mjs --pairs=smoke --seeds=1
node _local/tests/run-all.mjs --group=回合制
```

改规则要升 `data/config.js` 的 `engineVersion`；同步 `test.html` 提示、`rpg6.0/游戏说明.md`、`rpg6.0/架构.md`、`_local/docs` 的角色机制文档（`_local` 不推送）。召唤物/新钩子要进状态指纹与回放。

## 文档与配图

项目较大推进时跑一次：`node _local/tools/build-docs.js`，生成每个模块（含主站）的 `架构.md`、`访客流程图.md` 与 `preview/` 的 PNG 索引。`check.ps1` 会调 `build-docs.js --check` 比对文档与源码，过期即失败。

回合制 6.0 的角色/技能数还要同步 `test.html`、`游戏说明.md`、`架构.md`、`README.md` 与 `_local/docs/回合制6.0测试功能-角色机制.md`；机制文档在 `_local`，不推送，但必须更新。

## 提交前

`git status --short` 逐行看；先 `git log --oneline -3`，同一工作区可能有别的会话已提交或已推送。不要把别人的改动混进本次提交或提交信息；`_local/`、`*.sql`、`*.docx` 不进提交。

提交后再跑一次 `tools/check.ps1`：gitleaks 只扫 commit，工作区通过不代表提交后通过；数据里的 `key: "..."` 可能被 `generic-api-key` 误报，在 `.gitleaks.toml` 按路径 + 行正则放行，不要放行整个文件。

## 归档或交接前

把本会话新增的规则、测试命令、踩过的坑写进对应 skill 和本文件，再提交并推送。技能文件 `.dsh/skills/*/SKILL.md` 受版本管理，不能只留在对话或本地；`_local/` 仍然不推送。

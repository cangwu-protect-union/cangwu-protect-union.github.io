# 项目约定

每次会话自动加载，只放必须每轮生效的规则；细节在 skill 里。

## 复杂任务先盘问、确认清单再开工

任务复杂、需要多步完成时，不要直接动手。顺序：先仔细盘问，直到需求明确 → 输出具体任务清单 → 等我修改并明确决定开工，再开工。

## 红线

- 编码：UTF-8 无 BOM，LF。项目含大量中文，编码一变全站乱码。
- 数据源：数据库是唯一数据源，`data/gui-entries.js` 的种子只作云端不可用时的兜底。
- 密钥：`guitu/data/config.js` 的 `publishableKey` 可公开；`API Key`（service_role）绝不能出现在前端。
- `_local/` 永不推送：SQL 迁移脚本含题库答案哈希，文档含密码。
- 题库答案只存在数据库 `gui_secrets` 表，任何 JS 里都不能出现明文或哈希。
- 真实姓名不上面，页脚统一用组织名。

## 写 SQL 不加注释

写 SQL 程序（迁移脚本、查询、RPC/函数定义）时不要加注释。

## 架构升级不要走捷径

新增一类基础设施（后端、认证、数据模型、权限模型、数据库选型、构建部署、数据访问层边界）时不要为省事选临时方案。先说明欠账与爆发条件、给出方案与取舍，等我确认再实施。例外：纯可替换、访问已收敛到单一模块的实现细节。

## 改动范围（2026-11-24 起）

- 活跃线只有两条：rpg6.0 对局（4 项）与角色（33 人终点）。细节见 `范围收敛计划.md`。
- 主站、guitu、quyu、suggest、rpg6 角色档案一律 L1+L2：不加功能、不做维护，只修阻塞错误（页面打不开、数据错、控制台报错）。
- 不撤入口、不删代码（策略实验室除外）。
- 想加回冻结面：从活跃列表划掉等量的面，记进 `backlog.md`；一个窗口最多改 1 次。
- 改动尽量只碰 `rpg6.0/`；必须碰 `css/style*.css`、`guitu/data/config.js`、导航时单独提交，并跑对应测试。

## 改代码前先加载对应 skill

| 场景 | skill |
|---|---|
| 读或改任何项目文件 | `site-project` |
| 改 rpg6.0 战斗引擎、技能库、召唤物或对局页 | `rpg6-battle` |
| 批量加角色/技能、评估剩余角色 | `rpg6-character-batch` |
| 跑或写端到端测试（`_local/tests`） | `site-e2e-tests` |
| 准备上线 | `guitu-deploy` |
| 动数据库或权限 | `cloudbase-pg` |

## 不确定改哪里时

先看 `改动索引.md`。

## 省 token

- 一个任务一个会话：单会话过 100 步或上下文过 150k，先写交接再新开。
- 不整读大文件：先 `grep`/`glob` 定位，`read` 带 `offset/limit`；`edit` 后不要重读整文件。
- 机械步骤（跑校验、改文案、搬文件）把 reasoning 切 `off`；改规则/排查疑难再调回来。
- 子代理一次不超过 2 个、每个 ≤100 步；统计/索引类由脚本生成，不在对话里输出整份内容。
- shell 合并调用；用量报表 `node _local/tools/token-report.mjs`。

## 改完必跑校验

```
powershell -NoProfile -ExecutionPolicy Bypass -File tools\check.ps1
```

覆盖编码、JS 语法、HTML 标签栈、本地引用、CSS 配平、密钥、git 卫生、代码行额度、rpg6 lint 与文档计数。提交前 `-Staged`，提交后 `-Last`。文档生成已冻结，`check.ps1` 不再比对 `build-docs`。

日常测试只跑两组：

```
node tests/engine/run.mjs
node _local/tests/run-all.mjs --group=回合制
```

改了冻结模块（只修阻塞 bug）时，才跑对应组：`--group=数据源` / `--group=导航` / `--group=quyu` / `--group=suggest`。

### 回合制 6.0

改 `rpg6.0/js/engine`、`data/skills/`、召唤物、对局页或战报时，加载 `rpg6-battle`，跑：

```
powershell -NoProfile -ExecutionPolicy Bypass -File .dsh/skills/rpg6-character-batch/scripts/verify.ps1
```

改了对局页、技能结算或样式加 `-Browser`；全量压测 `-Full`。

改规则升 `js/engine/version.js` 的 `ENGINE_VERSION` 与 `data/config.js` 的 `engineVersion`（两处一致，`rpg6-lint` 比对），用 `node tools/rpg6-bump.mjs <新版本>`。角色数/技能数/op 数/unsupported 表由 `rpg6-stats.js --write` 写回。召唤物与新钩子要进状态指纹与回放。

眩晕值口径（6.0-engine.9 起）：一般伤害默认不加眩晕值，只有伤害 op 标 `addStun: true` 才加；击溃值仍按默认 +1。其余口径只看 `rpg6-battle` 的「已经定死的口径」表。

## 文件长度

额度按代码行算，规则在 `tools/size-budget.json`，`check.ps1` 每次报超限。冻结期不再拆文件：撞线就调 `budgets` 或 `hardCap`，在 `改动索引.md` 记一条待拆。`.ps1` 只写 ASCII（5.1 读 UTF-8 无 BOM 会乱码）。

## 文档

文档生成已冻结（2026-11-24）：不再跑 `build-docs.js`，模块 `架构.md`/`访客流程图.md` 不再随源码更新。`rpg6-stats --write` 与 `plan.mjs --write` 仍随角色批次跑。

## 提交前

改动完成并跑完校验后直接提交，无需再批准：

```
powershell -NoProfile -ExecutionPolicy Bypass -File tools\publish.ps1 -Message <提交信息文件> [-Url <页面> -Expect <特征串>]
```

它跑 `check.ps1 -Staged`、`git add -A`、commit、push、`check.ps1 -Last`。`git status --short` 仍要逐行看；`_local/`、`*.sql`、`*.docx` 不进提交。

DSH 沙箱：`.git/` 不可写，`git add`/`commit` 要一次 full-access。

## 交接

不再加载 `session-archive`，也不再跑 `archive-check`。交接写 10 行：现在能跑到哪、取舍、卡点、下一轮先做什么。新增规则写进对应 skill 和本文件。

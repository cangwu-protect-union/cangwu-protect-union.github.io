# tools/ —— 项目自检

一条命令：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\check.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools\check.ps1 -Staged   # 提交前：多查暂存区与引擎版本闸
powershell -NoProfile -ExecutionPolicy Bypass -File tools\check.ps1 -Last     # 提交后：只扫最后一条提交的密钥
```

退出码 0 表示全过。每一步按顺序跑，任何一步不过都算失败。`-Last` 只跑 gitleaks（`--log-opts=-1`），因为其余检查在提交前已经跑过；`-History` 才复查整段历史。

## 0. 一条命令提交并发布（`publish.ps1`）

```powershell
powershell -File tools\publish.ps1 -Message _local\tmp\msg.txt
powershell -File tools\publish.ps1 -Message msg.txt -Url https://cangwu-protect-union.github.io/rpg6.0/test.html -Expect "新特征串"
```

依次：`check.ps1 -Staged` → `git add -A` + commit → push（失败自动换 HTTP/1.1 重试）→ `check.ps1 -Last` →（给了 `-Url/-Expect` 时）轮询到期望内容出现。工作区干净时只推送、不新建提交。

## 1. `check.js`（零依赖，只用 node 内置模块）

| 检查 | 内容 |
|---|---|
| 编码 | UTF-8 BOM、CRLF、单独 CR、非法 UTF-8 字节 |
| JS | `new Function` 解析，不执行；自动跳过 `#!` 行 |
| HTML | 标签栈配平（跳过 void 元素）、重复 id、`<html lang>`、`<meta charset>` |
| 引用 | `href` / `src` / CSS `url()` 指向的本地文件是否存在 |
| CSS | `{` `}` 配平 |
| 密钥 | `service_role`、`sb_secret_*`、带密码的连接串、硬编码凭据、私钥、AWS key、GitHub / GitLab 令牌、role 不是 `anon` 的 JWT |

`check.js` 只做文件系统能覆盖的部分：它**不派生任何子进程**（DSH 沙箱里 `execFileSync` 会 EPERM，
早期版本把 git 检查放在这里，结果是静默空过还打「全部通过」）。仓库卫生、代码行闸、暂存区
三项在 `check.ps1` 里用 PowerShell 调 git 完成（代码行闸的度量在 `tools/size-report.js`）：

| 检查 | 内容 |
|---|---|
| 仓库 | `git ls-files` 里有没有 `_local/`、`node_modules/`、`.pnpm-store/`、`*.sql`、`*.docx`、`*.zip` |
| 代码行 | `tools/size-report.js --check`：按代码行（非空、非注释）比额度，报超限、75% 预警与结构提醒；规则在 `size-budget.json`，`guitu/js/lib/` 与 `quyu/vendor/` 跳过 |
| 暂存区 | 仅 `-Staged`：`git diff --cached` 里有没有 `_local/`、SQL、Office 文件 |

也可以指向别的目录，用于检查构建产物：

```powershell
node tools/check.js <目录>
```

## 2. 代码行额度（`size-report.js` + `size-budget.json`）

`check.ps1` 会用 `git ls-files` 的清单调 `node tools/size-report.js --check --stdin`。规则全在 `size-budget.json`，脚本里没有硬编码阈值。

| 指标 | 说明 |
|---|---|
| 代码行 | 非空、非注释行；注释与空行不占额度，所以想写注释不会被罚 |
| 额度 | `js`/`mjs` 500、`css` 1000（一行一属性，密度约为 JS 的一半）、`html`/`md` 500、`ps1` 400；`tools/` 与 `.dsh/skills/` 800；硬顶 1000 |
| 预警线 | `warnRatio` 0.75：到 75% 就安排拆分，别等撞线 |
| 豁免 | `exempt[]`：`{path, class, cap, why}` 四样齐全才生效，`cap` 不得超过 `hardCap`；只给“拆了会产生新风险”的文件 |
| 数据文件 | `dataFiles[]` / `dataPrefixes[]`：生成物与平铺数据不计额度，但要写明来源 |
| 结构提醒 | 不阻断：单函数 >80 行、嵌套 >4、参数 >4、最长行 >200、空行率 <3% |

日常用法：

```powershell
node tools/size-report.js                          # 总览：额度表、超限、接近预警、结构提醒、豁免清单
node tools/size-report.js --near                   # 只列接近预警线的文件与余量
node tools/size-report.js --file rpg6.0/js/engine/skills.js   # 单文件明细：余量、最长函数、长行
node tools/size-report.js --check --stdin          # check.ps1 用：有超限退出 1
```

撞线时按这个顺序处理：**拆到新文件** → 确实拆不动就**上调额度并写理由** → 都不该做的是压缩代码。
压缩在这里没有收益：额度按代码行算，把三行并成一行不会减少额度，只会让下一次读更难。

`check.ps1` 与其它 `.ps1` 一样受 Windows PowerShell 5.1 的限制：**只写 ASCII**，中文会因读成 ANSI 变成乱码，
甚至把后面的管道语句读坏（实测：`$sizeOut` 变成空数组，闸静默通过）。

## 3. Biome（可选）

`biome.json` 已按这个项目裁剪过规则，只留能抓真 bug 的，不跑格式化。
没有装 Biome 时这一步自动跳过，只打印一行提示。

安装（默认装到 `_local/bin/`，不进仓库）：

```powershell
node tools/get-biome.js 2.6.4 _local\bin
```

Biome 走 npm 镜像而不是 GitHub Releases：镜像 34 MB 只要几秒，GitHub 走代理要几分钟。要改走 GitHub 就 `node --use-system-ca tools/get-tool.js biomejs/biome`。

`check.ps1` 查找顺序：`PATH` → `_local\bin\biome.exe`。

### 关掉的规则及原因（别重新打开）

| 规则 | 原因 |
|---|---|
| `formatter` | 全项目手写风格已稳定，开格式化会产生几千行 diff，混进功能提交 |
| `security/noSecrets` | 中文散文被判定为高熵字符串，产生 170+ 误报；密钥检查用 `check.js` 自带规则 |
| `correctness/noInnerDeclarations` | 全项目统一在块内声明函数，45 处；不是 bug，改不动 |
| `suspicious/noControlCharactersInRegex` | 误报：源码写的是 `\u0000-\u001f` 转义（`gui-data.js` 的 `safeKeyword`），本意如此 |
| `suspicious/noAssignInExpressions` | `while ((m = re.exec(s)))` 是项目惯用写法 |
| `preset: recommended` 整体 | 默认集在这个代码库上有 598 条，其中 447 条是风格偏好 |

当前基线：0 error、53 warning（`noUnusedVariables` 42、`noGlobalIsNan` 6、`noPrototypeBuiltins` 3、`noUnusedFunctionParameters` 1、`noPrecisionLoss` 1）。warning 不阻断。

## 3. gitleaks（已安装）

版本 8.30.1，在 `_local\bin\gitleaks.exe`，配置是仓库根的 `.gitleaks.toml`。

只扫 **git diff**，不扫工作区文件：`_local/` 里本来就有密码和测试用 JWT，`gitleaks dir` 模式必然报无关项。判据是「有没有进过 git」——没进过就没事，进过一次就必须处理历史；每条提交入库时已经扫过，所以默认不再复查整段历史。

```powershell
powershell -File tools\check.ps1            # 工作区 diff
powershell -File tools\check.ps1 -Staged    # 只扫暂存区
powershell -File tools\check.ps1 -Last      # 只扫最后一条提交
powershell -File tools\check.ps1 -History   # 全历史复查（换机器、改 .gitleaks.toml 时用）
```

`.gitleaks.toml` 用默认规则集全开，只按行内容放行 `publishableKey`（CloudBase 签给匿名访问的 JWT，payload 里 `role=anon`）。**不要改成放行整个 `guitu/data/config.js`**，那样有人把 `service_role` 写进去也扫不出来。

重装（GitHub 访问方式见 `guitu-deploy` skill）：

```powershell
node --use-system-ca tools/get-tool.js gitleaks/gitleaks windows_x64 _local/bin
```

## 4. 文档（已冻结）

2026-11-24 起不再生成 `架构.md`/`访客流程图.md`，`check.ps1` 也不再比对。`docgen` 仍留在 `_local/tools/`，要恢复见 `范围收敛计划.md` §5。

## 5. 回合制 6.0：技能库 lint 与文档数字

两个脚本都在 `tools/`，跟仓库一起走；缺了就是仓库坏了，`check.ps1` 会直接失败，不再跳过。引擎回归在 `tests/engine/`（`run.mjs`、`batch.mjs`），浏览器用例依赖本地 Playwright，仍在 `_local/tests`。

| 脚本 | 管什么 | 失败长什么样 |
|---|---|---|
| `rpg6-lint.js` | 技能库结构：op 在 `opNames` 里、每个 op 的字段与必填项、`mark` / `counter` / `summon` / `use` 的引用存在、数值表达式的 8 个键、`hooks` 名字存在、`conditionText` 与档案一致、`test.html` 加载了全部引擎脚本、`version.js` 与 `config.js` 版本一致、机制文档每个技能 id 都有 `<!-- skill:id -->` 锚点 | 退出码 1，按 `角色 / 技能 / 字段: 原因` 列出来 |
| `rpg6-stats.js --check` | 文档里的角色数、技能数、op 数、`unsupported` 条数与表格、被动钩子、引擎版本、`test.html` 的 script 数 | 退出码 1，报 `文件:行号` 与「磁盘 / 应为」 |

```powershell
node tools\rpg6-lint.js            # --json 给机器读，--warn 只提醒
node tools\rpg6-stats.js --check   # --write 把数字写回去，--json 打印统计
node tools\rpg6-bump.mjs 6.0-engine.12    # 升版本：version.js、data/config.js 与文档一起改
```

回合制改动的验收只需一条命令（plan → 引擎单测 → 冒烟压测 → 本节所有闸）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .dsh/skills/rpg6-character-batch/scripts/verify.ps1
```

改了对局页、技能结算或样式加 `-Browser` 跑浏览器组；全量压测加 `-Full`。

文档里的数字写在带名字的标记区间里，区间内容由脚本整段重写，区间外的句子仍是手写：

```markdown
- 引擎版本：`<!-- RPG6-STATS:START version -->6.0-engine.13<!-- RPG6-STATS:END version -->`
```

区间名就是生成器名，见 `rpg6-stats.js` 的 `RENDERERS`。参与生成的文档有六处：`rpg6.0/游戏说明.md`（玩家看的数与 unsupported 表）、`rpg6.0/README.md`（op 表）、`rpg6.0/架构.md`（op 数）、`tools/README.md`（本节版本号）、`.dsh/skills/rpg6-battle/SKILL.md`、`.dsh/skills/rpg6-character-batch/引擎能力表.md`（被动钩子）。**不要手改这些数字**，`--check` 会抓住。其它文档不再复制这些数字，需要时指向《游戏说明》。

op 的参数字典在 `tools/rpg6-spec.js`：`OPS` 同时是 lint 的字段白名单和 `rpg6.0/README.md` 里 op 表的来源。新增一个 op 要改三处 —— `effect-ops.js` 的 `case`、同文件的 `opNames`、字典里的一条；`lint.test.mjs` 会断言 `opNames` 与 `runOp` 的 `case` 集合一致。

### 引擎版本守卫（`check.ps1 -Staged`）

改了 `rpg6.0/js/engine/` 下的规则文件（`rules` `damage` `state` `effect-ops` `skills` `timeline` `actions` `conditions` `summons` `traits`），而 `version.js` 的 `ENGINE_VERSION` 没变 → 失败。旧战报按版本判断是否「旧引擎」，漏升版本会让旧战报被当成新引擎结算结果。

不改变结算的改动（新增导出、注释、版本号搬迁）可以临时跳过，提交信息里写明原因：

```powershell
$env:DSH_SKIP_ENGINE_VERSION_GUARD = 1
powershell -File tools\check.ps1 -Staged
```

## 6. 其他单文件工具

```powershell
node --use-system-ca tools/get-tool.js <owner/repo> <资源名正则> _local\bin
```

自动取 latest release、挑匹配的资源、按 API 给的 sha256 校验、解包、把可执行文件放进 `_local\bin`。zip / tar / tgz 都走 Windows 自带的 `tar`。

## 7. `design-audit.js`（体检报告，不进 `check.ps1`）

```powershell
node tools/design-audit.js           # 人看的报告
node tools/design-audit.js --json    # 全量，给脚本比对
node tools/design-audit.js D:\别处    # 指向别的目录
```

量的是语法检查管不着、眼睛又数不准的东西：

| 项 | 内容 |
|---|---|
| 字号 | `font-size` 的档位数、最小值、每种用了几次、落在哪个选择器，<12px 单独标出 |
| 圆角 | `border-radius` 的档位数与次数 |
| 装饰 | 渐变、毛玻璃、发光阴影、装饰动画；`0 0 0 Npx` 的 `:focus` 焦点环单列为「焦点环」，不算装饰 |
| 颜色 | `:root` 之外硬编码的 hex、已定义变量数、`var()` 使用次数 |
| emoji | HTML 正文里的 emoji 与箭头符号，带 `文件:行` |

退出码恒为 0：它是报告不是门禁，不阻断 `check.ps1`。判断标准与目标取值在项目根 `DESIGN.md`，清单已归档到 `_local/skills-archive/guitu-design/SKILL.md`。

## 已知边界

- `_local/`、`lib/`（vendored）、`preview/`、`node_modules/`、`.pnpm-store/`、`.dsh/` 不参与扫描；`.dsh/skills/` 里的文件要单独确认编码。
- `check.js` 自己不在密钥规则范围内（规则字面量会自我命中）。
- HTML 只做结构检查，不校验 DOM 行为；页面行为需要跑 `site-e2e-tests` 的浏览器组，或 `verify.ps1 -Browser`。
- 本地引用检查不认运行时拼接出来的路径（如 `data/${name}.json`）。

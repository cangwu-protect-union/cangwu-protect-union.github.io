# tools/ —— 项目自检

一条命令：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\check.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools\check.ps1 -Staged
```

退出码 0 表示全过。四步检查按顺序跑，任何一步不过都算失败。

## 1. `check.js`（零依赖，只用 node 内置模块）

| 检查 | 内容 |
|---|---|
| 编码 | UTF-8 BOM、CRLF、单独 CR、非法 UTF-8 字节 |
| JS | `new Function` 解析，不执行；自动跳过 `#!` 行 |
| HTML | 标签栈配平（跳过 void 元素）、重复 id、`<html lang>`、`<meta charset>` |
| 引用 | `href` / `src` / CSS `url()` 指向的本地文件是否存在 |
| CSS | `{` `}` 配平 |
| 密钥 | `service_role`、`sb_secret_*`、带密码的连接串、硬编码凭据、私钥、AWS key、GitHub / GitLab 令牌、role 不是 `anon` 的 JWT |
| 仓库 | `git ls-files` 里有没有 `_local/`、`node_modules/`、`.pnpm-store/`、`*.sql`、`*.docx`、`*.zip` |

`-Staged` 额外检查 `git diff --cached` 里有没有 `_local/`、SQL、Office 文件。

也可以指向别的目录，用于检查构建产物：

```powershell
node tools/check.js <目录>
```

## 2. Biome（可选）

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

只扫 **git 历史**，不扫工作区：`_local/` 里本来就有密码和测试用 JWT，`gitleaks dir` 模式必然报 4 条无关的。判据是「有没有进过 git」——没进过就没事，进过一次就必须处理历史。

```powershell
powershell -File tools\check.ps1            # 全历史扫描，38 个提交约 1 秒
powershell -File tools\check.ps1 -Staged    # 只扫暂存区
```

`.gitleaks.toml` 用默认规则集全开，只按行内容放行 `publishableKey`（CloudBase 签给匿名访问的 JWT，payload 里 `role=anon`）。**不要改成放行整个 `guitu/data/config.js`**，那样有人把 `service_role` 写进去也扫不出来。

重装（GitHub 访问方式见 `guitu-deploy` skill）：

```powershell
node --use-system-ca tools/get-tool.js gitleaks/gitleaks windows_x64 _local/bin
```

## 4. 文档新鲜度（`_local/tools/build-docs.js --check`）

主站与每个模块的 `架构.md`、`访客流程图.md`（当前六份）由 `_local/tools/docgen.js` 从源码生成，
模块清单在 `_local/tools/docgen.config.js`；新增模块只加一条配置。
`--check` 只在内存里生成一遍，与磁盘上的文件逐字比对，不写盘、不渲染 PNG；不一致就退出 1，并报出文件名和第一个不同的行号。

```powershell
node _local\tools\build-docs.js --check
```

`_local/` 被 gitignore，所以 `check.ps1` 找不到这个脚本时跳过并打一行提示。
生成前还会自检：有页面的目录都登记过模块、每个 `.html` 都登记了访问级别、标为需要验证的页面确实加载了 `gui-gate.js`、跨模块引用的文件存在、流程图覆盖全部页面且边的端点存在。

## 5. 其他单文件工具

```powershell
node --use-system-ca tools/get-tool.js <owner/repo> <资源名正则> _local\bin
```

自动取 latest release、挑匹配的资源、按 API 给的 sha256 校验、解包、把可执行文件放进 `_local\bin`。zip / tar / tgz 都走 Windows 自带的 `tar`。

## 6. `design-audit.js`（体检报告，不进 `check.ps1`）

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

退出码恒为 0：它是报告不是门禁，不阻断 `check.ps1`。判断标准与目标取值在项目根 `DESIGN.md`，清单的可执行版在 skill `guitu-design`。

## 已知边界

- `_local/`、`lib/`（vendored）、`preview/`、`node_modules/`、`.pnpm-store/`、`.dsh/` 不参与扫描；`.dsh/skills/` 里的文件要单独确认编码。
- `check.js` 自己不在密钥规则范围内（规则字面量会自我命中）。
- HTML 只做结构检查，不校验 DOM 行为；页面行为需要跑 `guitu-browser-test`。
- 本地引用检查不认运行时拼接出来的路径（如 `data/${name}.json`）。

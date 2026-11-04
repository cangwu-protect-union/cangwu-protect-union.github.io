# tools/ —— 项目自检

一条命令：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\check.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools\check.ps1 -Staged
```

退出码 0 表示全过。三条检查按顺序跑，任何一条不过都算失败。

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

本机 github.com 被 hosts 指向 127.0.0.1，拿不到 GitHub Releases，所以脚本从 npm 镜像取 `@biomejs/cli-win32-x64`，并用 registry 返回的 sha512 校验后再解包。校验不通过会直接放弃安装。

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

当前基线：0 error、23 warning（`noUnusedVariables` 17、`noGlobalIsNan` 4、`noPrototypeBuiltins` 1、`noUnusedFunctionParameters` 1）。warning 不阻断。

## 3. gitleaks（可选，未安装）

没装时跳过。它比 `check.js` 多的是**扫 git 历史**和一百多条云厂商密钥规则。
安装要访问 github.com，本机被 hosts 指向 127.0.0.1（见 `guitu-deploy` skill），恢复后再装。

## 4. `design-audit.js`（体检报告，不进 `check.ps1`）

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

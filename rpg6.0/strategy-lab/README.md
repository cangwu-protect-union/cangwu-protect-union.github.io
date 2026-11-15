# 策略实验室

在本地直接调用回合制 6.0 引擎，给角色自动练打法、跑胜率矩阵、判定每对角色属于静止、封闭还是开放。

- 面向使用者的说明：[使用说明.md](使用说明.md)
- 面向实现者的设计：[实现方案.md](实现方案.md)
- 结构与数据流：[架构.md](架构.md)

## 它做什么

```
角色表 → 训练打法（双方轮流，进化搜索）
        → 3×3 胜率矩阵（自适应采样）
        → 状态判定（极差 → 鞍点 → 子类）
        → report.md / report.html / run.json
```

站点上的 [lab.html](../lab.html) 只做展示：读数据库里的历史运行，读不到就退回随站点发布的 `data/lab-snapshot.js`。页面不跑对局。

## 快速开始

```
node rpg6.0/strategy-lab/selftest.mjs          # 自检，8 项
node rpg6.0/strategy-lab/lab.mjs --chars=5     # 跑一次，约 2 分钟
```

产物写到 `_local/strategy-lab/runs/<时间戳>/`（`_local` 不推送）：

| 文件 | 用途 |
|---|---|
| `report.md` | 纯文本报告 |
| `report.html` | 单文件热力图，双击即开 |
| `run.json` | 完整数据（矩阵、打法、判定），上传与导出的输入 |
| `verdicts.json` | 判定摘要 |
| `policies.json` | 全部打法与训练轨迹 |

## 发布到站点

**方式一：更新兜底快照（最简单）**

```
node rpg6.0/strategy-lab/lab.mjs --stage=export --from=_local/strategy-lab/runs/<时间戳>
```

会重写 `rpg6.0/data/lab-snapshot.js`，提交后站点页面就能看到这次结果。

**方式二：上传数据库（保留历史）**

1. 先在 CloudBase 控制台执行 `_local/sql/rpg-lab-setup.sql`（幂等，可整份重跑）。
2. 取令牌：开 `http://127.0.0.1:9300/_local/tests/lib/token.html`，答题后复制。
3. 上传：

```
node rpg6.0/strategy-lab/upload.mjs --from=_local/strategy-lab/runs/<时间戳> --token=<令牌>
```

也可以先 `--dry-run` 看会传什么。

数据库里有多条运行时，页面顶部会出现运行选择器；读数据库失败时自动退回快照。

## 目录

```
rpg6.0/strategy-lab/
  lab.mjs            命令行入口（跑批 / 导出 / 标定）
  selftest.mjs       验收自检
  upload.mjs         上传到 CloudBase
  lib/               engine enumerator calibration policy battle matrix analyze train report report-html
  data/calibration.json   技能标定表（生成物，跟 engineVersion 绑定）
```

站点侧：

```
rpg6.0/lab.html                 页面
rpg6.0/css/lab.css              样式（只作用于 .lab-*）
rpg6.0/js/lab/lab-view.js       矩阵渲染
rpg6.0/js/lab/lab-page.js       取数、筛选、展开
rpg6.0/data/lab-snapshot.js     兜底快照（生成物）
```

## 数据表

两张表，读写策略见 `_local/sql/rpg-lab-setup.sql`：

| 表 | 关键列 |
|---|---|
| `rpg_lab_runs` | `id` uuid、`created_at`、`engine_version`、`chars`、`config`、`summary`、`note` |
| `rpg_lab_pairs` | `run_id`、`a`、`b`、`state`、`mode`、`strength`、`resolve`、`stable`、`avg_win_a`、`draw_rate`、`spread`、`games`、`cells`、`policies`、`verdict` |

读是公开的（`using (true)`），写要 `gui_token_ok()`。要收紧成只读成员可见，把 `rpg_lab_runs_read` / `rpg_lab_pairs_read` 的策略改成 `using (gui_token_ok())`，页面再在跳转前加验证。

## 引擎升级后

1. `data/config.js` 的 `engineVersion` 一变，`data/calibration.json` 就与版本不符，跑批会直接报错。
2. 重建标定表：`node rpg6.0/strategy-lab/lab.mjs --stage=calibrate`
3. 重跑一次并导出快照，否则站点上是旧引擎的结论。
4. 快照头部会写生成时间，页面底部显示引擎版本，对照即可。

## 已知限制

- 结论只对训练出的那几套打法成立，不是"这个角色的绝对强弱"。
- 策略是 18 个权重的线性打分函数，表达不了"留技能等反击"这类条件分支；矩阵极差为 0 时说明这套空间分不出差别，不代表游戏没有深度。
- 只看单挑，三方克制循环测不出来。
- 单进程跑，19 角色 171 对约 30 分钟；需要更快再加 worker 池。

## 交接要点

- 判定口径与三处历史 bug（先鞍点、极差归零、优势算错）写在 `实现方案.md` 第 12 节。
- 算法优化（更丰富的策略空间、PSRO）留给后续会话，接口边界见 `架构.md` 第四节。
- 改完跑 `powershell -NoProfile -ExecutionPolicy Bypass -File tools\check.ps1`。

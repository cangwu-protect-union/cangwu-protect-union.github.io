---
name: rpg6-strategy-lab
description: 回合制 6.0 的策略实验室：本地跑对局、练打法、算胜率矩阵、判定每对角色是静止/封闭/开放。跑或改 rpg6.0/strategy-lab、lab.html、判定口径、技能标定表，或要发布新一期实验室结果时加载。
---

# 策略实验室

## 什么时候加载

- 要跑一次实验室（`lab.mjs`），或改训练 / 判定 / 标定逻辑
- 改站点页 `rpg6.0/lab.html`、`js/lab/*`、`data/lab-snapshot.js`
- 要上传结果到数据库，或修 `rpg_lab_runs` / `rpg_lab_pairs`
- 引擎升版后要重跑标定与快照

## 一条命令能跑通

```
node rpg6.0/strategy-lab/selftest.mjs
node rpg6.0/strategy-lab/lab.mjs --chars=5
node rpg6.0/strategy-lab/lab.mjs --stage=export --from=_local/strategy-lab/runs/<时间戳>
node rpg6.0/strategy-lab/upload.mjs --from=_local/strategy-lab/runs/<时间戳> --token=<令牌>
```

产物在 `_local/strategy-lab/runs/<时间戳>/`：`report.md`、`report.html`、`run.json`、`verdicts.json`、`policies.json`。

## 三道数据链路

1. 计算：本机 Node，`lib/` 里训练 → 矩阵 → 判定。
2. 存储：`run.json` 是唯一契约；`--stage=export` 写 `rpg6.0/data/lab-snapshot.js`（进仓库），`upload.mjs` 写数据库两张表。
3. 展示：`lab.html` 读数据库，失败/为空退快照。页面不跑对局。

## 判定口径（改之前先读）

顺序是 **极差 → 鞍点 → 子类**。反过来会踩坑：全是 100% 的矩阵到处是鞍点。

| 条件 | 结论 |
|---|---|
| 极差 < 0.15 且一边倒（均值偏离 0.5 ≥ 0.2） | 静止 · 策略无关 |
| 极差 < 0.15 且五五开 | 开放 · 平坦 |
| 有鞍点，优势 ≥ 0.10 | 静止 · 唯一最优 / 多重最优（优势 ≥ 0.25 记强） |
| 有鞍点，优势 < 0.10 | 开放 · 弱鞍点 / 单向 |
| 无鞍点 | 封闭 |

「优势」= 最好那行的保底 − 最差那行的保底，**不是**与第二名的差。两行并列必胜时后者是 0，会把占优误判成弱鞍点。

## 踩过的坑

1. **标定表 `tick` 提前结算**：标定时必须把 `skill.ops` 原样交给 `runOps`，不能展开 `if`/`tick` 的内层 ops，否则延迟伤害被当场结算，估出来的伤害虚高。
2. **普伤是减法**：`max(0, 攻击 − 防御)`；法伤才是 `攻击 ÷ 100 × (100 − 法抗)`。按比例缩放普伤会全错。
3. **`B.effectOps.valueOf` 是坏的**：`api.valueOf = valueOf` 引用了未定义的 `valueOf`，实际等于 `Object.prototype.valueOf`，调用拿到的是对象。要数值就自己遍历 ops 或走标定表。
4. **精英会收敛成同一种行为**：只取前 3 名会让矩阵极差恒为 0。选择时按「对手池胜率向量」做多样性，保留最强 + 最不同的。
5. **引擎对局常常是确定性的**：同一对打法打 40 局全同。矩阵用自适应采样，`certain` 标记提前收手，别硬跑 400 局。
6. **产物的位置**：`runs/` 在 `_local` 下。放仓库里会被 `check.ps1` 扫到（文件数、编码检查）。
7. **`data/lab-snapshot.js` 是生成物**：手工改会被下一次导出覆盖；引擎升版后忘记重导，站点会一直显示旧结论。
8. **数据库没建表时**：页面 `rpg_lab_runs` 请求 404，控制台有一条错误，属预期；迁移脚本在 `_local/sql/rpg-lab-setup.sql`，结尾有 `notify pgrst`。
9. **上传令牌走 `Prefer`**：`return=representation, gui-token=...`，不能覆盖已有 Prefer 指令。

## 发布流程

1. `node rpg6.0/strategy-lab/selftest.mjs` 全绿
2. `node ... lab.mjs --chars=5 --export`
3. `node _local/tools/build-docs.js`（lab 页在 docgen 里登记过）
4. `tools\check.ps1` 退出码 0
5. 提交 `rpg6.0/lab.html`、`js/lab/*`、`data/lab-snapshot.js`、`strategy-lab/*`、生成的文档
6. 推送后轮询 `https://cangwu-protect-union.github.io/rpg6.0/lab.html`

## 边界

- 结论只对训练出的那几套打法成立，不是角色绝对强度。
- 策略是 18 权重线性打分（3 档血量 × 6 特征），表达不了条件分支；极差 0 不代表游戏没深度。
- 单挑分析看不到三方循环。
- 算法升级（更丰富的策略空间、PSRO）是后续会话的事，接口边界写在 `rpg6.0/strategy-lab/架构.md` 第四节。

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

顺序是 **极差近零 → 纯鞍点 → 混合均衡**。反过来会踩坑：全是 100% 的矩阵到处是鞍点。实现全在 `lib/analyze.mjs`（`labelOf`/`nashOf`/`solveMixed`/`sensitivityOf`）。

| 条件 | 结论 |
|---|---|
| 极差 < 0.05 且一边倒（均值偏离 0.5 ≥ 0.2） | 静止 · 策略无关 |
| 极差 < 0.05 且五五开 | 开放 · 平坦 |
| 有纯鞍点，优势 ≥ 0.10 | 静止 · 唯一最优 / 多重最优（优势 ≥ 0.25 记强） |
| 有纯鞍点，优势 < 0.10 | 开放 · 弱鞍点 / 单向（一方行保底全同 → 该方无选择） |
| 无鞍点（混合均衡，双方支撑 ≥2） | 封闭 · 克制循环，强度按深度分 |

- 「优势」= 最好行保底 − **其余行里最好的保底**（并列最优不算第二名）。不能用「与最差行的差」：那会把最差打法的坏算进最好打法的好。
- 深度分 =（列极小极大 − 行极大极小）/ 2，即均衡面前纯策略打法的可榨取值；封闭强度：≥ 0.25 强、≥ 0.10 中、否则弱。
- 混合均衡用**支撑枚举**解（≤ 8×8 直接枚举支撑对、解线性方程组、校验支撑外不等式），无外部依赖。
- 灵敏性：每格 Wilson 区间下/上端点重判，状态翻转记 `sensitive.stable: false`。
- 训练内用 `nashOf` 求均衡混合给最佳回应当靶子；最终判定与训练互不知道对方。

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
10. **均衡求解器的支撑外校验方向**：列是极小化方（val < v 才想偏离），行是极大化方（val > v 才想偏离），方向写反时满支撑矩阵测不出来，非对称矩阵才现形（曾把 v=0.5 算成 1）。回归用例在 selftest 的 5×4/3×2 非对称矩阵。
11. **混合均衡的 x/y 是支撑相对数组**：`solveMixed` 只返回支撑上的权重，对上策略池要按 `S`/`T` 展开成全长度，否则 obj 与留出验证会取错策略。
12. **BR 搜索预算不够会假收敛**：pop 8×3 代找不到对手的反制策略时，榨取值 0 是搜索失败不是真均衡。用 pop 10×5 代 + 现任最优做种子；仍不收敛的（骰子噪声对）看 stopReason=br-dup。
13. **单种子训练结论是策略库相对的**：同一对不同种子各找到对方没有的好策略。每对跑 3 个训练种子、合并策略池（去重、按最差胜率修剪到 8）再重判。
14. **先手随机性**：引擎 `state.rng & 1` 决定谁先手，同一格不同种子窗口结果可以不同；「certain」只对采样过的种子窗口成立，灵敏性（Wilson 重判）是兜底。

## 发布流程

1. `node rpg6.0/strategy-lab/selftest.mjs` 全绿
2. `node ... lab.mjs --chars=5 --export`
3. `node _local/tools/build-docs.js`（lab 页在 docgen 里登记过）
4. `tools\check.ps1` 退出码 0
5. 提交 `rpg6.0/lab.html`、`js/lab/*`、`data/lab-snapshot.js`、`strategy-lab/*`、生成的文档
6. 推送后轮询 `https://cangwu-protect-union.github.io/rpg6.0/lab.html`

## 边界

- 结论只对训练出的策略库成立，不是角色绝对强度。
- 策略是条件规则表（默认权重 + ≤4 条「8 特征条件→权重」规则），表达不了长序列规划；BR 是进化搜索，可能局部最优，榨取值只对 BR 搜索能力成立。
- 单挑分析看不到三方循环。
- 需要元博弈层（alpha-rank 全角色排序 + 三角循环）时再做，接口边界见 `rpg6.0/strategy-lab/架构.md` 第四节。

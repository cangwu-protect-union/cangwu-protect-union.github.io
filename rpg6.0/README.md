# rpg6.0 —— 回合制正传 6.0 角色档案

以档案形式维护回合制正传 6.0 的角色与规则：角色公开查阅、开放投稿、成员编撰与审核；规则只由开发人员改代码编撰。
`test.html` 是占位页。

## 四条硬规则

1. **图片只能随投稿进入系统。** 建档后图片只读；审核转正时也不能改图。
2. **没有「新增角色」入口。** 新角色只能由「投稿 → 审核 → 转正」产生。
3. **审核时的修改不写回投稿。** 改动只写进角色表，投稿行只更新状态、审核人、审核时间与备注。
4. **规则只能由开发人员改代码。** 正文写在 `data/rule-docs.js`，网页上没有编辑入口，也不进数据库。

## 页面

### 公开（不需要验证）

| 文件 | 作用 |
|---|---|
| `rpg6.0.html` | 角色列表：关键词、评级、职业筛选，时间正序/倒序，12 条一页。不显示图片 |
| `character.html?id=` | 角色详情。图片折叠在页面最底部，默认收起；审核人与最近编辑各一行 |
| `rules.html` | 规则列表：只有条目名，点进去看正文；不读数据库，无搜索框 |
| `rule.html?id=` | 规则正文。内容来自 `data/rule-docs.js`，公开只读 |
| `provide-tip.html` | 投稿表单，文本 + 图片，不需要验证 |
| `test.html` | 游戏测试占位页 |

### 编辑区（需要组织验证）

| 文件 | 作用 |
|---|---|
| `edit-characters.html` | 编撰列表：全部角色（含已删除），编辑 / 删除 / 恢复 |
| `edit-character.html?id=` | 角色编辑器；`?submission=` 时是审核转正表单 |
| `review.html` | 投稿审核：待审 / 已通过 / 已驳回 |
| `old-characters.html` | 旧档案总览 |
| `old-character.html?id=` | 某角色的全部历史版本，可恢复已删除角色 |
| `version.html?v=` | 单版本只读，可「应用这个版本」 |

## 脚本

```
js/
├── rpg-data.js        数据层：所有数据库读写的唯一出口
├── rpg-form.js        表单渲染/收集/校验、人员下拉、确认框、图片上传
├── list.js            公开列表
├── character.js       角色详情
├── rules.js           规则列表
├── rule.js            单条规则
├── provide-tip.js     投稿
├── review.js          投稿审核
├── edit-characters.js 编撰列表
├── edit-character.js  编辑器 / 转正表单
├── old-characters.js  旧档案总览
├── old-character.js   某角色的历史版本
└── version.js         单版本查看
```

角色页面脚本只依赖 `rpg-data.js` 与 `rpg-form.js`，彼此之间没有横向依赖；规则两页只读 `data/rule-docs.js`。

## 数据

数据在腾讯云 CloudBase（PostgreSQL），三张表：

| 表 | 说明 |
|---|---|
| `rpg_characters` | 角色。软删除用 `deleted`，作者与人员字段都在这里 |
| `rpg_character_versions` | 旧档案，只增不改，`applied` 标记已应用 |
| `rpg_submissions` | 投稿，`status` ∈ pending / approved / rejected |

两个只读函数：`rpg_search`（筛选 + 分页 + 总数）、`rpg_facets`（筛选下拉的选项）。
迁移脚本在 `_local/sql/rpg-setup.sql`，旧档案导入在 `_local/sql/rpg-seed-characters.sql`。

`data/characters.js` 是 33 条内置副本，**只在云端不可用时兜底**；正常页面只读数据库。

`data/rule-docs.js` 是规则条目的标题与 HTML 正文，也是规则唯一的来源。改它等于改规则，刷新页面就生效，不写数据库、没有后台界面。

## 与其它模块的共用

| 共用物 | 方式 |
|---|---|
| `../guitu/data/config.js` | 直接加载，提供 `GUI_CLOUDBASE`；不复制密钥 |
| `../guitu/js/gui-gate.js` | 直接加载，与鬼图鉴共用同一套组织验证与令牌 |
| `../guitu/js/gui-upload.js` | 直接加载，共用 `gui-images` 桶 |

改这三个文件会同时影响其它模块。`gui-upload.js` 里的 HEIC 库路径已经改成按脚本自身地址解析，本模块直接加载不会再 404。

## 数据流

读：

```
页面 → rpg-data.js → POST /v1/rdb/rest/rpc/rpg_search → 渲染
                   ↘ 云端不可用 → data/characters.js
```

写（必须带令牌）：

```
gui-gate.js → POST /rpc/gui_verify → 令牌存 sessionStorage
写操作 → rpg-data.js → Prefer: return=minimal, gui-token=<令牌> → RLS 校验
```

规则（不经过数据层）：

```
rules.html / rule.html → data/rule-docs.js → 渲染列表或正文
```

## 容易踩的坑

- `Prefer` 头必须拼接：`"return=minimal, gui-token=" + token`，覆盖会丢令牌。
- 写 `rpg_submissions` 不能用 `return=representation`：它的读策略按状态过滤，会把 PATCH 挡成 `42501`。
- 转正是两步写入（建角色 → 改投稿状态）。第二步失败时再点一次保存：先查 `source_submission_id`，已有角色就只补状态，不会建重复。
- 六维是文本列，不校验数字：旧档案里 31 号的攻击值是「受攻击者当前血量的20%」。
- 审核人、操作人每次都要重选，不记忆上次选择。
- 规则正文是手写 HTML，直接 `innerHTML`；它只能由开发人员改，所以没有 sanitize。以后若要开放网页编辑，必须先补 sanitize 与权限层。
- 规则数据文件不能叫 `data/rules.js`：会和 `js/rules.js` 撞名，`docgen.config.js` 的 `roles` 按文件名取值，两个节点会显示成同一个标签。

## 原始资料

`archive/doc/*.txt` 是 33 份原始角色档案，`archive/picture/*.jpeg` 是对应图片（1–19，其中 1–4 未被角色引用）。
角色与图片按人物对应，同一张合影可对应多名角色。
导入数据库后 txt 不再参与渲染，保留作核对依据。规则两份底稿在 `_local/docs/规则介绍.txt`、`_local/docs/职业介绍.txt`。

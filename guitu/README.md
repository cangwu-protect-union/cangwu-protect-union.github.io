# guitu —— 鬼图鉴模块

鬼与灵异现象的数据库。**自成一块**：所有页面、脚本、数据都在这个目录里，
主站（首页 / 关于 / 项目）不依赖它，它只借用主站共用的样式文件。

---

## 页面

### 公开访问（不需要验证）

| 文件 | 作用 |
|---|---|
| `guitu.html` | 图鉴列表，支持按标题搜索 |
| `条目.html?id=…` | 条目详情（只读） |
| `provide-tip.html` | 提供情报，**开放投稿**，任何人可提交 |
| `tips.html` | 查看情报列表 |
| `tips-entry.html?id=…` | 情报详情（只读） |

### 编辑区（需要组织验证）

| 文件 | 作用 |
|---|---|
| `edit-gui.html` | 编辑图鉴列表，进入编辑区的入口 |
| `edit-entry.html?id=…` | 条目编辑器：改标题/标签、增删文段、增删图片、删除条目 |
| `add-gui.html` | 增加条目，可「引用情报」 |
| `pick-tips.html` | 引用情报的勾选界面 |
| `old-gui.html` | 旧图鉴，被改过/删过的条目都在这里 |
| `old-entry.html?id=…` | 某条目的全部历史版本 |
| `版本.html?v=…` | 查看单个历史版本，可「应用」 |

---

## 脚本

```
js/
├── gui-data.js       数据层：所有数据库读写的唯一出口
├── gui-gate.js       组织验证：调数据库函数校验答案，拿会话令牌
├── gui-upload.js     图片处理：压缩、缩略图、HEIC 转码、上传
│
├── guitu.js          公开图鉴列表
├── entry.js          条目详情
├── add-gui.js        增加条目 + 提供情报（两个页面共用一个脚本）
├── edit-gui.js       编辑图鉴列表
├── edit-entry.js     条目编辑器
├── old-gui.js        旧图鉴
├── old-entry.js      历史版本列表
├── version.js        查看版本
├── tips.js           查看情报列表
├── tips-entry.js     情报详情
├── pick-tips.js      引用情报
└── lib/
    └── heic2any.min.js   HEIC 转码库（1.3 MB，只在遇到 HEIC 时才加载）
```

**依赖方向**：页面脚本 → 上面三个基础模块（data / gate / upload）。
基础模块之间不互相依赖，页面脚本之间也不互相依赖。

---

## 数据

```
data/
├── config.js        云端环境配置（envId + 公开密钥）
├── gui-entries.js   6 条示例条目 + 按标题首字生成的占位图
└── entries.json     静态兜底数据（云端不可用时用）
```

数据实际存在**腾讯云 CloudBase（PostgreSQL）**，通过 PostgREST 访问。
`config.js` 里的密钥是「可公开密钥」，设计上就允许放在前端；
真正拦住写操作的是数据库的行级安全策略。

---

## 两条数据流

### 读（任何人）

```
页面 → gui-data.js → GET /v1/rdb/rest/gui_entries → 渲染
```

云端不可用时自动回退到 `data/gui-entries.js` 里的示例数据，页面不会白屏。

### 写（必须带令牌）

```
gui-gate.js → 算答案的 SHA-256
            → POST /rpc/gui_verify
            → 数据库比对 gui_secrets 表里的哈希
            → 通过则签发 2 小时令牌（存 sessionStorage）
            
写操作 → gui-data.js → 请求头带 Prefer: gui-token=<令牌>
                      → 数据库 RLS 策略校验令牌
                      → 通过才写入
```

**答案的哈希不在任何 JS 文件里**，网页读不到；没有令牌直接调 API 会被拒绝。

---

## 安全设计

| 设计 | 目的 |
|---|---|
| 答案哈希存在数据库，不在前端 | 看源码拿不到密码 |
| 写入必须带令牌（RLS 校验） | 绕过网页也写不进数据 |
| 删除只是打标记（软删除） | 数据永远不真正消失 |
| 版本表只增不删 | 历史内容毁不掉，最坏也能恢复 |
| 情报单独建表 | 和图鉴物理隔离，不会混进公开图鉴 |

---

## 与主站的关系

- 共用样式：`../css/style.css`（页面里引用时注意这个相对路径）
- 主站项目页有三个入口指向本模块：
  `guitu/guitu.html`、`guitu/provide-tip.html`、`guitu/edit-gui.html`
- 本模块的页面回主站时用 `../index.html`、`../projects.html`
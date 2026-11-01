# CPU及回合制游戏工作室联合组织 · 官方网站

苍梧的保护者结成的联盟，对抗鬼的最前线。

本仓库是这个组织的公开门户网站，用原生 HTML + CSS 手写，没有框架、没有构建步骤。

---

## 本次发布内容

- **首页** —— 组织简介、重要活动历史、可公开的行动规划
- **关于** —— 三个下属组织、公开活动与机密活动、成员代号
- **项目** —— 正在开发和运营的项目
- **鬼图鉴** —— 鬼与灵异现象的公开数据库，含编辑、版本、旧图鉴、情报投稿与引用

---

## 关于组织

CPU及回合制游戏工作室联合组织（the joint organization of Cangwu Protect Union and
Institution of Role-Play-Games），简称 CPU，于 2022 年建立。目前包含三个组织：

| 简称 | 全称 | 职能 |
|---|---|---|
| CPU | Cangwu Protect Union | 未知区域探索、异常镇压、受害者救助 |
| ICU | Information contributor Union | 情报整理、数据分析、条目编纂 |
| — | 回合制游戏工作室 | 游戏开发、投稿审核、版本更新 |

对外联络请通过组织内部渠道。

---

## 技术说明

```
.
├── index.html          首页          ┐
├── about.html          关于          │ 主站（三页 + 共用样式）
├── projects.html       项目          ┘
├── css/
│   └── style.css       全站样式（主站和鬼图鉴共用）
│
├── guitu/              ★ 鬼图鉴模块（自成一块，详见 guitu/README.md）
│   ├── README.md           模块说明：页面职责、数据流、安全设计
│   ├── *.html              12 个页面（公开 5 个 + 编辑区 7 个）
│   ├── data/               配置、示例数据、静态兜底
│   └── js/                 数据层、验证、上传 + 各页面逻辑 + HEIC 库
│
├── _local/             ★ 本地工作区（不推送，详见 _local/README.md）
│   ├── sql/                数据库迁移脚本
│   ├── docs/               任务文档、更新记录
│   ├── notes/              说明文档、私人笔记
│   ├── assets/             本地素材
│   └── preview/            页面截图
│
├── .gitattributes      换行符统一为 LF
├── .gitignore          忽略清单（_local/ 整个目录被排除）
├── .vscode/            编辑器项目设置（UTF-8 + LF）
└── README.md           本文件
```

划分原则很简单：**能公开的按模块放，不能公开的统一进 `_local/`**。
根目录只留主站三页和共用样式，打开文件夹一眼就能看出结构。

**纯静态**——没有后端、没有数据库服务需要自己跑、不需要编译。
鬼图鉴的数据存在腾讯云 CloudBase（PostgreSQL），页面本身仍是纯静态。

本地预览请用静态服务器（直接用 `file://` 打开会导致图鉴功能受限）：

```bash
python -m http.server 8000
# 主站      http://localhost:8000/
# 鬼图鉴    http://localhost:8000/guitu/guitu.html
```

---

## 修改约定

如果你想参与维护这个网站，请遵守以下约定：

1. **编码必须是无 BOM 的 UTF-8**。项目含大量中文，编码一旦变成 ANSI/GBK，全站乱码。
2. **换行符用 LF**。`.gitattributes` 和 `.vscode/settings.json` 已做好强制约束。
3. **一个中文字段不要跨行书写**。HTML 会把源码里的换行压缩成一个空格，中文句子中间会多出空格。
4. **不要提交真实联系方式**。所有成员一律使用代号，联系方式通过 `mailto:` 之外的渠道私下传递。
5. **提交前先看 `git status`**。避免把 Office 临时锁文件（`~$xxx.md`）、`.preview/` 截图误提交。

---

## 配色与样式

全站配色集中在 `css/style.css` 顶部的 `:root` 变量里：

```css
:root {
  --bg:        #ffffff;   /* 背景色 */
  --fg:        #1f2328;   /* 正文颜色 */
  --accent:    #0969da;   /* 强调色 */
  --max-width: 760px;     /* 正文最大宽度 */
}
```

改这一处，所有页面同时生效。深色模式在 `@media (prefers-color-scheme: dark)` 里自动适配，
窄屏适配在文件末尾的 `@media (max-width: 560px)` 里。

---

## 部署

本站托管于 GitHub Pages，由 `main` 分支根目录直接发布。
推送后一两分钟内自动生效。
# CPU及回合制游戏工作室联合组织 · 官方网站

苍梧的保护者结成的联盟，对抗鬼的最前线。

本仓库是这个组织的公开门户网站，用原生 HTML + CSS 手写，没有框架、没有构建步骤。

---

## 本次发布内容

- **首页** —— 组织简介、重要活动历史、可公开的行动规划
- **关于** —— 三个下属组织、公开活动与机密活动、成员代号
- **项目** —— 正在开发和运营的项目

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
├── index.html        首页
├── about.html        关于
├── projects.html     项目
├── css/
│   └── style.css     全站样式（三个页面共用）
├── .gitattributes    换行符统一为 LF
├── .vscode/          编辑器项目设置（UTF-8 + LF）
└── README.md         本文件
```

**纯静态**——没有后端、没有数据库、不需要编译。双击 `index.html` 即可本地预览，
或在本目录起一个静态服务器：

```bash
python -m http.server 8000
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

改这一处，三个页面同时生效。深色模式在 `@media (prefers-color-scheme: dark)` 里自动适配，
窄屏适配在文件末尾的 `@media (max-width: 560px)` 里。

---

## 部署

本站托管于 GitHub Pages，由 `main` 分支根目录直接发布。
推送后一两分钟内自动生效。
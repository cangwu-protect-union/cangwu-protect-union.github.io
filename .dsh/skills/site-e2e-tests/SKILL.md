---
name: site-e2e-tests
description: 跑、写、扩本站的端到端测试（_local/tests）：统一入口、用例写法、令牌注入、清理 SQL，以及一批实测踩过的坑（相对链接拼接、天地图白名单、偶发超时、地图瓦片）。改完页面要回归、要加用例时加载。
---

# 端到端测试

测试全部在 `_local/tests/`，按「访客/编辑的真实操作」验证：点按钮、填表单、读页面文字，
**不调用 `window.ZoneData` / `window.GuiData` 这类页面内部 API**。要预置状态就用 `page.route`
伪造网络结果，而不是直接改数据。

## 结构

```
_local/tests/
├── run-all.mjs          统一入口：起服务、跑用例、汇总、生成清理 SQL
├── lib/harness.mjs      浏览器封装、等待、断言、清理 SQL 生成
├── lib/token.html       人工取令牌的页面（用户不必开 F12）
├── lib/dev-editor.html  调试用：跳过验证直接挂载区域编辑器
├── cases/*.mjs          一组一个文件，导出 { group, cases }
└── cleanup/             每次运行生成的清理 SQL
```

一条用例就是一个对象：

```js
{ name: '用例名', needsToken: true, async run(t) { ... } }
```

`t` 上有：`page`、`base`、`token`、`cleanup`、`fixtures`、`info(msg)`。

## 跑

```powershell
node _local/tests/run-all.mjs                       # 只跑不需要令牌的组
node _local/tests/run-all.mjs --token=<令牌>         # 全量
node _local/tests/run-all.mjs --group=公开 --token=…
node _local/tests/run-all.mjs --list                # 只列用例
```

环境变量 `QUYU_TK` 等价于 `--token`。服务由脚本自己在 `127.0.0.1:9300` 起，跑完关掉；
浏览器进程要 `danger-full-access`（命名管道），否则 Edge 起不来。

现有分组：`导航`、`数据源`、`区域 · 公开`、`区域 · 关联回填`、`区域 · 编辑`、`鬼图鉴 · 关联与引用`、`站点建议 · 提交与审核`。
`区域 · 关联回填` 不需要令牌：用 `lib/dev-editor.html` 挂同一份编辑器，验证选择页回来后关联框立刻显示新勾的条目。
前两组、区域公开、建议的前两条都不需要令牌；动了数据层或导航，至少跑 `--group=数据源` 与 `--group=导航`。
`--group=` 是子串匹配，`--group=建议` 就够。

## 硬约束：必须 127.0.0.1

天地图 key 只放行 `127.0.0.1` 与部署域名，用 `localhost` 打开地图页会 403，
浏览器侧表现为 `net::ERR_BLOCKED_BY_ORB`，地图类用例必然失败。`BASE` 常量只写 `127.0.0.1`。

## 令牌

- 人工：浏览器开 `http://127.0.0.1:9300/_local/tests/lib/token.html` 答两题，复制页面给出的令牌。
- 脚本：`openRun(token)` 用 `ctx.addInitScript` 往 sessionStorage 写 `gui_token` / `gui_token_exp`，
  等价于「这个标签页已经通过验证」，不必走验证表单。
- 没传令牌时，`needsToken` 用例标记「跳过」，不算失败；但别拿跳过当通过。

## 写用例的五条规矩

1. **等，不要睡**：用 `waitLoaded` / `waitUrl` / `waitForFunction`；云端偶发慢的地方用
   `waitSelectorOrReload`（超时后重载一次再等），别把它判成失败。
2. **断言带实际值**：`expect(x, '应为 A，实际 ' + y)`，否则重跑时看不出差在哪。
3. **每条用例自己说清失败原因**：共享数据走 `t.fixtures`，但断言要能定位到具体一步。
4. **造数据的都要登记**：`t.cleanup.zones.push(id)`、`t.cleanup.zoneTips.push(id)` 等，
   `run-all` 结束时生成 `cleanup/cleanup-<时间>.sql`。站点建议的 id 由页面自己生成、测试拿不到，
   所以登记的是标题：`t.cleanup.suggestTitles.push(title)`，清理脚本按标题删。
5. **一组一个文件**：在 `cases/` 新建文件导出 `{ group, cases }`，再去 `run-all.mjs` 的 `groups`
   数组里 import 进来，否则 `--list` 看不到。

## 实测踩过的坑

| 现象 | 原因与做法 |
|---|---|
| 跳转报 `Cannot navigate to invalid URL` | `BASE + href` 拼了相对链接，出现 `9300tips-entry.html`；用 `new URL(href, BASE + '/quyu/tips.html').href` |
| 截图里地图是灰块 | 瓦片晚到；先等 `.leaflet-tile-loaded` 出现再截图 |
| 选择页/标点页回来内容全丢了 | 这是产品行为：跳转前要存草稿。测试按真实跳转走，不要绕过选择页直接改 DOM |
| 只跑「公开」组却留下一堆测试数据 | 公开组第 7 条会真实提交一条投稿；跑完照样要执行清理 SQL |
| Edge 起不来 / 端口占用 | 调试端口用 10011（10000 曾被占）；仍不行先 `Get-Process msedge` 清残留 |
| 首屏 12 秒 | 冷启动 TLS 握手，不是性能回归；整轮开头先访问一次页面把连接暖热 |
| 云端返回 0 条却有卡片 | 兜底被合并进正常路径；`cases/data-source.mjs` 用 `page.route` 拦 `**/v1/rdb/rest/**` 断言这条不变量 |
| 匿名提交「成功」了但查不到 | 站点建议匿名读返回 `[]` 是设计；写没写进去只能靠 `needsToken` 用例到审核列表里核对 |
| 页面挪进模块目录后导航用例超时 | `cases/nav.mjs` 里按 `a[href="suggest.html"]` 写死了选择器，挪到 `suggest/` 后要同步改 href 与 `waitUrl` 正则 |
| 控制台一直有 `favicon.ico 404` | 全站没有 favicon，这是既有噪音，不算回归；判断回归只看你自己的资源与 JS 异常 |

## 收尾

1. 执行 `_local/tests/cleanup/` 里新生成的那份 SQL（测试数据不做软删除，只能 SQL 删）。
2. `powershell -NoProfile -ExecutionPolicy Bypass -File tools\check.ps1` 退出码 0。
3. 失败用例如果怀疑是偶发，单独重跑该组一次再下结论；连续两次同样失败按产品 bug 处理。

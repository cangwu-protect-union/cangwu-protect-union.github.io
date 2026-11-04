---
name: guitu-browser-test
description: 给 CPU 官网/鬼图鉴做本地端到端验证：起静态服务器、用 _local/pw 的 Playwright（连系统 Edge）写断言、截图、抓 JS 与网络错误。改完页面要实测时加载。
---

# 浏览器端到端验证

## 路径

需要时调 `load_workspace_dependencies` 取 `python` / `node` 绝对路径。实测值：

```
python  C:\Users\L\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe
node    C:\Users\L\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe
```

## 起服务

```powershell
$proc = Start-Process -FilePath "<python>" -ArgumentList "-m","http.server","9300","--bind","127.0.0.1" `
  -WorkingDirectory "D:\CPU\关于CPU的网页" -WindowStyle Hidden -PassThru
# 用完 Stop-Process -Id $proc.Id -Force
```

必须用 `http://localhost:PORT/...`，**不要 `file://`**：Origin 为 `null`，云端 CORS 直接拦掉。

## 沙箱

Edge / Playwright 靠命名管道启动，在 workspace-write 沙箱里会 `拒绝访问 (0x5)` 或 `spawn EPERM` 退出。**跑浏览器的命令必须带 `sandbox_permissions: danger-full-access`**，理由写「浏览器进程必须能创建命名管道才能启动」。

## 首选：Playwright

`_local/pw` 里装了 playwright 1.64.1（pnpm hoisted），连系统 Edge，不下载 Chromium。

```powershell
& "<node>" check.mjs "http://localhost:9300/index.html" "..\preview\index.png"
```

打印浏览器版本、地址、标题、JS 异常、控制台报错、HTTP 4xx-5xx、截图路径。写自己的用例：

```js
import { openBrowser, watchPage } from './browser.mjs';

const { browser, close } = await openBrowser();
const page = await (browser.contexts()[0] || await browser.newContext()).newPage();
const w = watchPage(page);
await page.goto('http://localhost:9300/guitu/guitu.html');
await page.waitForSelector('#guiCount');
console.log(await page.textContent('#guiCount'), w.errors);
await page.screenshot({ path: 'D:\\CPU\\关于CPU的网页\\_local\\preview\\x.png', fullPage: true });
await close();
```

`openBrowser()` 自己 spawn Edge 开调试端口再 `connectOverCDP`，拿到的是真浏览器；CDP 连接下部分 `newContext` 选项无效。细节见 `_local/pw/README.md`。

## 退路：CDP 直连

不装依赖时用 `_local/pw/cdp.mjs`（已实测）：

```powershell
& "<node>" _local\pw\cdp.mjs "http://localhost:9300/index.html" 10600 "..\preview\x.png"
```

打印标题、JS 异常、控制台错误、网络失败，可选截图。要自己写 CDP 脚本时记住：**先以 `about:blank` 启动，连上 target 再 `Page.navigate`**，直接以目标页启动会连到错误的执行上下文，读到空 DOM。

## 常用片段

```js
// 通过组织验证（编辑区页面都要）
await ev(`(async function(){ try { await window.GuiGate.verifyValues(['<问题一答案>','<问题二答案>']); } catch(e){} })()`);

// 页面内多步写入比 DOM 点击稳
await ev(`(async function(){ try { await window.GuiData.insertEntry({ id:"t-"+Date.now(), title:"测试", image:"", images:[], thumbs:[], intro:"x", body:"x", tags:[], date:"2026-01-01", refs:[] }); return "ok"; } catch(e){ return "fail: " + e.message; } })()`);
```

## 断言时机

不要固定 `sleep` 一段再去读 DOM 下结论：分不清「还在载入」和「已经失败」，而且首次连云端可能要十几秒。

```js
await page.waitForFunction(() => {
  const t = document.querySelector('#guiCount');
  return t && !/载入/.test(t.textContent);
}, { timeout: 25000 });
```

同一页面里连续跳转时，切页后要先等目标页的选择器出现再断言。上一个页面的请求还在飞的时候截图或读 DOM，拿到的是空壳，容易被当成渲染回归。

新浏览器 profile 第一次请求 TLS 握手实测 12.3 秒，热连接约 120ms。要测首屏真实体验就保持全新 profile；要测功能就先预热一次，别把冷启动的 12 秒当性能问题报出去。

## 判读

- 页面里既有隐藏的 `.gate-error` 空元素，也有警告：判断「是否显示警告」看 `textContent` 非空，不能只看元素存在。
- 结果对不上时先做最小差异对照：只改一个变量（换身份、换 profile、换 curl 与应用代码），确认是产品问题还是测量方式问题。
- 测试后清理自建数据；条目只能软删除，彻底清除要 SQL。`gui_tips` 可以先置 `rejected` 让它从公开面消失，再让用户跑一句 delete。

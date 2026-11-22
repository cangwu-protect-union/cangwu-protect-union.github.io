---
name: guitu-browser-test
description: 给 CPU 官网/鬼图鉴做本地端到端验证：起静态服务器、用 _local/pw 的 Playwright（连系统 Edge）写断言、截图、抓 JS 与网络错误。改完页面要实测时加载。
---

# 浏览器端到端验证

## 路径

需要时调 `load_workspace_dependencies` 取绝对路径。本机实测：

```
python  C:\Users\L\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe
node    用 tools/node.ps1：. .\tools\node.ps1; $node = Get-NodeExe（PATH 里没有 node）
```

## 起服务

`Start-Process` 起的 python 会随那条命令结束被杀掉。要用后台 job 占住端口（`run_in_background`）：

```
python -m http.server 9300 --bind 127.0.0.1
```

`_local/tests/run-all.mjs` 会自己起服务，跑正式用例时不用手工开。
**收工要按 PID 关**：`job_kill` 只杀 pwsh 外壳，python 子进程仍在监听。按端口找 PID 杀掉，再请求一次确认已拒连，别只看 job 状态。细节见 [判读与细节.md](判读与细节.md)。
必须用 `http://127.0.0.1:PORT/...`，**不要 `file://`**：Origin 为 `null`，云端 CORS 直接拦掉。

## 沙箱

Edge / Playwright 靠命名管道启动，在受限沙箱里会 `拒绝访问 (0x5)` 或 `spawn EPERM`。**跑浏览器的命令必须带 `sandbox_permissions: danger-full-access`**（当前会话已默认放开，跨会话要留意）。

## 首选：Playwright

`_local/pw` 里装了 playwright（pnpm hoisted），连系统 Edge，不下载 Chromium。

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

### 模拟手机（横竖屏、触摸）

`page.setViewportSize` 只改视口，**不改 `pointer` 与 `maxTouchPoints`**；靠这两个判断的响应式分支、横屏遮罩会全部测不到。要走 CDP：

```js
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: 844, height: 390, deviceScaleFactor: 3, mobile: true
});
await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await page.setViewportSize({ width: 844, height: 390 });
```

`mobile: true` 之后 `(pointer: coarse)` 才为真、`navigator.maxTouchPoints` 才是 5；`maxTouchPoints` 至少给 1。切回桌面要显式 `setTouchEmulationEnabled({enabled:false})`，否则同一页后续断言仍按手机走。

## 退路：CDP 直连

不装依赖时用 `_local/pw/cdp.mjs`（已实测）。要自己写 CDP 脚本时记住：**先以 `about:blank` 启动，连上 target 再 `Page.navigate`**，直接以目标页启动会连到错误的执行上下文。命令见 [判读与细节.md](判读与细节.md)。

## 常用片段

```js
// 通过组织验证（编辑区页面都要）
await ev(`(async function(){ try { await window.GuiGate.verifyValues(['<问题一答案>','<问题二答案>']); } catch(e){} })()`);

// 页面内多步写入比 DOM 点击稳
await ev(`(async function(){ try { await window.GuiData.insertEntry({ id:"t-"+Date.now(), title:"测试", image:"", images:[], thumbs:[], intro:"x", body:"x", tags:[], date:"2026-01-01", refs:[] }); return "ok"; } catch(e){ return "fail: " + e.message; } })()`);
```

## 断言时机与判读

不要固定 `sleep` 再读 DOM：分不清「还在载入」和「已经失败」。用 `waitForFunction` 等目标状态（示例见 [判读与细节.md](判读与细节.md)）。
常见误判与清理注意事项（`.gate-error` 判空看 textContent、favicon 404 是既有噪音、测试会真的写云端数据）也在 [判读与细节.md](判读与细节.md)。

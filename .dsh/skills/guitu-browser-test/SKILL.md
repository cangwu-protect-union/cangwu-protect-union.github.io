---
name: guitu-browser-test
description: 给 CPU 官网/鬼图鉴做本地端到端验证时用：起静态服务器、用 _local/pw 里的 Playwright（连系统 Edge）写断言、截图、网络与 JS 错误捕获。改完页面需要实测时加载。
---

# 浏览器端到端验证

## 运行时路径

先调 `load_workspace_dependencies`，用返回的 `python` 和 `node` 绝对路径。实测值：

```
python  C:\Users\L\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe
node    C:\Users\L\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe
```

工具不可用时直接用上面两个值。DSH 升级后路径可能变，那时重新调一次工具核对。

## 起服务

```powershell
$py = "<load_workspace_dependencies 返回的 python>"
$proc = Start-Process -FilePath $py -ArgumentList "-m","http.server","9300","--bind","127.0.0.1" `
  -WorkingDirectory "D:\CPU\关于CPU的网页" -WindowStyle Hidden -PassThru
# 用完 Stop-Process -Id $proc.Id -Force
```

地址用 `http://localhost:PORT/...`。**不要用 `file://`**：来源为 `null`，云端 CORS 直接拦掉，验证类页面必然失败。

## Playwright（首选，已装在 `_local/pw`）

`_local/pw` 里有 playwright 1.64.1（pnpm，hoisted 布局），用系统 Edge，不下载 Chromium。

**浏览器必须在全权限（full access）下启动**：Edge/Playwright 的启动/通信走命名管道，
workspace-write 沙箱里 Edge 直接
`FATAL: mojo\public\cpp\platform\platform_channel.cc: Check failed: 拒绝访问 (0x5)` 退出，
Playwright 自带 `chromium.launch()` 则是 `spawn EPERM`。所以**要跑浏览器的那条命令必须带
`sandbox_permissions: danger-full-access`**，并把理由写成「浏览器进程必须能创建命名管道才能启动」。

现成工具（`$node` = load_workspace_dependencies 返回的 node）：

```powershell
& $node check.mjs "http://localhost:9300/index.html" "..\preview\index.png"
# 打印：浏览器版本 / 地址 / 标题 / JS 异常 / 控制台报错 / HTTP 4xx-5xx / 截图路径
```

写自己的用例：

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

`openBrowser()` 自己 spawn Edge 开 `--remote-debugging-port`，再 `connectOverCDP`。
拿到的是真浏览器，locator/断言/`page.evaluate`/截图全可用；CDP 连接下部分 `newContext` 选项无效。
细节见 `_local/pw/README.md`。

## CDP 脚本模板（不想装 Playwright 时的退路）

用 `load_workspace_dependencies` 返回的 `node` 执行。每次换 `PORT`（≥10000）。

关键点：**先启动到 `about:blank`，连上 target 后再 `Page.navigate`**。直接以目标页启动会连到错误的执行上下文，读到的 DOM 是空的。

```javascript
const { spawn } = require("child_process");
const http = require("http");
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 10600;
const B = "http://localhost:9300";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const gj = u => new Promise((res, rej) => {
  http.get(u, r => { let d = ""; r.on("data", c => d += c); r.on("end", () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on("error", rej);
});

(async () => {
  const p = spawn(EDGE, ["--headless=new","--disable-gpu","--remote-debugging-port="+PORT,
    "--user-data-dir="+process.env.TEMP+"\\dsh-"+Date.now(),"--window-size=1100,1200","about:blank"],
    { stdio: "ignore", detached: true });
  p.unref();
  let t = null;
  for (let i = 0; i < 60; i++) {
    try { const l = await gj("http://127.0.0.1:"+PORT+"/json/list");
      const f = l.filter(x => x.type === "page"); if (f.length) { t = f[0]; break } } catch (e) {}
    await sleep(500);
  }
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let id = 0; const pend = new Map(); const errs = []; const netFail = [];
  ws.addEventListener("message", e => { const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
    if (m.method === "Runtime.exceptionThrown")
      errs.push((((m.params.exceptionDetails.exception||{}).description)||"").split("\n")[0]);
    if (m.method === "Network.loadingFailed")
      netFail.push(m.params.errorText + (m.params.corsErrorStatus ? " / CORS: " + m.params.corsErrorStatus.corsError : ""));
  });
  await new Promise(r => ws.addEventListener("open", r));
  const send = (m, pa) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: pa || {} })) });
  await send("Runtime.enable"); await send("Page.enable"); await send("Network.enable");
  const ev = async x => { const r = await send("Runtime.evaluate", { expression: x, awaitPromise: true, returnByValue: true });
    if (r.result && r.result.exceptionDetails) return "异常:" + ((r.result.exceptionDetails.exception||{}).description||"");
    return r.result && r.result.result ? r.result.result.value : "(undefined)" };

  await send("Page.navigate", { url: B + "/guitu/guitu.html" });
  await sleep(4500);
  console.log(await ev("document.getElementById('guiCount').textContent"));
  console.log("JS 异常:", errs.length ? errs.slice(0,3).join(" | ") : "无");
  console.log("网络失败:", netFail.length ? netFail.slice(0,3).join(" | ") : "无");
  ws.close(); process.exit(0);
})();
```

## 常用片段

```javascript
// 截图
const shot = await send("Page.captureScreenshot", { format: "png" });
require("fs").writeFileSync("D:\\CPU\\关于CPU的网页\\_local\\preview\\x.png", Buffer.from(shot.result.data, "base64"));

// 通过组织验证（编辑区页面都要）
await ev(`(async function(){ try {
  await window.GuiGate.verifyValues(['<问题一答案>','<问题二答案>']);
} catch(e){} })()`);

// 页面内执行多步写入（比 DOM 点击稳）
await ev(`(async function(){
  try { await window.GuiData.insertEntry({ id:"t-"+Date.now(), title:"测试", image:"", images:[], thumbs:[],
        intro:"x", body:"x", tags:[], date:"2026-01-01", refs:[] }); return "ok"; }
  catch(e){ return "fail: " + e.message; } })()`);
```

## 判读

- 页面里既有隐藏的 `.gate-error` 空元素，也有警告：判断「是否显示警告」要看 `textContent` 非空，不能只判断元素存在。
- 测试后清理自己建的测试数据；条目只能软删除，彻底清要 SQL。
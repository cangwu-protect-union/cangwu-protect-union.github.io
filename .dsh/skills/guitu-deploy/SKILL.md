---
name: guitu-deploy
description: 把 CPU 官网/鬼图鉴的改动提交并发布到 GitHub Pages：一条 publish 命令、推送卡住的排查、等部署、上线核对，以及本机连 github.com 的证书与 hosts 处理。准备上线时加载。
---

# 提交与发布

仓库 `cangwu-protect-union/cangwu-protect-union.github.io`，`main` 根目录直接发布；本地 `D:\CPU\关于CPU的网页`。

## 一条命令

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\publish.ps1 -Message msg.txt [-Url <页面> -Expect <特征串>]
```

- `-Message`：UTF-8 无 BOM 的提交信息文件，避免引号和换行被 shell 吃掉。
- 内部依次：`check.ps1 -Staged` → `git add -A` + commit → push（卡住自动换 HTTP/1.1 重试）→ `check.ps1 -Last` → 给了 `-Url/-Expect` 就轮询到上线。
- 工作区干净时只推送、不新建提交。

提交前仍要逐行看 `git status --short`：同一仓库可能有两个会话在改，别把别人的半成品混进这次提交或提交信息里。`_local/`、`*.sql`、`*.docx` 不进提交。

## 推送卡在「Pushing to …」不动

症状：`git push --verbose` 打完 `Pushing to <url>` 就没了下文，`ls-remote` 却秒回。原因是分片上传被代理挂住。改成分块之外的 Content-Length 就通：

```powershell
git -c http.postBuffer=104857600 -c http.version=HTTP/1.1 push origin main
```

凭据：Windows 凭据库里存的是 `git:https://github.com`（用户名 `cangwu-protect-union`）。`git credential fill` 能直接取到，不需要重新登录；取不到时会一直等 GCM 弹窗（这个环境弹不出来），表现为推送无响应。

## 等部署

Pages 有 30–90 秒延迟，实测约 40 秒。轮询**本次改动特有的字符串**，不要只看状态码；新文件落在子目录时地址要带子目录，刚推上去的头几轮 404 是部署没完成，不是路径写错。

```powershell
node --use-system-ca tools/poll-live.mjs https://cangwu-protect-union.github.io/<路径> "<特征串>"
```

## 上线后核对

1. 改动的页面 200、含新文案；依赖的脚本样式 200。
2. 旧路径按预期 404（迁移时）。
3. 跑一次真浏览器验证（`guitu-browser-test` / `site-e2e-tests`），无 JS 异常、无资源 404。
4. `/_local/...` 返回 404。
5. 改了页面结构时重跑 `build-docs.js` 并提交；`check.ps1` 会拦文档过期。

## 从会话里访问 github.com（实测）

`git push` 报 `Recv failure: Connection was reset`、`*.github.io` 正常时，根因不是网络，是 hosts 加自签 CA：

- hosts 把 `github.com` / `api.github.com` / `raw.githubusercontent.com` 指到 127.0.0.1，由 Steam++ 或 UU 加速器的本地代理转发 TLS，用的是自签 CA（`SteamTools Certificate`、`UU Game Booster CA`，在 Windows 根存储里，浏览器认）。
- 沙箱里 schannel 拿不到凭据：`curl`/`git` 报 `AcquireCredentialsHandle failed: SEC_E_NO_CREDENTIALS`；node 报 `UNABLE_TO_VERIFY_LEAF_SIGNATURE`。

node 下载：加 `--use-system-ca` 读 Windows 根存储。

```powershell
& $node --use-system-ca -e "fetch('https://api.github.com/rate_limit').then(r=>console.log(r.status))"
```

git 走 HTTPS：`.git/config` 在工作区不可写时用环境变量注入，只对当前进程生效。

```powershell
$env:GIT_CONFIG_COUNT='2'
$env:GIT_CONFIG_KEY_0='http.sslBackend';  $env:GIT_CONFIG_VALUE_0='openssl'
$env:GIT_CONFIG_KEY_1='http.sslCAInfo';   $env:GIT_CONFIG_VALUE_1='D:/CPU/关于CPU的网页/_local/certs/ca-bundle.pem'
git ls-remote --heads origin
```

`ca-bundle.pem` = Git 自带 `mingw64/etc/ssl/certs/ca-bundle.crt` 拼上两个自签 CA；只拼自签 CA 会让其他仓库校验失败。换机后重新导出：

```powershell
Get-ChildItem Cert:\CurrentUser\Root, Cert:\LocalMachine\Root |
  Where-Object { $_.Subject -match 'SteamTools|UU Game Booster' } |
  ForEach-Object { "-----BEGIN CERTIFICATE-----`n" + [Convert]::ToBase64String($_.RawData, 'InsertLineBreaks') + "`n-----END CERTIFICATE-----" }
```

**这条链路等于信任加速器厂商的 CA**，它能解密并改写去 GitHub 的流量。所以从 GitHub 下的可执行文件，校验和只防传输损坏，防不了代理本身；装 gitleaks 这类安全工具时要意识到这点。

下 Release 用 `tools/get-tool.js`，自动核对 API 返回的 sha256：

```powershell
& $node --use-system-ca tools/get-tool.js gitleaks/gitleaks windows_x64 _local/bin
```

先查解析，确认是 hosts 而不是 DNS：

```powershell
Resolve-DnsName github.com -Type A        # 返回 127.0.0.1 就是 hosts 被改
Get-Content C:\Windows\System32\drivers\etc\hosts | Select-String github
```

改 hosts 前先说明原因让用户决定，不要自行修改。`cangwu-protect-union.github.io` 一直能访问，因为 hosts 里写的是裸域 `github.io`，不匹配子域。

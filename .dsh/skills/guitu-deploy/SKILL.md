---
name: guitu-deploy
description: 把 CPU 官网/鬼图鉴的改动提交并发布到 GitHub Pages：中文提交信息、推送重试、轮询部署、上线核对，以及本机连 github.com 的证书处理。准备上线时加载。
---

# 提交与发布

仓库 `cangwu-protect-union/cangwu-protect-union.github.io`，`main` 根目录直接发布；本地 `D:\CPU\关于CPU的网页`。

## 提交

提交信息用文件传入，避免引号和换行被 shell 吃掉：

```powershell
$env:Path = "C:\Program Files\Git\cmd;$env:Path"
Set-Location "D:\CPU\关于CPU的网页"
git add -A
git status --short          # 确认没有 _local/、*.docx、*.sql 被带进来
# 信息写进 $env:TEMP\msg.txt（UTF-8 无 BOM），再提交
git commit -q -F $f
```

`git add -A` 会把工作区里所有改动一次带走。提交前逐行看 `git status --short`：
出现不属于本次任务的改动（用户没提交的界面调整、误建的空文件），先单独提交或至少分开说明，
别让它混进本次提交却不在提交信息里。

## 推送

```powershell
$env:GIT_TERMINAL_PROMPT = "0"
for ($i=1; $i -le 20; $i++) {
  git push origin main 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) { "推送成功（第 $i 次）"; break }
  Start-Sleep -Seconds 8
}
```

几分钟还不行就转后台 job 继续重试，不要堵在那里。

## 等部署

Pages 有 30–90 秒延迟。轮询**本次改动特有的字符串**判断生效，不要只看状态码。
新文件落在子目录（如 `suggest/suggest.html`）时，轮询地址要带子目录；新目录刚推上去的头几轮
大概率还是 404，那是部署没完成，不是路径写错。实测这个站约 40 秒生效。

```powershell
for ($i=1; $i -le 12; $i++) {
  Start-Sleep -Seconds 10
  $r = Invoke-WebRequest -Uri "$base/js/xxx.js" -UseBasicParsing -Headers @{ 'Cache-Control'='no-cache' }
  if ($r.Content -match '本次新增的特征串') { "已是最新"; break }
}
```

## 上线后核对

1. 改动的页面 200、含新文案；依赖的脚本样式 200。
2. 旧路径按预期 404（迁移时）。
3. `guitu-browser-test` / `site-e2e-tests` 跑一次真浏览器验证，无 JS 异常、无资源 404。
4. 涉及 `_local/` 的，确认 `/_local/...` 返回 404。
5. 提交前跑过 `check.ps1`；如果改了页面结构、脚本或数据，`check.ps1` 里的
   `build-docs.js --check` 会比对六份文档是否过期，过期就重跑一次生成器再提交。

## 从会话里访问 github.com（实测）

`git push` 报 `Recv failure: Connection was reset`、`*.github.io` 正常时，根因不是网络，是 hosts 加自签 CA：

- hosts 把 `github.com` / `api.github.com` / `raw.githubusercontent.com` 指到 127.0.0.1，由 Steam++ 或 UU 加速器的本地代理转发 TLS，用的是自签 CA（`SteamTools Certificate`、`UU Game Booster CA`，在 Windows 根存储里，浏览器认）。
- 沙箱里 schannel 拿不到凭据：`curl`/`git` 报 `AcquireCredentialsHandle failed: SEC_E_NO_CREDENTIALS`；node 报 `UNABLE_TO_VERIFY_LEAF_SIGNATURE`。

node 下载：加 `--use-system-ca` 读 Windows 根存储。

```powershell
& $node --use-system-ca -e "fetch('https://api.github.com/rate_limit').then(r=>console.log(r.status))"
```

git 走 HTTPS：`.git/config` 在工作区不可写，用环境变量注入，只对当前进程生效。

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

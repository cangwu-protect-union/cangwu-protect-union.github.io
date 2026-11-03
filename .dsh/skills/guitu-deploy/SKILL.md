---
name: guitu-deploy
description: 把 CPU 官网/鬼图鉴的改动提交并发布到 GitHub Pages 时用：中文提交信息、推送重试、轮询部署完成、上线后核对清单、以及 github.com 连不上时的诊断。改完准备上线时加载。
---

# 提交与发布

仓库 `cangwu-protect-union/cangwu-protect-union.github.io`，`main` 分支根目录直接发布。本地 `D:\CPU\关于CPU的网页`。

## 提交

中文提交信息用文件传入，避免引号和换行被 shell 吃掉：

```powershell
$env:Path = "C:\Program Files\Git\cmd;$env:Path"
Set-Location "D:\CPU\关于CPU的网页"
git add -A
git status --short          # 先看清单，确认没有 _local/ 的东西被带进来
# 提交信息写进 $env:TEMP\msg.txt（UTF-8 无 BOM），再 git commit -F
git commit -q -F $f
```

提交前必查：`git status` 里不应出现 `_local/`、`*.docx`、`*.sql`。

## 推送

GitHub 经常抖动，用重试循环：

```powershell
$env:GIT_TERMINAL_PROMPT = "0"
for ($i=1; $i -le 20; $i++) {
  git push origin main 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) { "推送成功（第 $i 次）"; break }
  Start-Sleep -Seconds 8
}
```

超过几分钟不行就转后台 job 继续重试，不要堵在那里。

## 等部署

Pages 有 30–90 秒延迟。轮询一个**本次改动特有的字符串**判断是否生效，不要只看状态码：

```powershell
for ($i=1; $i -le 12; $i++) {
  Start-Sleep -Seconds 10
  $r = Invoke-WebRequest -Uri "$base/js/xxx.js" -UseBasicParsing -Headers @{ 'Cache-Control'='no-cache' }
  if ($r.Content -match '本次新增的特征串') { "已是最新"; break }
}
```

## 上线后核对

1. 改动的页面 200 且内容包含新文案
2. 页面依赖的脚本/样式 200
3. 旧路径按预期 404（迁移时）
4. 用 guitu-browser-test 跑一次真实浏览器验证，确认无 JS 异常、无资源 404
5. 涉及 `_local/` 的，确认 `/ _local/...` 返回 404（密码哈希未泄露）

## github.com 连不上

现象：`git push` 报 `Recv failure: Connection was reset`，但 `*.github.io` 正常。

先看解析：

```powershell
Resolve-DnsName github.com -Type A        # 若返回 127.0.0.1，就是 hosts 被改
Get-Content C:\Windows\System32\drivers\etc\hosts | Select-String github
```

若末尾有 `# Steam++ End`，说明是 Steam++ 写入的加速记录：它把 github.com 指向 127.0.0.1，再由本地代理转发。**Steam++ 没运行时这些域名就全部失效**。

处理：让用户打开 Steam++ 的加速，或临时注释掉这些行。不要自行改 hosts，先说明原因让用户决定。

`cangwu-protect-union.github.io` 一直能访问，因为 hosts 里写的是裸域 `github.io`，不匹配子域。
# PowerShell 批量替换与令牌细节（site-project 伴生文件）

从 [SKILL.md](SKILL.md) 移出，原文未改。

## 批量替换写法

```powershell
$enc = New-Object System.Text.UTF8Encoding($false)
$t = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8).Replace($old, $new)
[System.IO.File]::WriteAllText($p, $t, $enc)
```

| 陷阱 | 做法 |
|---|---|
| here-string 结束符不在行首 → 整段被吞、替换静默失败 | `'@` 独占一行 |
| `.Replace()` 报「参数计数为 3」 | 只传两个纯字符串 |
| `Set-Content -NoNewline` 吞换行 | 用 `WriteAllText` |
| `WriteAllLines` 写出 CRLF，`check.js` 报「有 CRLF 换行，项目要求 LF」 | 用 `WriteAllText($p, ($lines -join "`n"), $enc)`，或写完统一转换 |
| 多行文本靠猜空白改 | 先 `IndexOf` 定位，再花括号配对 |
| `Set-Content -Encoding utf8NoBOM` 报「无法匹配枚举器名称」 | 本机 `powershell` 是 5.1，没有 `utf8NoBOM`；用上面的 `UTF8Encoding($false)` + `WriteAllText` |
| `Invoke-WebRequest -SkipCertificateCheck` 报「找不到参数」 | 同样只在 PowerShell 7 有；测接口改用浏览器（Playwright）里 `page.evaluate(fetch)`，顺带验证 CORS |

## 令牌

要一个令牌（例如给测试或测接口）：浏览器开
`http://127.0.0.1:9300/_local/tests/lib/token.html`，答两题后页面显示令牌，可复制。
`_local/tests/lib/token.html` 是唯一入口，不要再造第二个取令牌页面。

## 天地图 key

天地图 key 是浏览器端类型且绑部署域名白名单：`curl` 与 `localhost` 打开都会 403（浏览器表现为 `net::ERR_BLOCKED_BY_ORB`）。本地验证用 `127.0.0.1` 并加部署域名的 Referer，不要换成服务端类型 key。

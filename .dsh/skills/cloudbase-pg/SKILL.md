---
name: cloudbase-pg
description: 操作鬼图鉴的 CloudBase PostgreSQL 后端：PostgREST 读写与 RPC、RLS、令牌传递、CORS 白名单实测结论、迁移流程、表结构。改数据库、改权限、排查写入失败时加载。
---

# CloudBase PG 后端

## 连接

环境 `cangwu-protect-union-d7a350be12a`，网关 `https://{envId}.api.tcloudbasegateway.com`。

```
REST 基址   /v1/rdb/rest
数据接口    /v1/rdb/rest/{table}
RPC         /v1/rdb/rest/rpc/{function}
存储        /v1/storages/object/gui-images/{name}   （公开读不需要令牌）
```

密钥读 `guitu/data/config.js` 的 `publishableKey`（可公开）。`API Key`（service_role）绝不入库、绝不进前端。请求带 `Authorization: Bearer <publishableKey>` 和 `Origin: https://cangwu-protect-union.github.io`。

## 表

| 表 | 说明 |
|---|---|
| `gui_entries` | 条目。`deleted` 软删除，`refs` 引用情报，`thumbs` 与 `images` 一一对应 |
| `gui_entry_versions` | 版本归档，只增不改不删，`applied` 标记已应用 |
| `gui_tips` | 情报投稿，与图鉴隔离，写入不要求令牌 |
| `gui_secrets` | 答案哈希，**无 RLS 策略，anon 读不到** |
| `gui_tokens` | 验证签发的令牌，同样读不到 |

函数：`gui_verify(p_hash1, p_hash2)` 校验并签发令牌；`gui_token_ok()` 供 RLS 判断令牌有效性。

## CORS

网关的 `Access-Control-Allow-Headers` 是写死的白名单（约 40 个），不在列表里的头浏览器预检直接拦掉。实测：

| 头 | 浏览器能发 | 能到达数据库 |
|---|---|---|
| `x-gui-token`（自定义） | 否 | 是 |
| `X-Client-Info` / `X-Csrfcode` / `X-Metadata` | 是 | 否（被网关吞掉） |
| `Prefer` | 是 | **是** |

所以令牌走 `Prefer`：

```
Prefer: return=minimal, gui-token=<64 位令牌>
```

PostgREST 忽略不认识的指令，`gui_token_ok()` 用正则从 `prefer` 里取令牌。要加新头先跑一次 OPTIONS 预检确认在白名单里。

## 来源白名单

| Origin | 结果 |
|---|---|
| `https://cangwu-protect-union.github.io` | 允许 |
| `http://localhost:*`、`http://127.0.0.1:*` | 允许（任意端口） |
| 局域网 IP（`http://192.168.x.x`） | 拒绝，无 Allow-Origin |
| `file://`（Origin 为 `null`） | 拒绝 |

CORS 白名单是付费功能（个人版 ¥19.9/月），到期降级后前端写入全部失效。

## 写入权限

`gui_entries`、`gui_entry_versions` 的 INSERT/UPDATE 要 `gui_token_ok()`；`gui_tips` 开放写入。版本表没有 DELETE 策略，删除必须用 SQL。令牌失效时前端收到 `42501 row-level security`，代码会清本地令牌并提示重新验证。

## 自检矩阵

改权限后跑这五个，缺一不可：

```
1 无令牌 INSERT gui_entries    → 42501
2 伪造令牌 INSERT              → 42501
3 有效令牌 INSERT              → 201
4 无令牌 PATCH 已有行          → 0 行（PATCH 不报错，用 Prefer: return=representation 看返回是否 []）
5 无令牌 INSERT gui_tips       → 201
```

再确认 `select * from gui_secrets` 和 `gui_tokens` 对 anon 返回 `[]`。

## 迁移

1. SQL 写到 `_local\sql\`，`_local/` 已排除，不要提交；脚本不加注释。
2. 结尾加 `notify pgrst, 'reload schema';`。
3. 交给用户在控制台执行，之后用 curl 逐项验证。
4. 前端写入走 `sendWithColumnFallback()`，缺字段自动去掉重试，所以「先发代码后跑 SQL」不会崩。

改函数用 `create or replace`；改策略先 `drop policy if exists` 再建。

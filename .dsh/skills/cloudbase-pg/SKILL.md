---
name: cloudbase-pg
description: 操作鬼图鉴的 CloudBase PostgreSQL 后端：PostgREST 读写与 RPC、RLS、令牌传递、CORS 白名单实测结论、迁移流程、表结构。改数据库、改权限、排查写入失败时加载。
---

# CloudBase PG 后端

## 连接

环境 `cangwu-protect-union-d7a350be12a`，网关 `https://{envId}.api.tcloudbasegateway.com`。

```
REST 基址   /v1/rdb/rest/{table}
RPC         /v1/rdb/rest/rpc/{function}
存储        /v1/storages/object/gui-images/{name}   （公开读不需要令牌）
```

密钥读 `guitu/data/config.js` 的 `publishableKey`（可公开）。`API Key`（service_role）绝不入库、绝不进前端。请求带 `Authorization: Bearer <publishableKey>` 和 `Origin: https://cangwu-protect-union.github.io`。

## 表

| 表 | 说明 |
|---|---|
| `gui_entries` | 条目。`deleted` 软删除，`refs` 引用情报，`thumbs` 与 `images` 一一对应，`related` 关联条目 |
| `gui_entry_versions` | 版本归档，只增不改不删，`applied` 标记已应用 |
| `gui_tips` | 情报投稿，与图鉴隔离。`status` ∈ pending / approved / rejected / adopted |
| `gui_secrets` | 答案哈希，**无 RLS 策略，anon 读不到** |
| `gui_tokens` | 验证签发的令牌，同样读不到 |
| `gui_zones` | 区域。主键 `id` 是 **uuid**（界面不显示），`related` 存 `ghost:<id>` / `zone:<uuid>` |
| `gui_zone_versions` | 区域版本归档，列与 `gui_entries_versions` 对齐，`zone_id` 存 uuid 字符串 |
| `gui_zone_tips` | 区域投稿，`adopted` / `adopted_zone_id` 标记是否已转正 |
| `site_suggestions` | 站点建议：`kind` ∈ bug / feature / content / other，**没有状态列**，处理完直接删；匿名只可插入 |
| `site_suggest_hits` | 限频计数：`key` = `left(md5(ip),20)`，`ts`。无策略，谁都读不到 |

函数：`gui_verify(p_hash1, p_hash2)` 校验并签发令牌；`gui_token_ok()` 供 RLS 判断令牌有效性；`gui_dup_check(p_text)` 按标题相似度查重（只比对 approved/adopted 情报与未删除条目，故意限制以免泄露投稿标题）。

## CORS 与令牌

网关 `Access-Control-Allow-Headers` 是写死白名单（约 40 个），不在列表里的头预检直接拦掉。实测：`x-gui-token` 浏览器发不出；`X-Client-Info` 等能发但被网关吞掉；`Prefer` 能发**且能到数据库**。所以令牌走：

```
Prefer: return=minimal, gui-token=<64 位令牌>
```

PostgREST 忽略不认识的指令，`gui_token_ok()` 用正则从 `prefer` 里取令牌。要加新头先跑一次 OPTIONS 预检。

来源白名单：`https://cangwu-protect-union.github.io` 与 `http://localhost:*` / `http://127.0.0.1:*` 允许；局域网 IP 与 `file://`（Origin 为 `null`）拒绝。白名单是付费功能（个人版 ¥19.9/月），到期降级后前端写入全部失效。

## 写入权限

`gui_entries`、`gui_entry_versions` 的 INSERT/UPDATE 要 `gui_token_ok()`；`gui_tips` 开放写入，但 INSERT 策略强制 `status='pending'`，改状态要令牌。版本表没有 DELETE 策略。令牌失效时前端收到 `42501 row-level security`，代码清本地令牌并提示重新验证。

## 返回形态会反过来改判策略

`Prefer: return=representation` 不是纯输出选项：数据库会拿 **SELECT 策略**去筛返回行。写「当前身份看不见」的行（`gui_tips` 的 pending/rejected）会报 `42501 new row violates row-level security policy`——看着像写入权限没配好，其实是读策略挡的。`gui_entries` 可用（读策略 `using (true)`）；`gui_tips` **不要用**。
判「PATCH 有没有生效」改成三步：`return=minimal` 写入 → 带令牌把这条读回来 → 比对状态。

## RLS 可见性 ≠ 页面过滤

策略只保证越权拿不到；带令牌的成员读 `gui_tips` 会拿到全部状态，公开页面必须显式传 `status=in.(approved,adopted)`，否则待审和已驳回会漏到公开列表。

## 延迟

冷启动（全新浏览器配置第一次连网关）TLS 握手实测 **12.3 秒**，热连接后单次查询约 120ms。前端读超时 6 秒 + 一次重试（`retryOnceOnTimeout`），超时熔断 5 分钟降级种子数据。验收性能必须说明冷/热，别把 12 秒当回归。

## 自检矩阵

改权限后跑这五个，缺一不可：

```
1 无令牌 INSERT gui_entries   → 42501
2 伪造令牌 INSERT             → 42501
3 有效令牌 INSERT             → 201
4 无令牌 PATCH 已有行         → 204 但不生效；带令牌读回确认
5 无令牌 INSERT gui_tips      → 201（status 为 pending）
```

有可见性策略的表再加：匿名读 pending/rejected → `[]`；带令牌读同一条 → 有行；匿名伪造 status=approved 插入 → 42501；匿名 INSERT `site_suggestions` → 201、GET → `[]`、DELETE → 204 但行还在。再确认 `select * from gui_secrets` 和 `gui_tokens` 对 anon 返回 `[]`。

## 令牌入口

浏览器端取令牌用 `http://127.0.0.1:9300/_local/tests/lib/token.html`（唯一入口）。令牌 2 小时有效，存 sessionStorage 的 `gui_token` / `gui_token_exp`；测试里 `addInitScript` 直接注入即可。

## 迁移

完整流程与坑（控制台原子执行、删列被依赖挡住、text→uuid 主键、PostgREST 验证）见 [迁移.md](迁移.md)。要点：

- SQL 写 `_local\sql\`（不提交、不加注释），结尾 `notify pgrst, 'reload schema';`
- 改函数 `create or replace`；改策略先 `drop policy if exists` 再建
- 前端写入走 `sendWithColumnFallback()`，缺字段自动去列重试，「先发代码后跑 SQL」不会崩

## 站点建议实测结论

完整表见 [迁移.md](迁移.md)「站点建议实测结论」。核心：匿名只可插入；读、删要令牌；**匿名 DELETE 返回 204 但删不掉**（RLS 只过滤行不抛错，判断生效必须带令牌读回）；全站限频有效（触发器，第 21 条起 400）；**按 IP 限频无效**（网关 `x-forwarded-for` 每次不同）；`security definer` 触发器能读写 RLS 表。
两个易踩：`{ ...headers, Prefer: 'return=minimal' }` 会覆盖掉 `gui-token`，要拼接不要覆盖；404 `DATABASE_PGRST205` = 表没建或 schema cache 没刷新，先 `GET ?select=id&limit=1` 确认。

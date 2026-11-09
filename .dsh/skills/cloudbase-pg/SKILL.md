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
| `gui_entries` | 条目。`deleted` 软删除，`refs` 引用情报，`thumbs` 与 `images` 一一对应，`related` 关联条目 |
| `gui_entry_versions` | 版本归档，只增不改不删，`applied` 标记已应用 |
| `gui_tips` | 情报投稿，与图鉴隔离。`status` ∈ pending / approved / rejected / adopted，`reviewed_at`、`review_note` 记录审核 |
| `gui_secrets` | 答案哈希，**无 RLS 策略，anon 读不到** |
| `gui_tokens` | 验证签发的令牌，同样读不到 |
| `gui_zones` | 区域。主键 `id` 是 **uuid**（界面不显示），`related` 存 `ghost:<id>` / `zone:<uuid>`，`refs` 与 `gui_entries.refs` 同构 |
| `gui_zone_versions` | 区域版本归档，列与 `gui_entries_versions` 对齐，`zone_id` 存 uuid 字符串 |
| `gui_zone_tips` | 区域投稿，`adopted` / `adopted_zone_id` 标记是否已转正 |

函数：`gui_verify(p_hash1, p_hash2)` 校验并签发令牌；`gui_token_ok()` 供 RLS 判断令牌有效性；`gui_dup_check(p_text)` 按标题相似度查重，只比对 `approved` / `adopted` 的情报和未删除的条目（用它绕开 RLS 读待审行会泄露投稿标题，所以故意限制）。

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

`gui_entries`、`gui_entry_versions` 的 INSERT/UPDATE 要 `gui_token_ok()`；`gui_tips` 开放写入，但 INSERT 策略强制 `status = 'pending'`，改状态要令牌。版本表没有 DELETE 策略，删除必须用 SQL。令牌失效时前端收到 `42501 row-level security`，代码会清本地令牌并提示重新验证。

## 返回形态会反过来改判策略

`Prefer: return=representation` 不是纯输出选项：数据库会拿 **SELECT 策略**去筛返回行。如果写的是「当前身份看不见」的行（`gui_tips` 的 pending / rejected），INSERT / UPDATE 会直接报 `42501 new row violates row-level security policy`，看着像写入权限没配好，其实是读策略挡的。

| 表 | representation | 说明 |
|---|---|---|
| `gui_entries` | 可用 | 读策略是 `using (true)`，返回行不受可见性影响 |
| `gui_tips` | **不要用** | 读策略按 status 过滤，pending / rejected 连写都会失败 |

判「PATCH 到底有没有生效」改成三步：`return=minimal` 写入 → 带令牌把这条读回来 → 比对状态。这样 RLS 静默影响 0 行也能发现。

## RLS 可见性 ≠ 页面过滤

策略只保证「越权拿不到」，不保证「页面只显示该显示的」。带令牌的成员读 `gui_tips` 会拿到全部状态，公开页面必须显式传 `status=in.(approved,adopted)`，否则待审和已驳回会漏到公开列表里。

## 延迟

冷启动（全新浏览器配置第一次连网关）TLS 握手实测 **12.3 秒**，热连接后单次查询约 120ms。前端读超时是 6 秒，超时会触发 5 分钟熔断降级到种子数据，所以读请求带一次重试（`retryOnceOnTimeout`）。验收性能时必须说明是冷启动还是热连接，别把 12 秒当回归。

## 自检矩阵

改权限后跑这五个，缺一不可：

```
1 无令牌 INSERT gui_entries    → 42501
2 伪造令牌 INSERT              → 42501
3 有效令牌 INSERT              → 201
4 无令牌 PATCH 已有行          → 204 但不生效；带令牌读回确认状态没变（gui_tips 别用 representation 判，见上文）
5 无令牌 INSERT gui_tips       → 201（status 为 pending）
```

有可见性策略的表再加三条：

```
6 匿名读 pending / rejected    → []
7 带令牌读同一条               → 有行
8 匿名伪造 status=approved 插入 → 42501
```

再确认 `select * from gui_secrets` 和 `gui_tokens` 对 anon 返回 `[]`。

## 迁移

1. SQL 写到 `_local\sql\`，`_local/` 已排除，不要提交；脚本不加注释。
2. 结尾加 `notify pgrst, 'reload schema';`。
3. 交给用户在控制台执行，之后用 curl 逐项验证。
4. 前端写入走 `sendWithColumnFallback()`，缺字段自动去掉重试，所以「先发代码后跑 SQL」不会崩。

改函数用 `create or replace`；改策略先 `drop policy if exists` 再建。

### 控制台按批原子执行

一次粘贴多条语句，**任何一条报错整批回滚**。实测：一批十几条在 `drop column` 处失败后，
先前 `add column` / `update` 的结果全部不存在，`select=related` 仍然 400。
所以重跑前先用 PostgREST 查一次实际状态，别按「前面的应该已经执行」去写增量脚本。
脚本尽量写成幂等：`add column if not exists`、`drop policy if exists`、`on conflict do nothing`。

### 删列会被依赖对象挡住

策略里引用了要删的列时，`drop column` 直接失败：

```
cannot drop column region of table gui_zones because other objects depend on it (SQLSTATE 2BP01)
```

顺序必须是：先 `drop policy if exists` 掉引用了这些列的策略 → 删列 / 改列 → 用新字段重建策略。
建表时把校验写进策略（如 `char_length(region) between 1 and 60`）就会埋下这个坑，
以后删字段时要一起改策略。

### 主键从 text 换成 uuid

`gui_zones` 这套迁移的固定套路，重跑前先确认 `new_id` 列是否存在：

```sql
alter table public.gui_zones add column if not exists new_id uuid not null default gen_random_uuid();
-- 用旧 id join 重写所有引用关系（related、gui_zone_versions.zone_id）
-- 删旧列 → drop 主键约束 → rename id → rename new_id → add primary key → drop legacy 列
```

注意 `gen_random_uuid()` 对每一行求值，3 行会得到 3 个不同的 uuid；写引用时要 join 回旧 id 再转。

### 用 PostgREST 验证迁移结果

不连 psql 也能验：`select=新列` 返回 200 说明列在；400 + `42703 column ... does not exist` 说明还没迁移。
外键/依赖对象导致的失败只能看控制台报错原文，`2BP01` 就是「有东西依赖它」。

## 令牌与验证的其他入口

- 浏览器端取令牌不必开 F12：临时页答完两题把令牌显示出来（`_local/tests/lib/token.html`）。
- 令牌 2 小时有效，存在 sessionStorage 的 `gui_token` / `gui_token_exp`
  （测试里用 `addInitScript` 直接注入即可，不必走验证表单）。

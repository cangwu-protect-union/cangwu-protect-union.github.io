# 对局线 · 远程联机规格

写于 2026-11-27。v1 只做「两位朋友各用自己的设备打一局」，不做账号、观战、聊天与强反作弊。

## 目标

在对局页（`test.html`）里建房、把链接发给对手、各选一个角色，双方只在自己的回合操作，约 2 秒内看到对方动作；刷新能回到同一局，结束后照常写入 `rpg_battles` 并可回放。

## 已定决策

| 事项 | 决定 | 理由 |
|---|---|---|
| 联机形态 | 准实时轮询（2 秒） | 现有后端只有 CloudBase PostgreSQL/PostgREST，没有长连接；轮询不新增服务 |
| 权威与反作弊 | 客户端计算 + 服务端校验座位/序号 + 双端状态指纹比对 | 引擎是浏览器 JS，服务端没有规则执行环境；指纹不一致立即中止 |
| 身份 | 昵称 + 房间码 + 本机座位密钥 | 不引入账号体系；刷新可恢复，换设备不恢复 |
| 首版范围 | 核心对局 | 观战、撤销、聊天、过期自动清理不做 |
| 冻结置换 | 并入并替换「对局 4 项」第 4 项（陌生人入口验收） | 联机入房体验覆盖陌生人入口；角色线不动 |

## 终点

- 桌面浏览器两个独立窗口能完整打完一局并保存战报。
- 手机横屏能建房、加入、出招、刷新恢复。
- 本地热座、回放、战报列表不受影响。
- 结束后 `rpg_battles` 里有一条可回放的战报。
- 指纹不一致、房间满、凭证失效、旧引擎版本四种错误都有明确提示，不白屏。

做完即停：不加观战、不加撤销、不加聊天、不做房间列表/匹配、不做服务端权威。

## 用户流程

1. 甲打开 `test.html` →「远程联机」→ 填昵称、选角色 →「创建房间」。
2. 页面显示 8 位房间码和链接；甲复制链接发给乙。
3. 乙打开链接 → 填昵称、选角色 →「加入房间」。
4. 双方进入对局；轮到自己时操作栏可用，对方回合显示「等 X 行动」。
5. 任一方认输或血量清零 → 结算页；双方都尝试保存同一份战报（幂等）。
6. 刷新页面：URL 带 `?room=CODE` 且本机有座位密钥时自动回到房间；没有则显示加入表单。

## 架构

### 房间与权威

- 房间、动作日志存数据库；客户端只通过 `rpc/rpg_room_*` 访问，表本身对 anon 不可读。
- 服务端只校验：座位密钥、房间状态、动作序号、引擎版本、字段长度；**不校验招式合法性**。
- 每步动作由提交方计算 `committed` 与行动后的状态指纹；对手拉到后重算，指纹不一致立即停止同步并关闭房间。
- 服务端不判断轮到谁；客户端用 `state.turnUid` 的 side 判断，非本方回合拒绝操作。

### 数据模型

新增两张表（迁移脚本 `_local/sql/rpg-room-setup.sql`，不提交）：

`rpg_rooms`

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | text pk | 8 位房间码，字符集 `A-HJ-NP-Z2-9` |
| `status` | text | `waiting` / `playing` / `finished` / `abandoned` |
| `engine_version` | text | 建房时的 `RPG_APP.engineVersion`，加入与追加都要求相等 |
| `seed` | bigint | 服务端生成，1..999999999 |
| `character_a` / `name_a` / `nick_a` / `seat_a_hash` | text | 甲的角色 id / 显示名 / 昵称 / `md5(座位密钥)` |
| `character_b` / `name_b` / `nick_b` / `seat_b_hash` | text | 乙；未加入时为空串 |
| `result` | text | `''` / `a` / `b` / `draw` |
| `final_hash` | text | 最后一步的状态指纹 |
| `steps` / `rounds` / `last_seq` | integer | 冗余计数，追加时随行更新 |
| `seen_a` / `seen_b` | timestamptz | 最近一次拉取时间，用于「对手在线/离线」 |
| `created_at` / `updated_at` / `started_at` / `finished_at` | timestamptz | 生命周期与 30 天清理 |

`rpg_room_actions`

| 列 | 类型 | 说明 |
|---|---|---|
| `room_id` | text | 外键 → `rpg_rooms(id)`，级联删除 |
| `seq` | integer | 从 1 递增，主键 `(room_id, seq)` |
| `side` | text | `a` / `b`，由密钥推导，不由客户端声明 |
| `action` | jsonb | 引擎 `committed` 动作 |
| `state_hash` | text | 该步之后的状态指纹（8 位十六进制） |
| `client_tag` | text | 客户端生成，用于超时重试后识别「这一步是我提交的」 |
| `created_at` | timestamptz | |

表启用 RLS、不建策略、`revoke all`；只用 `security definer` 函数读写，函数 `revoke all from public` 后只 `grant execute` 给 anon/authenticated。

### RPC 契约

全部 `POST /v1/rdb/rest/rpc/<name>`，请求体为 JSON；业务错误返回 HTTP 200 + `{ok:false, code}`，网络/权限错误由前端提示。

| 函数 | 参数 | 成功返回 |
|---|---|---|
| `rpg_room_create` | `p_nick` `p_seat_key` `p_character` `p_name` `p_engine_version` | `{ok:true, side:"a", code, room, actions:[]}` |
| `rpg_room_join` | `p_code` `p_nick` `p_seat_key` `p_character` `p_name` `p_engine_version` | `{ok:true, side:"b", code, room, actions:[]}` |
| `rpg_room_get` | `p_code` `p_seat_key` `p_after_seq` `p_limit`(默认 500) | `{ok:true, side, room, actions, has_more, server_time}` |
| `rpg_room_append` | `p_code` `p_seat_key` `p_expected_seq` `p_action` `p_state_hash` `p_client_tag` `p_result` `p_rounds` `p_engine_version` | `{ok:true, seq, status}` |
| `rpg_room_abandon` | `p_code` `p_seat_key` `p_reason` | `{ok:true}` |
| `rpg_rooms_purge` | 无 | 删除 `updated_at` 早于 30 天的房间，返回条数 |

错误 `code`：`not_found` / `bad_key` / `full` / `finished` / `stale` / `version` / `bad_input` / `abandoned`。

`room` 字段：`{code, status, seed, engine_version, character_a, name_a, nick_a, character_b, name_b, nick_b, last_seq, result, steps, rounds, seen_a, seen_b}`。

动作字段：`{seq, side, action, state_hash, client_tag}`。

服务端校验要点：

- `p_code` 先 `upper(btrim())`，长度 8 且符合字符集。
- 座位密钥 16..64 字符；`md5(p_seat_key)` 与 `seat_a_hash` / `seat_b_hash` 比对。
- 建房时生成不重复房间码与种子；插入撞主键重试。
- 加入用 `select ... for update` 锁行，只允许 `status='waiting'` 且乙为空；引擎版本必须相等。
- 追加锁行，要求 `status='playing'`、`last_seq = p_expected_seq`、引擎版本相等、`jsonb_typeof(p_action)='object'` 且 `pg_column_size(p_action) <= 4000`；`p_result` ∈ `''`/`a`/`b`/`draw`；非空时置 `finished`。
- 所有函数 `security definer set search_path = public`。
- 迁移脚本结尾 `notify pgrst, 'reload schema';`，脚本内不写注释。

### 客户端模块

| 文件 | 职责 |
|---|---|
| `rpg6.0/js/rpg-data-rooms.js`（新） | RPC 封装：`createRoom` / `joinRoom` / `getRoom` / `appendRoomAction` / `abandonRoom` / `purgeRooms`；`rpg-data.js` 加 import，并在装配对象里显式列出这 6 个函数 |
| `rpg6.0/js/battle/battle-remote.js`（新） | 房间状态机、轮询、动作提交/应用、指纹校验、座位存储、URL 与结算；挂到 `RPG6Remote`，页面用 `P.remote` 引用 |
| `rpg6.0/test.html` | 设置区新增可折叠「远程联机」块与房间状态元素；对局栏加房间状态 |
| `rpg6.0/css/battle.css` | 房间面板、房间码、状态行；手机横屏紧凑样式 |
| `rpg6.0/js/battle/entry.js` | 在 `battle-page.js` 之前 import 远程模块 |
| `rpg6.0/js/battle/battle-page.js` | 初始化入口、`applyAction` 分流、`readOnly`、撤销隐藏、结算分支 |
| `rpg6.0/js/battle/battle-page-bind.js` | 建房/加入/复制/加入码输入/离开按钮；撤销在联机下禁用 |
| `rpg6.0/js/battle/battle-page-record.js` | 联机结算文案与幂等保存 |

不新增页面、不改导航、不改 `data/config.js`、不升 `ENGINE_VERSION`。

页面与测试共用的 DOM 契约：

| 选择器 | 用途 |
|---|---|
| `[data-room-box]` | 设置区可折叠的远程联机块 |
| `[data-room-link]` | 房间链接输入框（只读，值为完整链接） |
| `[data-room-note]` | 建房/加入/等待/错误提示 |
| `[data-room-status]` | 对局栏的联机状态（轮到你 / 等 X / 对手离线 / 同步中断） |
| `[data-stage][data-my-side]` | 本端座位 `a` / `b`，测试判侧用 |
| `[data-room-leave]` / `[data-room-copy]` | 结算页离开与复制房间码 |

### 同步与一致性

- 轮询间隔 2 秒；页面隐藏时降到 10 秒，恢复可见立即拉一次；连续失败指数退避到 15 秒，状态显示「同步中断，重试中」。
- 每次拉取带 `after_seq`；只应用 `seq = 本地 + 1` 的动作，校验 `state_hash` 后提交。
- 本机操作：先在克隆状态上 `B.battle.apply` 得到 `committed` 与新状态，再调 `rpg_room_append`；服务端确认后才替换本地状态并写入 `P.actions`。
- 追加返回 `stale`：立即重拉；若新动作的 `client_tag` 与本次相同，视为本机提交成功，不再提示「对方先走」。
- 双方各自保存 `P.actions`；结算时用 `BattleRecord.build` 生成战报，id 固定为 `room-<房间码>`，两端都尝试写入，`409/23505` 视为已保存。
- 刷新恢复：`?room=CODE` + localStorage 座位 → `getRoom(after_seq=0)` 分页拉全量并逐步重放；任何一步失败即中止。

### 身份与恢复

- 座位密钥：`crypto.getRandomValues` 生成 32 位十六进制；只在 localStorage 保存。
- localStorage：`rpg6-room-seats`（最多 8 个房间，按时间淘汰）与 `rpg6-nick`。
- 创建/加入成功后用 `history.replaceState` 把 `?room=CODE` 写进 URL；离开时去掉。
- 换设备、清缓存、无痕窗口都不能恢复原座位；这是 v1 的明确限制。

### 错误与中止

| 情况 | 行为 |
|---|---|
| 函数不存在（未跑 SQL） | 提示「联机服务未部署」 |
| 房间不存在/已过期 | 提示并停留在加入表单 |
| 房间已满 | 提示「房间已有两名玩家」 |
| 凭证失效 | 清除本机该房间记录，提示重新加入 |
| 引擎版本不一致 | 提示刷新页面；不进入对局 |
| 指纹不一致/动作无法结算 | 停止轮询，显示「与对手状态不一致」，调用 `rpg_room_abandon`，对方看到房间已关闭 |
| 对手离线 | 只显示「对手离线」；不自动判负 |

### 生命周期

- `waiting`：甲已建房，乙未加入；甲可取消。
- `playing`：乙加入即开始；任一方可认输（作为动作）或离开（关闭房间）。
- `finished`：最后一步 `result` 非空；不可再追加。
- `abandoned`：主动取消/离开/指纹中止；不可再加入。
- 清理：`rpg_rooms_purge()` 删除 30 天未活动的房间；对局页加载时 fire-and-forget 调一次，失败静默。

## 不做什么

- 不做观战、聊天/快捷语、房间列表、匹配、AI 对手。
- 不做账号体系、跨设备恢复、断线自动判负、超时计时。
- 不做服务端规则重算/强反作弊；不把引擎搬进云函数。
- 不做撤销；联机下隐藏撤销按钮。
- 不改 `battles.html`、不改战报表结构、不升引擎版本。

## 依赖与风险

- 依赖：CloudBase 控制台执行 `_local/sql/rpg-room-setup.sql`；网关冷启动可能 12 秒；PostgREST 只走 HTTP。
- 风险 1：一方改本机引擎可以伪造动作，对手端不会报错，只会跟着算；朋友局接受，文档写明。
- 风险 2：两位玩家角色数据来源不同（一人数据库、一人兜底种子）时，第一步就会指纹不一致；提示双方刷新。
- 风险 3：长期对局动作多，恢复要分页；单页 500 条，最多 2500 条，超出显示「对局步数过多」。
- 风险 4：轮询写 `seen` 会增加数据库写入；一个房间约 1 次/秒，可接受。
- 风险 5：房间码泄露会被陌生人抢乙位；甲可取消重开。

## 验收

- 引擎/对局回归：`powershell -NoProfile -ExecutionPolicy Bypass -File .dsh/skills/rpg6-character-batch/scripts/verify.ps1 -Browser`
- 双端用例：`node _local/tests/run-all.mjs --group=回合制`
- 全量校验：`powershell -NoProfile -ExecutionPolicy Bypass -File tools\check.ps1`
- 手工：桌面两窗口完整一局；手机横屏加入、刷新恢复、认输；回放该战报指纹一致。

## 边界变更

按 `AGENTS.md` 与 `backlog.md`：联机从「待定」转活跃，换掉「对局 4 项」第 4 项（陌生人入口验收），记一行 backlog；角色线不动。一个窗口只改这一次。

## 上线顺序与回退

1. 执行 SQL 迁移（人工，控制台原子执行）。
2. 合并代码（代码在 RPC 缺失时只显示「联机服务未部署」，不影响热座）。
3. 双端用例与手机实测通过后再发布。
4. 回退：撤代码即回到热座；两张新表不影响旧页面，保留 30 天后由 purge 清理。

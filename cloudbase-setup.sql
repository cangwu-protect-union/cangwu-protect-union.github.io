-- ============================================================
-- 鬼图鉴 · CloudBase PostgreSQL 建表脚本
-- 用法：云开发控制台 → SQL 型数据库 → SQL 编辑器 → 粘贴全部内容 → 执行
-- ============================================================
-- 说明：
-- 你要先把控制台里那个手建的 gui_entries 表删掉（它只有 id/created_at/user_id 三列，
-- 结构不对）。下面第一句会直接删表重建，表里现在是空的，不会有数据损失。
-- ============================================================


-- 1. 删除旧表（结构不对）
drop table if exists public.gui_entries cascade;


-- 2. 重建表，字段与网站的数据结构对应
create table public.gui_entries (
  id          text primary key,          -- 条目唯一标识，如 gu-gushan
  title       text not null,             -- 标题
  image       text,                      -- 图片地址（可为空）
  intro       text,                      -- 正文开头（列表页显示）
  body        text not null,             -- 详情页正文，段落用换行分隔
  tags        text[] default '{}',       -- 标签
  date        text,                      -- 记录日期 YYYY-MM-DD
  created_at  timestamptz default now()   -- 创建时间
);


-- 3. 开启行级安全
alter table public.gui_entries enable row level security;


-- 4. 策略：所有人（含未登录的 anon）都能读取
create policy gui_select_anon
  on public.gui_entries
  for select
  to anon, authenticated
  using (true);


-- 5. 策略：所有人可以新增（「增加条目」页面依赖这一条）
create policy gui_insert_anon
  on public.gui_entries
  for insert
  to anon, authenticated
  with check (
    char_length(title) between 1 and 120
    and char_length(body) between 1 and 20000
  );


-- 6. 故意不建 update / delete 策略 → 谁都改不了、删不掉已有条目


-- 7. 授权（关键！少了这步会报 permission denied）
grant usage on schema public to anon, authenticated;
grant select, insert on public.gui_entries to anon, authenticated;


-- 8. 索引
create index gui_entries_created_idx on public.gui_entries (created_at desc);


-- ============================================================
-- 执行完可以验证（应该返回空表，不报错）：
--   select * from public.gui_entries;
-- ============================================================
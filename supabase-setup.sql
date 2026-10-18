-- ============================================================
-- 鬼图鉴 · 云数据库建表脚本
-- 用法：打开 Supabase 项目的 SQL Editor，把整个文件粘进去，点 Run
-- ============================================================

-- 1. 建表
create table if not exists public.gui_entries (
  id          text primary key,
  title       text not null,
  image       text,
  intro       text,
  body        text not null,
  tags        text[] default '{}',
  date        text,
  created_at  timestamptz default now()
);

-- 2. 开启行级安全（RLS）
alter table public.gui_entries enable row level security;

-- 3. 任何人（包括未登录的访客）都可以读取条目
drop policy if exists "public can read entries" on public.gui_entries;
create policy "public can read entries"
  on public.gui_entries for select
  to anon, authenticated
  using (true);

-- 4. 任何人可以新增条目（「增加条目」页面依赖这一条）
drop policy if exists "anyone can insert entries" on public.gui_entries;
create policy "anyone can insert entries"
  on public.gui_entries for insert
  to anon, authenticated
  with check (
    char_length(title) between 1 and 120
    and char_length(body) between 1 and 20000
  );

-- 5. 故意不给 update / delete 权限。
--    这样即使有人拿到 anon key，也改不了、删不掉已有条目。

-- 6. 常用查询的索引
create index if not exists gui_entries_created_idx
  on public.gui_entries (created_at desc);
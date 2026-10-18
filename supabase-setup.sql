-- ============================================================
-- 鬼图鉴 · 云数据库建表脚本
-- 用法：打开 Supabase 项目的 SQL Editor，新建 query，把整个文件粘进去，点 Run
-- ============================================================
--
-- 说明：新建项目时如果按建议取消了「Automatically expose new tables」，
-- 新表默认没有任何 API 权限，所以脚本里必须显式 GRANT（第 7 步）。
-- 本脚本可以重复执行，不会报错。
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
--    开启后，能不能读/写由「策略」决定，而不是由权限决定。
alter table public.gui_entries enable row level security;


-- 3. 策略：任何人（包括未登录的访客）都可以读取条目
drop policy if exists "public can read entries" on public.gui_entries;
create policy "public can read entries"
  on public.gui_entries for select
  to anon, authenticated
  using (true);


-- 4. 策略：任何人可以新增条目（「增加条目」页面依赖这一条）
--    顺便限制标题和正文长度，防止有人塞超长垃圾内容。
drop policy if exists "anyone can insert entries" on public.gui_entries;
create policy "anyone can insert entries"
  on public.gui_entries for insert
  to anon, authenticated
  with check (
    char_length(title) between 1 and 120
    and char_length(body) between 1 and 20000
  );


-- 5. 故意不创建 update / delete 策略。
--    这样即使有人拿到 anon key，也改不了、删不掉已有条目。


-- 6. 常用查询的索引
create index if not exists gui_entries_created_idx
  on public.gui_entries (created_at desc);


-- 7. 显式授权（关键！）
--    因为新建项目时取消了「Automatically expose new tables」，
--    必须手动把「读」和「增」两项权限授予匿名角色 anon。
--    注意：只给 select 和 insert，不给 update/delete/truncate。
grant usage on schema public to anon, authenticated;
grant select, insert on public.gui_entries to anon, authenticated;


-- 8. 让新表变更立即通知 API（一般自动生效，这行只是保险）
notify pgrst, 'reload schema';


-- ============================================================
-- 执行完之后可以验证一下：
--   select * from public.gui_entries;          -- 应该返回空表，不报错
-- ============================================================
-- =============================================
-- 4SC CrossFit 會員訓練平台 - 資料庫 Schema
-- 在 Supabase → SQL Editor 貼上執行
-- =============================================

-- 1. 會員資料表
create table if not exists members (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  real_name text not null,
  location text not null check (location in ('xindian', 'yonghe')),
  gender text not null check (gender in ('male', 'female')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now()
);

-- RLS
alter table members enable row level security;

create policy "使用者只能看自己的資料"
  on members for select
  using (auth.uid() = id);

create policy "使用者可以新增自己的資料"
  on members for insert
  with check (auth.uid() = id);

create policy "使用者可以更新自己的資料"
  on members for update
  using (auth.uid() = id);

-- 管理員可以看所有資料（用 service role key，admin.html 若要改用 service key 才能用）
-- 目前先用 anon key，管理員查詢時繞過 RLS 的方式是用 Supabase Dashboard 直接看

-- =============================================
-- 2. 個人最大重量 (PR) 紀錄
create table if not exists personal_records (
  id uuid default gen_random_uuid() primary key,
  member_id uuid references members(id) on delete cascade,
  movement text not null,
  weight_kg numeric not null,
  recorded_at timestamptz default now(),
  unique (member_id, movement)
);

alter table personal_records enable row level security;

create policy "使用者只能操作自己的 PR"
  on personal_records for all
  using (auth.uid() = member_id)
  with check (auth.uid() = member_id);

-- =============================================
-- 3. 訓練紀錄
create table if not exists training_logs (
  id uuid default gen_random_uuid() primary key,
  member_id uuid references members(id) on delete cascade,
  date date not null,
  wod_date date,
  wod_name text,
  result text,
  notes text,
  ai_feedback text,
  created_at timestamptz default now()
);

alter table training_logs enable row level security;

create policy "使用者只能操作自己的訓練紀錄"
  on training_logs for all
  using (auth.uid() = member_id)
  with check (auth.uid() = member_id);

-- =============================================
-- 4. WOD 快取（教練後台儲存課表用）
create table if not exists wod_cache (
  id text primary key default 'current',
  data jsonb not null,
  updated_at timestamptz default now()
);

alter table wod_cache enable row level security;

create policy "所有人可以讀 WOD"
  on wod_cache for select
  using (true);

-- 只有管理員可以寫（目前透過 service key 寫入）
-- =============================================

-- 完成！可以在 Supabase → Authentication → Providers 設定 Google OAuth

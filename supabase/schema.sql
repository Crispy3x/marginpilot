-- MarginPilot database. Run once in Supabase > SQL Editor.

-- One row per signed-up user (filled automatically on sign-up).
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);
create index if not exists profiles_email on public.profiles (lower(email));

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, lower(new.email)) on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- The user's Whop membership, written only by the server (webhook).
create table if not exists public.subscriptions (
  membership_id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  product_id text, plan_id text, whop_user_id text,
  tier text not null default 'none' check (tier in ('none', 'starter', 'growth', 'pro')),
  status text not null,
  period_start timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_user on public.subscriptions (user_id, updated_at desc);

-- Every Claude call and what it cost, for the per-plan AI cap ($1 during the trial).
create table if not exists public.ai_calls (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  task text not null,
  cost_usd numeric(10, 6) not null default 0,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ai_calls_user on public.ai_calls (user_id, created_at);

-- Users can read their own rows; only the server (service role) writes.
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.ai_calls enable row level security;
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select using (auth.uid() = id);
drop policy if exists "read own subscription" on public.subscriptions;
create policy "read own subscription" on public.subscriptions for select using (auth.uid() = user_id);
drop policy if exists "read own ai calls" on public.ai_calls;
create policy "read own ai calls" on public.ai_calls for select using (auth.uid() = user_id);

-- Suppliers a seller connects. Saving one requires confirming a direct agreement with that supplier.
create table if not exists public.suppliers (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  connection text not null default 'api' check (connection in ('api', 'feed', 'portal')),
  agreement_confirmed_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.suppliers enable row level security;
drop policy if exists "own suppliers" on public.suppliers;
create policy "own suppliers" on public.suppliers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

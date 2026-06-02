create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text unique not null,
  full_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.activation_codes (
  id uuid default gen_random_uuid() primary key,
  code text unique not null,
  type text not null check (type in ('monthly', 'annual', 'lifetime', 'gift', 'admin')),
  status text not null default 'unused' check (status in ('unused', 'active', 'expired', 'cancelled', 'revoked')),
  user_id uuid references public.profiles(id) on delete set null,
  email text,
  stripe_subscription_id text,
  stripe_customer_id text,
  stripe_payment_intent_id text,
  created_at timestamptz default now(),
  activated_at timestamptz,
  expires_at timestamptz,
  last_validated_at timestamptz,
  notes text
);

create table if not exists public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  email text not null,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  plan text not null check (plan in ('monthly', 'annual', 'lifetime')),
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  activation_code_id uuid references public.activation_codes(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.admin_sessions (
  id uuid default gen_random_uuid() primary key,
  session_token text unique not null,
  created_at timestamptz default now(),
  expires_at timestamptz not null
);

create table if not exists public.admin_password_overrides (
  id uuid default gen_random_uuid() primary key,
  password_hash text not null,
  created_at timestamptz default now()
);

create table if not exists public.code_generation_log (
  id uuid default gen_random_uuid() primary key,
  code_id uuid references public.activation_codes(id) on delete set null,
  generated_by text not null,
  generated_at timestamptz default now(),
  notes text
);

alter table public.profiles enable row level security;
alter table public.activation_codes enable row level security;
alter table public.subscriptions enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.code_generation_log enable row level security;
alter table public.admin_password_overrides enable row level security;

create policy "Users see own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users see own codes" on public.activation_codes for select using (user_id = auth.uid() or email = auth.email());
create policy "Users see own subscriptions" on public.subscriptions for select using (user_id = auth.uid() or email = auth.email());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

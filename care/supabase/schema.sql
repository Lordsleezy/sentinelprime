create extension if not exists pgcrypto;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text unique not null,
  name text,
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  stripe_subscription_id text unique,
  plan text not null check (plan in ('basic', 'plus')),
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  type text not null check (type in ('ai_escalation', 'remote_session', 'phone_callback')),
  issue_summary text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'resolved')),
  overage boolean not null default false,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  ticket_id uuid references public.tickets(id) on delete set null,
  type text not null check (type in ('ai_chat', 'ai_escalation', 'remote_session', 'phone_callback')),
  summary text,
  billing_cycle_start timestamptz not null,
  is_overage boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace view public.tickets_admin_view as
select
  t.id,
  t.type,
  t.issue_summary,
  t.details,
  t.status,
  t.overage,
  t.created_at,
  c.name as customer_name,
  c.email as customer_email,
  s.plan
from public.tickets t
join public.customers c on c.id = t.customer_id
left join lateral (
  select plan from public.subscriptions s
  where s.customer_id = c.id and s.status = 'active'
  order by s.created_at desc
  limit 1
) s on true;

alter table public.customers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.tickets enable row level security;
alter table public.interactions enable row level security;

create policy "customers can read own customer row" on public.customers
  for select using (auth.uid() = user_id);

create policy "customers can update own customer row" on public.customers
  for update using (auth.uid() = user_id);

create policy "customers can read own subscriptions" on public.subscriptions
  for select using (customer_id in (select id from public.customers where user_id = auth.uid()));

create policy "customers can read own tickets" on public.tickets
  for select using (customer_id in (select id from public.customers where user_id = auth.uid()));

create policy "customers can read own interactions" on public.interactions
  for select using (customer_id in (select id from public.customers where user_id = auth.uid()));

create index if not exists customers_user_id_idx on public.customers(user_id);
create index if not exists customers_email_idx on public.customers(email);
create index if not exists subscriptions_customer_id_idx on public.subscriptions(customer_id);
create index if not exists tickets_customer_id_status_idx on public.tickets(customer_id, status);
create index if not exists interactions_customer_id_created_at_idx on public.interactions(customer_id, created_at);

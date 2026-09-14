create table if not exists public.business_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists business_push_subscriptions_business_id_idx on public.business_push_subscriptions(business_id);
alter table public.business_push_subscriptions enable row level security;
revoke all on public.business_push_subscriptions from anon, authenticated;
grant all on public.business_push_subscriptions to service_role;

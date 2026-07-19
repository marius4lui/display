create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('n8n', 'home_assistant')),
  name text not null check (char_length(name) between 1 and 160),
  base_url text not null check (base_url ~ '^https://'),
  status text not null default 'pending' check (status in ('pending', 'active', 'error', 'disabled')),
  metadata jsonb not null default '{}'::jsonb,
  last_tested_at timestamptz,
  last_test_status text,
  last_test_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index integrations_owner_idx on public.integrations(owner_id, updated_at desc);
alter table public.integrations enable row level security;
create policy integrations_owner_all on public.integrations for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create table public.integration_credentials (
  integration_id uuid primary key references public.integrations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  ciphertext text not null,
  iv text not null,
  auth_tag text not null,
  updated_at timestamptz not null default now()
);
alter table public.integration_credentials enable row level security;
create policy integration_credentials_owner_all on public.integration_credentials for all
  using (owner_id = auth.uid() and exists (select 1 from public.integrations i where i.id = integration_id and i.owner_id = auth.uid()))
  with check (owner_id = auth.uid() and exists (select 1 from public.integrations i where i.id = integration_id and i.owner_id = auth.uid()));

create table public.action_audit (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  integration_id uuid references public.integrations(id) on delete set null,
  display_id uuid not null references public.displays(id) on delete cascade,
  device_id uuid references public.display_devices(id) on delete set null,
  action_id text not null,
  idempotency_key text not null,
  status text not null check (status in ('pending', 'success', 'failed', 'timeout', 'rate_limited')),
  http_status integer,
  duration_ms integer,
  error_code text,
  created_at timestamptz not null default now(),
  unique(device_id, action_id, idempotency_key)
);
create index action_audit_lookup_idx on public.action_audit(display_id, action_id, created_at desc);
alter table public.action_audit enable row level security;
create policy action_audit_owner_read on public.action_audit for select using (owner_id = auth.uid());

create table public.action_rate_limits (
  device_id uuid not null references public.display_devices(id) on delete cascade,
  action_id text not null,
  available_at timestamptz not null,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1,
  primary key(device_id, action_id)
);
alter table public.action_rate_limits enable row level security;

create or replace function public.claim_player_action(
  target_device uuid, target_action text, cooldown_ms integer, max_per_minute integer default 30
) returns text language plpgsql security definer set search_path = public as $$
declare row action_rate_limits%rowtype; now_at timestamptz := clock_timestamp();
begin
  select * into row from action_rate_limits where device_id=target_device and action_id=target_action for update;
  if row.device_id is not null and row.available_at > now_at then return 'cooldown'; end if;
  if row.device_id is not null and row.window_started_at > now_at - interval '1 minute' and row.request_count >= max_per_minute then return 'rate_limit'; end if;
  insert into action_rate_limits(device_id, action_id, available_at, window_started_at, request_count)
  values(target_device, target_action, now_at + make_interval(secs => greatest(cooldown_ms, 0)::double precision / 1000.0), now_at, 1)
  on conflict(device_id, action_id) do update set
    available_at=excluded.available_at,
    window_started_at=case when action_rate_limits.window_started_at <= now_at - interval '1 minute' then now_at else action_rate_limits.window_started_at end,
    request_count=case when action_rate_limits.window_started_at <= now_at - interval '1 minute' then 1 else action_rate_limits.request_count + 1 end;
  return 'ok';
end $$;
revoke all on function public.claim_player_action(uuid,text,integer,integer) from public, anon, authenticated;
grant execute on function public.claim_player_action(uuid,text,integer,integer) to service_role;

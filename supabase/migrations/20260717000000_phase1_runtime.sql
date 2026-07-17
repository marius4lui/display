create table public.secrets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (name ~ '^[A-Za-z][A-Za-z0-9_]{1,63}$'),
  ciphertext text not null,
  iv text not null,
  auth_tag text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, name)
);
alter table public.secrets enable row level security;
create policy secrets_owner_all on public.secrets for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create table public.data_source_runtime (
  display_id uuid not null references public.displays(id) on delete cascade,
  source_id text not null,
  value jsonb,
  checked_at timestamptz not null default now(),
  succeeded_at timestamptz,
  duration_ms integer,
  http_status integer,
  error text,
  lease_until timestamptz,
  primary key(display_id, source_id)
);
create index data_source_runtime_due_idx on public.data_source_runtime(lease_until, checked_at);

create table public.data_source_samples (
  id bigint generated always as identity primary key,
  display_id uuid not null references public.displays(id) on delete cascade,
  source_id text not null,
  sampled_at timestamptz not null default now(),
  value jsonb not null
);
create index data_source_samples_lookup_idx on public.data_source_samples(display_id, source_id, sampled_at desc);

alter table public.data_source_runtime enable row level security;
alter table public.data_source_samples enable row level security;
create policy runtime_owner_read on public.data_source_runtime for select using
  (exists (select 1 from public.displays d where d.id = display_id and d.owner_id = auth.uid()));
create policy samples_owner_read on public.data_source_samples for select using
  (exists (select 1 from public.displays d where d.id = display_id and d.owner_id = auth.uid()));

alter table public.display_devices
  add column if not exists app_version text,
  add column if not exists platform_version text,
  add column if not exists dashboard_version integer,
  add column if not exists last_sync_at timestamptz,
  add column if not exists last_data_at timestamptz,
  add column if not exists last_error text;

create or replace function public.claim_due_data_sources(claim_seconds integer default 45)
returns table(display_id uuid, owner_id uuid, source_id text, source jsonb)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with candidates as (
    select d.id display_id, d.owner_id, source->>'id' source_id, source
    from displays d
    join display_drafts dd on dd.display_id = d.id
    cross join lateral jsonb_array_elements(coalesce(dd.document->'dataSources', '[]'::jsonb)) source
    left join data_source_runtime r on r.display_id = d.id and r.source_id = source->>'id'
    where coalesce(r.lease_until, '-infinity') < now()
      and coalesce(r.checked_at, '-infinity') <= now() - make_interval(secs => greatest(10, coalesce((source->>'refreshSeconds')::integer, (dd.document->'settings'->>'dataPollSeconds')::integer, 300)))
    order by coalesce(r.checked_at, '-infinity')
    limit 25
    for update of d skip locked
  ), claimed as (
    insert into data_source_runtime(display_id, source_id, lease_until)
    select c.display_id, c.source_id, now() + make_interval(secs => claim_seconds) from candidates c
    on conflict(display_id, source_id) do update set lease_until = excluded.lease_until
    returning data_source_runtime.display_id, data_source_runtime.source_id
  )
  select c.display_id, c.owner_id, c.source_id, c.source from candidates c
  join claimed x using(display_id, source_id);
end $$;
revoke all on function public.claim_due_data_sources(integer) from public, anon, authenticated;


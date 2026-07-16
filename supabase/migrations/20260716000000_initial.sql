create extension if not exists pgcrypto;

create table public.displays (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default replace(encode(gen_random_bytes(9), 'base64'), '/', '_'),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Mein Dashboard' check (char_length(name) between 1 and 160),
  active_version integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index displays_owner_idx on public.displays(owner_id, updated_at desc);

create table public.display_drafts (
  display_id uuid primary key references public.displays(id) on delete cascade,
  envelope jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.display_versions (
  display_id uuid not null references public.displays(id) on delete cascade,
  version integer not null check (version > 0),
  envelope jsonb not null,
  content_hash text not null check (content_hash ~ '^[0-9a-fA-F]{64}$'),
  byte_size integer not null check (byte_size > 0 and byte_size <= 12582912),
  published_at timestamptz not null default now(),
  primary key (display_id, version)
);

create table public.encrypted_assets (
  id uuid primary key default gen_random_uuid(),
  display_id uuid not null references public.displays(id) on delete cascade,
  content_type text not null,
  byte_size integer not null check (byte_size > 0 and byte_size <= 20971520),
  content_hash text not null check (content_hash ~ '^[0-9a-fA-F]{64}$'),
  ciphertext bytea not null,
  created_at timestamptz not null default now()
);
create index encrypted_assets_display_idx on public.encrypted_assets(display_id);

create table public.device_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  display_id uuid not null references public.displays(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index pairing_display_idx on public.device_pairing_codes(display_id, expires_at desc);

create table public.display_devices (
  id uuid primary key default gen_random_uuid(),
  display_id uuid not null references public.displays(id) on delete cascade,
  name text not null default 'Android Display' check (char_length(name) between 1 and 100),
  token_hash text not null unique,
  paired_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz
);
create index display_devices_display_idx on public.display_devices(display_id, paired_at desc);

alter table public.displays enable row level security;
alter table public.display_drafts enable row level security;
alter table public.display_versions enable row level security;
alter table public.encrypted_assets enable row level security;
alter table public.device_pairing_codes enable row level security;
alter table public.display_devices enable row level security;

create policy displays_owner_all on public.displays for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy drafts_owner_all on public.display_drafts for all using (exists (select 1 from public.displays d where d.id = display_id and d.owner_id = auth.uid())) with check (exists (select 1 from public.displays d where d.id = display_id and d.owner_id = auth.uid()));
create policy versions_owner_all on public.display_versions for all using (exists (select 1 from public.displays d where d.id = display_id and d.owner_id = auth.uid())) with check (exists (select 1 from public.displays d where d.id = display_id and d.owner_id = auth.uid()));
create policy assets_owner_all on public.encrypted_assets for all using (exists (select 1 from public.displays d where d.id = display_id and d.owner_id = auth.uid())) with check (exists (select 1 from public.displays d where d.id = display_id and d.owner_id = auth.uid()));
create policy pairing_owner_all on public.device_pairing_codes for all using (exists (select 1 from public.displays d where d.id = display_id and d.owner_id = auth.uid())) with check (exists (select 1 from public.displays d where d.id = display_id and d.owner_id = auth.uid()));
create policy devices_owner_all on public.display_devices for all using (exists (select 1 from public.displays d where d.id = display_id and d.owner_id = auth.uid())) with check (exists (select 1 from public.displays d where d.id = display_id and d.owner_id = auth.uid()));

create or replace function public.publish_display(target_display uuid)
returns integer language plpgsql security invoker as $$
declare next_version integer; draft jsonb;
begin
  perform 1 from public.displays where id = target_display for update;
  select envelope into draft from public.display_drafts where display_id = target_display;
  if draft is null then raise exception 'Kein Entwurf vorhanden'; end if;
  select coalesce(max(version), 0) + 1 into next_version from public.display_versions where display_id = target_display;
  insert into public.display_versions(display_id, version, envelope, content_hash, byte_size)
    values (target_display, next_version, draft, draft->>'contentHash', (draft->>'byteSize')::integer);
  update public.displays set active_version = next_version, updated_at = now() where id = target_display;
  return next_version;
end $$;

create or replace function public.activate_display_version(target_display uuid, target_version integer)
returns void language plpgsql security invoker as $$
begin
  if not exists (select 1 from public.display_versions where display_id = target_display and version = target_version) then
    raise exception 'Version nicht gefunden';
  end if;
  update public.displays set active_version = target_version, updated_at = now() where id = target_display;
end $$;

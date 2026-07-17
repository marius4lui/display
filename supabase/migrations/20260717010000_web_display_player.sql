alter table public.device_pairing_codes
  add column if not exists global_lookup_hash text;

create unique index if not exists pairing_active_global_lookup_idx
  on public.device_pairing_codes(global_lookup_hash)
  where consumed_at is null and global_lookup_hash is not null;

alter table public.display_devices
  add column if not exists platform text not null default 'android';

create index if not exists display_devices_platform_idx
  on public.display_devices(display_id, platform, paired_at desc);

create table if not exists public.player_pairing_attempts (
  fingerprint_hash text primary key,
  window_started_at timestamptz not null default now(),
  failed_attempts integer not null default 0,
  blocked_until timestamptz
);

alter table public.player_pairing_attempts enable row level security;

create or replace function public.consume_web_pairing_code(
  lookup_hash text,
  device_name text,
  new_token_hash text
)
returns table(device_id uuid, display_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  pairing device_pairing_codes%rowtype;
  created display_devices%rowtype;
begin
  select * into pairing
  from device_pairing_codes
  where global_lookup_hash = lookup_hash
    and consumed_at is null
    and expires_at > now()
  for update;

  if pairing.id is null then return; end if;

  update device_pairing_codes codes
    set consumed_at = now()
    where codes.display_id = pairing.display_id and codes.consumed_at is null;

  insert into display_devices(display_id, name, token_hash, platform)
    values (pairing.display_id, left(device_name, 100), new_token_hash, 'web')
    returning * into created;

  return query select created.id, created.display_id;
end
$$;

revoke all on function public.consume_web_pairing_code(text, text, text)
  from public, anon, authenticated;
grant execute on function public.consume_web_pairing_code(text, text, text)
  to service_role;

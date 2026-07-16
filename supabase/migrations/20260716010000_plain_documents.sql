alter table public.display_drafts add column if not exists document jsonb;
alter table public.display_drafts alter column envelope drop not null;

alter table public.display_versions add column if not exists document jsonb;
alter table public.display_versions alter column envelope drop not null;

create or replace function public.publish_display(target_display uuid)
returns integer language plpgsql security invoker as $$
declare next_version integer; draft jsonb; document_hash text; document_size integer;
begin
  perform 1 from public.displays where id = target_display for update;
  select document into draft from public.display_drafts where display_id = target_display;
  if draft is null then raise exception 'Kein Entwurf vorhanden'; end if;
  select coalesce(max(version), 0) + 1 into next_version from public.display_versions where display_id = target_display;
  document_hash := encode(digest(convert_to(draft::text, 'UTF8'), 'sha256'), 'hex');
  document_size := octet_length(convert_to(draft::text, 'UTF8'));
  insert into public.display_versions(display_id, version, document, content_hash, byte_size)
    values (target_display, next_version, draft, document_hash, document_size);
  update public.displays set active_version = next_version, updated_at = now() where id = target_display;
  return next_version;
end $$;

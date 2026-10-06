-- Sow: content bank in the Blossom Supabase project (rlbrhpjljjgpqpqjrpkc). Idempotent parts first.
-- 1) tables, RLS, owner claim

create table if not exists public.sp_owners (
  uid uuid primary key references auth.users(id) on delete cascade,
  label text, added_at timestamptz not null default now());
create table if not exists public.sp_config (
  id int primary key default 1 check (id = 1),
  passcode_hash text not null,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now());
create table if not exists public.sp_posts (
  id uuid primary key default gen_random_uuid(),
  post_date date not null,
  post_time time not null default '06:00',
  position int not null default 0,
  title text not null default '',
  verse text,
  reference text,
  caption text not null default '',
  hashtags text not null default '',
  media_url text,
  video_url text,
  og_url text,
  link_url text,
  platforms text[] not null default array['facebook','fb_groups','whatsapp','x','youtube','fb_page'],
  captions jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','posted','skipped')),
  posted jsonb not null default '{}'::jsonb,
  source text not null default 'manual',
  slug text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now());
create index if not exists sp_posts_date_idx on public.sp_posts (post_date, position);
create table if not exists public.sp_log (
  id bigserial primary key, at timestamptz not null default now(),
  post_id uuid references public.sp_posts(id) on delete set null,
  platform text not null, ok boolean not null, detail text);
create table if not exists public.sp_secrets (
  name text primary key, value text not null, updated_at timestamptz not null default now());

alter table public.sp_owners enable row level security;
alter table public.sp_config enable row level security;
alter table public.sp_posts enable row level security;
alter table public.sp_log enable row level security;
alter table public.sp_secrets enable row level security;

create or replace function public.sp_is_owner() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.sp_owners where uid = auth.uid()) $$;
revoke all on function public.sp_is_owner() from public;
grant execute on function public.sp_is_owner() to anon, authenticated;

drop policy if exists sp_owners_self on public.sp_owners;
create policy sp_owners_self on public.sp_owners for select to authenticated using (uid = auth.uid());

drop policy if exists sp_posts_owner_all on public.sp_posts;
create policy sp_posts_owner_all on public.sp_posts for all to authenticated
  using (public.sp_is_owner()) with check (public.sp_is_owner());
-- No public read: Michael said no site integration (Oct 6, 2026); only owners read the bank.
drop policy if exists sp_posts_public_read on public.sp_posts;
drop policy if exists sp_log_owner_read on public.sp_log;
create policy sp_log_owner_read on public.sp_log for select to authenticated using (public.sp_is_owner());
-- sp_config, sp_secrets: no policies (service role / security definer only)

revoke all on public.sp_config, public.sp_secrets from anon, authenticated;
revoke all on public.sp_owners, public.sp_log from anon;
revoke all on public.sp_posts from anon;
grant select, insert, update, delete on public.sp_posts to authenticated;
grant select on public.sp_owners, public.sp_log to authenticated;

create or replace function public.sp_touch() returns trigger language plpgsql as
$$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists sp_posts_touch on public.sp_posts;
create trigger sp_posts_touch before update on public.sp_posts for each row execute function public.sp_touch();

-- Owner sign-in: an (anonymous) signed-in user proves the passcode once; their uid becomes an owner.
create or replace function public.sp_claim_owner(p_passcode text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare c public.sp_config;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  select * into c from public.sp_config where id = 1 for update;
  if c.locked_until is not null and c.locked_until > now() then
    raise exception 'too many tries, wait a few minutes';
  end if;
  if c.passcode_hash = extensions.crypt(p_passcode, c.passcode_hash) then
    update public.sp_config set failed_attempts = 0, locked_until = null where id = 1;
    insert into public.sp_owners(uid, label) values (auth.uid(), 'passcode') on conflict do nothing;
    return true;
  end if;
  update public.sp_config set failed_attempts = failed_attempts + 1,
    locked_until = case when failed_attempts + 1 >= 5 then now() + interval '10 minutes' else null end
    where id = 1;
  return false;
end $$;
revoke all on function public.sp_claim_owner(text) from public;
grant execute on function public.sp_claim_owner(text) to authenticated;

-- 2) later additions
alter table public.sp_posts add column if not exists thumb_url text;
alter table public.sp_posts alter column platforms set default array['facebook','fb_groups','whatsapp','wa_channel','x','youtube','fb_page'];
-- Storage: public bucket sow-media (posts/, og/, thumbs/, videos/, uploads/). Owner uploads go to uploads/:
create policy sow_media_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'sow-media' and (storage.foldername(name))[1] = 'uploads' and public.sp_is_owner());
create policy sow_media_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'sow-media' and (storage.foldername(name))[1] = 'uploads' and public.sp_is_owner());
-- Passcode (bcrypt):  insert into public.sp_config(id, passcode_hash) values (1, extensions.crypt('<PASSCODE>', extensions.gen_salt('bf')))
--   on conflict (id) do update set passcode_hash = excluded.passcode_hash, failed_attempts = 0, locked_until = null;

-- 3) scheduler: pg_cron + pg_net (same approach as the Michael AI bot), every 30 min
-- select vault.create_secret('<CRON_SECRET>', 'sow_cron_secret', 'Sow /api/cron bearer');
select cron.schedule('sow-autopost', '5,35 * * * *', $$
  select net.http_post(
    url := 'https://sow-ng.vercel.app/api/cron',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'sow_cron_secret'), 'Content-Type', 'application/json'),
    body := '{}'::jsonb, timeout_milliseconds := 55000)
$$);

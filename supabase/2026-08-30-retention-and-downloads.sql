-- BLOSSOM retention, download, and freshness improvements
alter table if exists books add column if not exists download_path text;
alter table if exists journal_posts add column if not exists updated_at timestamptz default now();

create table if not exists newsletter_subscribers (
  id uuid primary key default uuid_generate_v4(),
  email varchar(160) not null unique,
  source varchar(80) not null default 'website',
  subscribed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table newsletter_subscribers enable row level security;

drop policy if exists "Anyone can subscribe with a valid email" on newsletter_subscribers;
create policy "Anyone can subscribe with a valid email"
  on newsletter_subscribers for insert
  to anon, authenticated
  with check (length(email) between 5 and 160 and email = lower(email));

drop policy if exists "Subscribers can update their own email record" on newsletter_subscribers;
create policy "Subscribers can update their own email record"
  on newsletter_subscribers for update
  to anon, authenticated
  using (email = lower(email))
  with check (length(email) between 5 and 160 and email = lower(email));

-- Public clients never need to read the subscriber list.
drop policy if exists "Subscribers cannot be publicly read" on newsletter_subscribers;

alter table if exists books add column if not exists download_count bigint not null default 0;
alter table if exists books add column if not exists download_counter_started_at date not null default date '2026-08-29';

create or replace function increment_book_download(p_book_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count bigint;
begin
  update books
  set download_count = coalesce(download_count, 0) + 1
  where id = p_book_id
  returning download_count into next_count;

  if next_count is null then
    raise exception 'Book not found';
  end if;

  return next_count;
end;
$$;

revoke all on function increment_book_download(uuid) from public;
grant execute on function increment_book_download(uuid) to anon, authenticated;

-- BLOSSOM newsletter automation (2026-10-05)
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste all -> Run.
-- Safe to run more than once.

-- 1. Log of what has been announced, so nothing is ever emailed twice.
CREATE TABLE IF NOT EXISTS newsletter_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL CHECK (content_type IN ('journal', 'book')),
  content_id UUID NOT NULL,
  content_slug TEXT,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'sending',   -- sending | sent | partial | failed | baseline
  attempts INT NOT NULL DEFAULT 0,
  recipients INT NOT NULL DEFAULT 0,
  sent_count INT NOT NULL DEFAULT 0,
  provider TEXT,
  error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (content_type, content_id)
);

-- Only the server (service role) touches this table.
ALTER TABLE newsletter_dispatches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON newsletter_dispatches FROM anon, authenticated;

-- 2. Baseline: mark everything that is ALREADY on the site as announced,
--    so turning automation on does not email subscribers about old posts.
INSERT INTO newsletter_dispatches (content_type, content_id, content_slug, title, status)
SELECT 'journal', id, slug, title, 'baseline' FROM journal_posts
ON CONFLICT (content_type, content_id) DO NOTHING;

INSERT INTO newsletter_dispatches (content_type, content_id, content_slug, title, status)
SELECT 'book', id, slug, title, 'baseline' FROM books
ON CONFLICT (content_type, content_id) DO NOTHING;

-- 3. Security: anonymous visitors could UPDATE any subscriber row
--    ("Anyone can update their subscription status" USING (true)), e.g. unsubscribe
--    everyone. The website only writes subscribers through the server, so remove it.
DROP POLICY IF EXISTS "Anyone can update their subscription status" ON newsletter_subscribers;
DROP POLICY IF EXISTS "Subscribers can update their own email record" ON newsletter_subscribers;
REVOKE UPDATE, DELETE, SELECT ON newsletter_subscribers FROM anon, authenticated;
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- 4. (Optional, instant sending) Call the website the moment a post or book is
--    published. Replace the two placeholders, then run this block.
--    Without it, the daily Vercel cron (07:00 UTC = 8am Lagos) still sends.
--
-- CREATE EXTENSION IF NOT EXISTS pg_net;
--
-- CREATE OR REPLACE FUNCTION public.blossom_newsletter_ping()
-- RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
-- BEGIN
--   PERFORM net.http_post(
--     url := 'https://olaoluwamichael.vercel.app/api/newsletter/dispatch',
--     headers := jsonb_build_object('Content-Type', 'application/json',
--                                   'x-newsletter-secret', 'PASTE_YOUR_NEWSLETTER_SECRET_HERE'),
--     body := '{}'::jsonb
--   );
--   RETURN NEW;
-- END $$;
--
-- DROP TRIGGER IF EXISTS blossom_newsletter_journal ON journal_posts;
-- CREATE TRIGGER blossom_newsletter_journal
--   AFTER INSERT OR UPDATE OF published, status ON journal_posts
--   FOR EACH ROW EXECUTE FUNCTION public.blossom_newsletter_ping();
--
-- DROP TRIGGER IF EXISTS blossom_newsletter_books ON books;
-- CREATE TRIGGER blossom_newsletter_books
--   AFTER INSERT ON books
--   FOR EACH ROW EXECUTE FUNCTION public.blossom_newsletter_ping();

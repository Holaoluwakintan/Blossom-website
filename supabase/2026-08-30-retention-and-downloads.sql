-- BLOSSOM retention and download ecosystem
-- Run once in Supabase SQL Editor. Safe to re-run.
-- Counter baseline: August 31, 2026

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE IF EXISTS books
  ADD COLUMN IF NOT EXISTS download_path TEXT,
  ADD COLUMN IF NOT EXISTS download_count BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS download_counter_started_at DATE NOT NULL DEFAULT DATE '2026-08-31';

ALTER TABLE IF EXISTS journal_posts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Existing zeroed counters are initialized from the requested launch date.
-- Non-zero counters are preserved so this migration cannot erase real activity.
UPDATE books
SET download_count = COALESCE(download_count, 0),
    download_counter_started_at = DATE '2026-08-31'
WHERE COALESCE(download_count, 0) = 0
  AND (download_counter_started_at IS NULL OR download_counter_started_at <> DATE '2026-08-31');

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(254) NOT NULL UNIQUE,
  full_name VARCHAR(120),
  source VARCHAR(80) NOT NULL DEFAULT 'website',
  marketing_consent BOOLEAN NOT NULL DEFAULT true,
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_download_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE newsletter_subscribers
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(120),
  ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_download_at TIMESTAMPTZ;

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can subscribe with a valid email" ON newsletter_subscribers;
CREATE POLICY "Anyone can subscribe with a valid email"
  ON newsletter_subscribers FOR INSERT
  TO anon, authenticated
  WITH CHECK (length(email) BETWEEN 5 AND 254 AND email = lower(email));

-- The public newsletter endpoint may update only the submitted normalized email.
DROP POLICY IF EXISTS "Subscribers can update their own email record" ON newsletter_subscribers;
CREATE POLICY "Subscribers can update their own email record"
  ON newsletter_subscribers FOR UPDATE
  TO anon, authenticated
  USING (email = lower(email))
  WITH CHECK (length(email) BETWEEN 5 AND 254 AND email = lower(email));

-- Public clients never need to read the subscriber list.
REVOKE SELECT ON newsletter_subscribers FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS book_downloads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  email VARCHAR(254) NOT NULL,
  full_name VARCHAR(120),
  marketing_consent BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE book_downloads
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(120),
  ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE book_downloads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON book_downloads FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS book_downloads_book_id_idx ON book_downloads(book_id);
CREATE INDEX IF NOT EXISTS book_downloads_email_idx ON book_downloads(email);

-- One server-side transaction: save/update the audience record, record the
-- selected book, and increment that book's counter atomically.
CREATE OR REPLACE FUNCTION track_book_download(
  p_book_id UUID,
  p_email VARCHAR,
  p_full_name VARCHAR DEFAULT NULL,
  p_marketing_opt_in BOOLEAN DEFAULT true
)
RETURNS TABLE(download_count BIGINT, download_counter_started_at DATE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_email VARCHAR(254);
  normalized_name VARCHAR(120);
  next_count BIGINT;
  counter_date DATE;
BEGIN
  normalized_email := lower(trim(p_email));
  normalized_name := NULLIF(trim(COALESCE(p_full_name, '')), '');

  IF normalized_email IS NULL
     OR normalized_email = ''
     OR length(normalized_email) > 254
     OR normalized_email !~ '^\S+@\S+\.\S+$' THEN
    RAISE EXCEPTION 'A valid email address is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM books WHERE id = p_book_id) THEN
    RAISE EXCEPTION 'Book not found';
  END IF;

  INSERT INTO newsletter_subscribers (
    email, full_name, source, marketing_consent, subscribed_at, last_download_at, updated_at
  )
  VALUES (
    normalized_email,
    normalized_name,
    'book-download',
    COALESCE(p_marketing_opt_in, true),
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (email) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, newsletter_subscribers.full_name),
    source = CASE
      WHEN newsletter_subscribers.source = 'website' THEN 'website,book-download'
      ELSE newsletter_subscribers.source
    END,
    marketing_consent = newsletter_subscribers.marketing_consent OR EXCLUDED.marketing_consent,
    last_download_at = NOW(),
    updated_at = NOW();

  INSERT INTO book_downloads (book_id, email, full_name, marketing_consent)
  VALUES (p_book_id, normalized_email, normalized_name, COALESCE(p_marketing_opt_in, true));

  UPDATE books
  SET download_count = COALESCE(download_count, 0) + 1,
      download_counter_started_at = COALESCE(download_counter_started_at, DATE '2026-08-31')
  WHERE id = p_book_id
  RETURNING books.download_count, books.download_counter_started_at
  INTO next_count, counter_date;

  RETURN QUERY SELECT next_count, counter_date;
END;
$$;

REVOKE ALL ON FUNCTION track_book_download(UUID, VARCHAR, VARCHAR, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION track_book_download(UUID, VARCHAR, VARCHAR, BOOLEAN) TO service_role;

-- Keep the legacy counter function for compatibility with older server code,
-- but do not expose it to public browser roles.
CREATE OR REPLACE FUNCTION increment_book_download(p_book_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE next_count BIGINT;
BEGIN
  UPDATE books
  SET download_count = COALESCE(download_count, 0) + 1,
      download_counter_started_at = COALESCE(download_counter_started_at, DATE '2026-08-31')
  WHERE id = p_book_id
  RETURNING download_count INTO next_count;
  IF next_count IS NULL THEN RAISE EXCEPTION 'Book not found'; END IF;
  RETURN next_count;
END;
$$;

REVOKE ALL ON FUNCTION increment_book_download(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_book_download(UUID) TO service_role;

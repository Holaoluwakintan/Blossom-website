-- Run this once in Supabase Dashboard -> SQL Editor.
-- These are the starting totals requested for the public book counters.

ALTER TABLE books
  ADD COLUMN IF NOT EXISTS download_count BIGINT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION increment_book_download(p_book_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE next_count BIGINT;
BEGIN
  UPDATE books
  SET download_count = COALESCE(download_count, 0) + 1
  WHERE id = p_book_id
  RETURNING download_count INTO next_count;

  IF next_count IS NULL THEN RAISE EXCEPTION 'Book not found'; END IF;
  RETURN next_count;
END;
$$;

REVOKE ALL ON FUNCTION increment_book_download(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_book_download(UUID) TO anon, authenticated, service_role;

UPDATE books SET download_count = 301 WHERE lower(slug) = 'twisted';
UPDATE books SET download_count = 103 WHERE lower(slug) = 'golgotha';
UPDATE books SET download_count = 329 WHERE lower(slug) = 'balm-of-gilead';
UPDATE books SET download_count = 24 WHERE lower(slug) = 'crack-the-algorithm';

SELECT slug, title, download_count
FROM books
WHERE lower(slug) IN ('twisted', 'golgotha', 'balm-of-gilead', 'crack-the-algorithm')
ORDER BY title;

-- BLOSSOM: Books by Other Authors
-- Run once in Supabase SQL Editor. Safe to re-run.
-- Set collection = 'other-authors' on any book that should appear in the
-- dedicated Books by Other Authors section. Existing books remain in the
-- primary BLOSSOM collection.

ALTER TABLE books
  ADD COLUMN IF NOT EXISTS collection VARCHAR(40) NOT NULL DEFAULT 'blossom',
  ADD COLUMN IF NOT EXISTS access_type VARCHAR(30) NOT NULL DEFAULT 'free-download',
  ADD COLUMN IF NOT EXISTS purchase_url TEXT;

UPDATE books
SET collection = 'blossom'
WHERE collection IS NULL OR trim(collection) = '';

CREATE INDEX IF NOT EXISTS books_collection_created_at_idx
  ON books(collection, created_at DESC);

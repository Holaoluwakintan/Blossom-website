-- BLOSSOM article engagement counters
-- Run once in Supabase Dashboard -> SQL Editor. Safe to re-run.

ALTER TABLE journal_posts
  ADD COLUMN IF NOT EXISTS view_count BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS click_count BIGINT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION track_article_view(p_article_id UUID, p_viewer_hash VARCHAR)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_new_views BIGINT;
BEGIN
  INSERT INTO article_views (article_id, viewer_hash, viewed_at)
  VALUES (p_article_id, left(p_viewer_hash, 64), NOW())
  ON CONFLICT (article_id, viewer_hash) DO NOTHING;

  IF FOUND THEN
    UPDATE journal_posts
    SET view_count = COALESCE(view_count, 0) + 1
    WHERE id = p_article_id AND published = true
    RETURNING view_count INTO v_new_views;
  ELSE
    SELECT view_count INTO v_new_views FROM journal_posts WHERE id = p_article_id;
  END IF;
  RETURN COALESCE(v_new_views, 0);
END;
$$;

CREATE OR REPLACE FUNCTION increment_article_click(p_article_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE next_count BIGINT;
BEGIN
  UPDATE journal_posts
  SET click_count = COALESCE(click_count, 0) + 1
  WHERE id = p_article_id AND published = true
  RETURNING click_count INTO next_count;
  IF next_count IS NULL THEN RAISE EXCEPTION 'Article not found'; END IF;
  RETURN next_count;
END;
$$;

GRANT EXECUTE ON FUNCTION track_article_view(UUID, VARCHAR) TO anon, authenticated;
REVOKE ALL ON FUNCTION increment_article_click(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_article_click(UUID) TO anon, authenticated;

-- Existing view_count values are preserved. New rows default to zero.
SELECT slug, title, view_count, click_count
FROM journal_posts
WHERE published = true
ORDER BY published_at DESC NULLS LAST, created_at DESC;

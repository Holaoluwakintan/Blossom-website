CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(120) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE books (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    subtitle VARCHAR(255),
    slug VARCHAR(255) NOT NULL UNIQUE,
    author VARCHAR(150) NOT NULL DEFAULT 'Olaoluwa Michael',
    cover_image_url TEXT NOT NULL,
    synopsis TEXT NOT NULL,
    description TEXT NOT NULL,
    genre VARCHAR(100) NOT NULL,
    publication_year INT NOT NULL,
    price_ngn NUMERIC(10, 2),
    format VARCHAR(100) DEFAULT 'Paperback & Digital E-Book',
    featured BOOLEAN DEFAULT false,
    availability_status VARCHAR(50) DEFAULT 'Available',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE journal_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    featured_image_url TEXT NOT NULL,
    excerpt TEXT NOT NULL,
    content_markdown TEXT NOT NULL,
    author VARCHAR(150) DEFAULT 'Olaoluwa Michael',
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    published BOOLEAN DEFAULT true,
    published_at TIMESTAMPTZ DEFAULT NOW(),
    reading_time_minutes INT DEFAULT 5,
    view_count BIGINT DEFAULT 0,
    comments_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE artworks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    image_url TEXT NOT NULL,
    caption VARCHAR(255),
    story TEXT NOT NULL,
    moral_quote TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    alt_text TEXT NOT NULL,
    featured BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID NOT NULL REFERENCES journal_posts(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    author_name VARCHAR(120) NOT NULL,
    author_email VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE article_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID NOT NULL REFERENCES journal_posts(id) ON DELETE CASCADE,
    viewer_hash VARCHAR(64) NOT NULL,
    viewed_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_daily_view_per_user UNIQUE(article_id, viewer_hash)
);

CREATE OR REPLACE FUNCTION track_article_view(p_article_id UUID, p_viewer_hash VARCHAR)
RETURNS BIGINT AS $$
DECLARE
    v_new_views BIGINT;
BEGIN
    INSERT INTO article_views (article_id, viewer_hash, viewed_at)
    VALUES (p_article_id, p_viewer_hash, NOW())
    ON CONFLICT (article_id, viewer_hash) DO NOTHING;

    IF FOUND THEN
        UPDATE journal_posts
        SET view_count = view_count + 1
        WHERE id = p_article_id
        RETURNING view_count INTO v_new_views;
        RETURN v_new_views;
    ELSE
        SELECT view_count INTO v_new_views FROM journal_posts WHERE id = p_article_id;
        RETURN v_new_views;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE books ADD COLUMN IF NOT EXISTS download_path TEXT;
ALTER TABLE journal_posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

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

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can subscribe with a valid email" ON newsletter_subscribers;
CREATE POLICY "Anyone can subscribe with a valid email"
  ON newsletter_subscribers FOR INSERT TO anon, authenticated
  WITH CHECK (length(email) BETWEEN 5 AND 254 AND email = lower(email));

ALTER TABLE books ADD COLUMN IF NOT EXISTS download_count BIGINT NOT NULL DEFAULT 0;
ALTER TABLE books ADD COLUMN IF NOT EXISTS download_counter_started_at DATE NOT NULL DEFAULT DATE '2026-08-31';

CREATE OR REPLACE FUNCTION increment_book_download(p_book_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE next_count BIGINT;
BEGIN
  UPDATE books SET download_count = COALESCE(download_count, 0) + 1
  WHERE id = p_book_id
  RETURNING download_count INTO next_count;
  IF next_count IS NULL THEN RAISE EXCEPTION 'Book not found'; END IF;
  RETURN next_count;
END;
$$;

REVOKE ALL ON FUNCTION increment_book_download(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_book_download(UUID) TO service_role;


CREATE TABLE IF NOT EXISTS book_downloads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    email VARCHAR(254) NOT NULL,
    full_name VARCHAR(120),
    marketing_consent BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE book_downloads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON book_downloads FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS book_downloads_book_id_idx ON book_downloads(book_id);
CREATE INDEX IF NOT EXISTS book_downloads_email_idx ON book_downloads(email);

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

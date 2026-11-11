-- 063_landing_news.sql
-- Berita pesantren untuk portal landing (beranda + /berita + /berita/{slug}).
-- Idempotent — aman dijalankan ulang.

CREATE TABLE IF NOT EXISTS landing_news (
    id           SERIAL PRIMARY KEY,
    slug         TEXT NOT NULL UNIQUE,
    judul        TEXT NOT NULL,
    kategori     TEXT NOT NULL DEFAULT 'kegiatan',  -- pengumuman | kegiatan | prestasi | artikel
    ringkasan    TEXT NOT NULL DEFAULT '',
    konten_html  TEXT NOT NULL DEFAULT '',
    cover_url    TEXT NOT NULL DEFAULT '',
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    is_headline  BOOLEAN NOT NULL DEFAULT FALSE,    -- tampil sebagai berita utama di beranda
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_landing_news_pub
    ON landing_news (is_published, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_landing_news_kat
    ON landing_news (kategori);

-- Hanya satu berita utama pada satu waktu: saat satu di-pin, lepas yang lain.
CREATE OR REPLACE FUNCTION landing_news_single_headline() RETURNS trigger AS $$
BEGIN
    IF NEW.is_headline THEN
        UPDATE landing_news SET is_headline = FALSE
         WHERE id <> NEW.id AND is_headline;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_landing_news_headline ON landing_news;
CREATE TRIGGER trg_landing_news_headline
    AFTER INSERT OR UPDATE OF is_headline ON landing_news
    FOR EACH ROW EXECUTE FUNCTION landing_news_single_headline();

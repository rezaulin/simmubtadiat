-- 061_landing_cms.sql
-- CMS mini landing page: section (halaman) + settings (konfigurasi situs).
-- Idempotent — aman dijalankan ulang.

CREATE TABLE IF NOT EXISTS landing_settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL DEFAULT '',
    label       TEXT NOT NULL DEFAULT '',
    grup        TEXT NOT NULL DEFAULT 'umum',   -- umum | kontak | sosial | seo
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by  INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS landing_sections (
    id               SERIAL PRIMARY KEY,
    slug             TEXT NOT NULL UNIQUE,
    subdomain        TEXT UNIQUE,                -- NULL = hanya bisa diakses via /p/<slug>
    judul            TEXT NOT NULL,
    konten_html      TEXT NOT NULL DEFAULT '',
    meta_title       TEXT NOT NULL DEFAULT '',
    meta_description TEXT NOT NULL DEFAULT '',
    og_image         TEXT NOT NULL DEFAULT '',
    urutan           INTEGER NOT NULL DEFAULT 0,
    tampil_di_menu   BOOLEAN NOT NULL DEFAULT true,
    is_published     BOOLEAN NOT NULL DEFAULT false,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_by       INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_landing_sections_menu
    ON landing_sections (urutan)
    WHERE is_published AND tampil_di_menu;

-- Seeder: paket section standar pesantren.
INSERT INTO landing_sections (slug, subdomain, judul, urutan, is_published) VALUES
    ('sejarah',     'sejarah',     'Profil & Sejarah',      1, true),
    ('pengasuh',    'pengasuh',    'Visi, Misi & Masayikh', 2, true),
    ('pendidikan',  'pendidikan',  'Kurikulum & Jenjang',   3, true),
    ('fasilitas',   'fasilitas',   'Fasilitas & Kegiatan',  4, true),
    ('prestasi',    'prestasi',    'Prestasi & Alumni',     5, true),
    ('pendaftaran', 'pendaftaran', 'Informasi Pendaftaran', 6, true)
ON CONFLICT (slug) DO NOTHING;

-- Seeder: settings situs. Kontak & peta menempel di footer semua halaman.
INSERT INTO landing_settings (key, value, label, grup) VALUES
    ('site_name',        'Pesantren Mubtadiat Lirboyo', 'Nama Pesantren',          'umum'),
    ('site_tagline',     '',                           'Tagline',                 'umum'),
    ('logo_url',         '',                           'URL Logo',                'umum'),
    ('footer_alamat',    '',                           'Alamat (footer)',         'kontak'),
    ('footer_telepon',   '',                           'Telepon/WA (footer)',     'kontak'),
    ('footer_email',     '',                           'Email (footer)',          'kontak'),
    ('footer_jam',       '',                           'Jam Operasional',         'kontak'),
    ('maps_embed',       '',                           'Embed Google Maps',       'kontak'),
    ('sosmed_instagram', '',                           'Instagram',               'sosial'),
    ('sosmed_youtube',   '',                           'YouTube',                 'sosial'),
    ('sosmed_facebook',  '',                           'Facebook',                'sosial'),
    ('seo_title',        '',                           'SEO Title Default',       'seo'),
    ('seo_description',  '',                           'SEO Description Default', 'seo')
ON CONFLICT (key) DO NOTHING;

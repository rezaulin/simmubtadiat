-- 062_landing_apk.sql
-- Kunci pengaturan APK Android untuk portal landing page.
-- Idempotent — aman dijalankan ulang.

INSERT INTO landing_settings (key, value, label, grup) VALUES
    ('apk_url',     '', 'URL Download APK', 'umum'),
    ('apk_version', '', 'Versi APK',        'umum')
ON CONFLICT (key) DO NOTHING;

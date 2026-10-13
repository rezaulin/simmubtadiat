-- 059: Kolom riwayat santri pindah/alumni yang dipakai kode (models/santri.go,
-- models/alumni.go) tapi belum pernah masuk migrasi/baseline — dulu ditambah
-- manual di DB live. Fresh install gagal di /api/santri/, /santri/arsip,
-- /santri/export: "column s.last_bagian_id does not exist".
-- Idempoten (IF NOT EXISTS) supaya DB live yang sudah punya kolom aman.

ALTER TABLE public.santri ADD COLUMN IF NOT EXISTS last_bagian_id INTEGER;
ALTER TABLE public.santri ADD COLUMN IF NOT EXISTS last_tahun_ajaran VARCHAR(50);

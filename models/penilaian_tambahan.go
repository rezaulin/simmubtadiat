package models

// Penilaian Tambahan — data layer untuk tab-tab baru di halaman Penilaian:
//   Tab 2  Di Bawah Rata² (4,4)  → penilaian_takziran (nilai selalu live)
//   Tab 3  Setoran Juz Amma      → setoran_juz_amma
//   Tab 4  Nilai Kompetensi      → nilai_kompetensi
// Tabel lama (nilai_kuartal/khos/am/bayan) TIDAK disentuh.

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/mubtadiaat/app/config"
)

// ─── Tab 2: Nilai Di Bawah Rata² ────────────────────────────────────────────

// BatasRataRata: ambang rata-rata nilai per kuartal (skala 0–10).
const BatasRataRata = 4.4

type BarisBawahRata struct {
	SantriID      int     `json:"santri_id"`
	Nama          string  `json:"nama"`
	BagianID      int     `json:"bagian_id"`
	Bagian        string  `json:"bagian"` // contoh: "3 Tsanawiyah A"
	JumlahNilai   float64 `json:"jumlah_nilai"`
	Rata2         float64 `json:"rata2"`
	Konsekuensi   *string `json:"konsekuensi"`
	JenisTakziran *string `json:"jenis_takziran"`
	DalamMasa     bool    `json:"dalam_masa"`
	Selesai       bool    `json:"selesai"`
	AdaTakziran   bool    `json:"ada_takziran"`
}

// GetBawahRata menghitung rata-rata nilai kuartal per santri (KECUALI kategori
// akhlaq) dan mengembalikan yang di bawah 4,4, di-LEFT-JOIN dengan status
// takziran yang pernah diisi pimpinan. baris takziran TIDAK dihapus otomatis
// walau rata² sudah naik — filter opsional menyaring tampilan, bukan data.
func GetBawahRata(ctx context.Context, tahunAjaran string, kuartal int, dalamMasa, selesai *bool, bagianIDs []int) ([]BarisBawahRata, error) {
	args := []any{tahunAjaran, kuartal, bagianIDs}
	q := `
		SELECT s.id,
		       s.nama,
		       COALESCE(b.id, 0),
		       TRIM(COALESCE(k.nama,'') || ' ' || COALESCE(t.nama,'') || ' ' || COALESCE(b.nama_bagian,'')),
		       COALESCE(SUM(nk.nilai), 0)::float8,
		       COALESCE(AVG(nk.nilai), 0)::float8,
		       pt.konsekuensi,
		       pt.jenis_takziran,
		       COALESCE(pt.dalam_masa, false),
		       COALESCE(pt.selesai, false),
		       (pt.id IS NOT NULL)
		FROM nilai_kuartal nk
		JOIN santri s        ON s.id = nk.santri_id
		JOIN mata_pelajaran mp ON mp.id = nk.mapel_id
		LEFT JOIN bagian b   ON b.id = s.bagian_id
		LEFT JOIN kelas k    ON k.id = b.kelas_id
		LEFT JOIN tingkatan t ON t.id = b.tingkatan_id
		LEFT JOIN penilaian_takziran pt
		       ON pt.santri_id = s.id AND pt.kuartal = nk.kuartal
		      AND pt.tahun_ajaran = nk.tahun_ajaran
		WHERE nk.tahun_ajaran = $1
		  AND nk.kuartal = $2
		  AND nk.nilai IS NOT NULL
		  AND mp.kategori NOT IN ('akhlaq', 'akhlaq_perilaku')
		  AND s.status = 'aktif'
		  AND s.bagian_id = ANY($3)`
	if dalamMasa != nil {
		args = append(args, *dalamMasa)
		q += fmt.Sprintf(" AND COALESCE(pt.dalam_masa, false) = $%d", len(args))
	}
	if selesai != nil {
		args = append(args, *selesai)
		q += fmt.Sprintf(" AND COALESCE(pt.selesai, false) = $%d", len(args))
	}
	q += `
		GROUP BY s.id, s.nama, b.id, b.nama_bagian, k.nama, t.nama,
		         pt.id, pt.konsekuensi, pt.jenis_takziran, pt.dalam_masa, pt.selesai
		HAVING AVG(nk.nilai) < $4
		ORDER BY AVG(nk.nilai) ASC, s.nama ASC`
	// ambang sebagai argumen (di-cast float8 supaya numerik)
	args = append(args, BatasRataRata)
	// HAVING pakai $4 → pastikan urutan argumen: ta, kuartal, bagianIDs, [opsional…], batas
	// Bangun ulang dengan placeholder batas yang benar:
	if dalamMasa != nil || selesai != nil {
		q = strings.Replace(q, "HAVING AVG(nk.nilai) < $4",
			fmt.Sprintf("HAVING AVG(nk.nilai) < $%d", len(args)), 1)
	} else {
		q = strings.Replace(q, "HAVING AVG(nk.nilai) < $4", "HAVING AVG(nk.nilai) < $4", 1)
	}

	rows, err := config.DB.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []BarisBawahRata{}
	for rows.Next() {
		var b BarisBawahRata
		if err := rows.Scan(&b.SantriID, &b.Nama, &b.BagianID, &b.Bagian,
			&b.JumlahNilai, &b.Rata2,
			&b.Konsekuensi, &b.JenisTakziran,
			&b.DalamMasa, &b.Selesai, &b.AdaTakziran); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

type TakziranInput struct {
	SantriID      int    `json:"santri_id"`
	Kuartal       int    `json:"kuartal"`
	Konsekuensi   string `json:"konsekuensi"`
	JenisTakziran string `json:"jenis_takziran"`
	DalamMasa     bool   `json:"dalam_masa"`
	Selesai       bool   `json:"selesai"`
}

// UpsertTakziran menyimpan status takziran per santri+kuartal+TA (teks bebas).
func UpsertTakziran(ctx context.Context, tahunAjaran string, items []TakziranInput) error {
	for _, it := range items {
		if it.SantriID <= 0 || it.Kuartal < 1 || it.Kuartal > 4 {
			return errors.New("data takziran tidak valid")
		}
		_, err := config.DB.Exec(ctx, `
			INSERT INTO penilaian_takziran
			  (santri_id, kuartal, tahun_ajaran, konsekuensi, jenis_takziran, dalam_masa, selesai)
			VALUES ($1, $2, $3, NULLIF($4,''), NULLIF($5,''), $6, $7)
			ON CONFLICT (santri_id, kuartal, tahun_ajaran)
			DO UPDATE SET konsekuensi   = EXCLUDED.konsekuensi,
			              jenis_takziran = EXCLUDED.jenis_takziran,
			              dalam_masa     = EXCLUDED.dalam_masa,
			              selesai        = EXCLUDED.selesai,
			              updated_at     = now()`,
			it.SantriID, it.Kuartal, tahunAjaran,
			it.Konsekuensi, it.JenisTakziran, it.DalamMasa, it.Selesai)
		if err != nil {
			return err
		}
	}
	return nil
}

// ─── Tab 3: Setoran Juz Amma ────────────────────────────────────────────────

// ErrJuzTidakBerlaku dipakai bila kelas tidak punya rentang Juz Amma
// (I'dadiyah atau kelas tak dikenal — keputusan owner: I'dadiyah TIDAK ikut).
var ErrJuzTidakBerlaku = errors.New("kelas ini tidak memiliki setoran Juz Amma")

// SuratTargetJuz mengembalikan surat_no terendah (rentang dari An-Nas/114
// ke bawah) untuk kombinasi tingkatan+kelas. Daftar sesuai spesifikasi owner.
func SuratTargetJuz(tingkatan, kelas string) (int, bool) {
	t := strings.ToLower(strings.TrimSpace(tingkatan))
	k := strings.TrimSpace(kelas)
	switch t {
	case "ibtidaiyah":
		switch k {
		case "4":
			return 108, true // Al-Kautsar
		case "5":
			return 104, true // al-Humazah
		case "6":
			return 99, true // az-Zalzalah
		}
	case "tsanawiyah":
		switch k {
		case "1":
			return 97, true // al-Qadr
		case "2":
			return 93, true // ad-Duha
		case "3":
			return 87, true // al-A'la
		}
	case "aliyah":
		switch k {
		case "1":
			return 83, true // al-Muthaffifin
		case "2":
			return 80, true // 'Abasa
		case "3":
			return 78, true // an-Naba'
		}
	}
	return 0, false
}

type SuratSetor struct {
	No   int  `json:"no"`
	Setor bool `json:"setor"`
}

type BarisJuzAmma struct {
	SantriID    int          `json:"santri_id"`
	Nama        string       `json:"nama"`
	BagianID    int          `json:"bagian_id"`
	Bagian      string       `json:"bagian"` // "6 Ibtidaiyah A"
	SuratDari   int          `json:"surat_dari"`   // selalu 114 (An-Nas)
	SuratSampai int          `json:"surat_sampai"` // batas kelas
	JumlahSurat int          `json:"jumlah_surat"`
	Surat       []SuratSetor `json:"surat"`
	Evaluasi    string       `json:"evaluasi"` // "" | lulus | her | tidak_lulus
	Status      string       `json:"status"`   // selesai | belum
}

// GetJuzAmma: daftar siswi kelas yang punya rentang setoran + ceklis per surat.
func GetJuzAmma(ctx context.Context, tahunAjaran string, bagianID *int, status, evaluasi string, bagianIDs []int) ([]BarisJuzAmma, error) {
	args := []any{bagianIDs}
	q := `
		SELECT s.id, s.nama, b.id,
		       TRIM(k.nama || ' ' || t.nama || ' ' || b.nama_bagian),
		       t.nama, k.nama
		FROM santri s
		JOIN bagian b   ON b.id = s.bagian_id
		JOIN kelas k    ON k.id = b.kelas_id
		LEFT JOIN tingkatan t ON t.id = b.tingkatan_id
		WHERE s.status = 'aktif' AND b.id = ANY($1)`
	if bagianID != nil {
		args = append(args, *bagianID)
		q += fmt.Sprintf(" AND b.id = $%d", len(args))
	}
	q += ` ORDER BY t.urutan DESC, k.nama ASC, b.nama_bagian ASC, s.nama ASC`

	rows, err := config.DB.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type kandidat struct {
		id int; nama string; bagianID int; bagian string; tingkatan string; kelas string
	}
	var kands []kandidat
	for rows.Next() {
		var c kandidat
		var tingkatan *string
		if err := rows.Scan(&c.id, &c.nama, &c.bagianID, &c.bagian, &tingkatan, &c.kelas); err != nil {
			return nil, err
		}
		if tingkatan != nil {
			c.tingkatan = *tingkatan
		}
		// I'dadiyah (dan kelas tanpa rentang) tidak ikut — keputusan owner.
		if _, ok := SuratTargetJuz(c.tingkatan, c.kelas); !ok {
			continue
		}
		kands = append(kands, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(kands) == 0 {
		return []BarisJuzAmma{}, nil
	}

	ids := make([]int, 0, len(kands))
	for _, c := range kands {
		ids = append(ids, c.id)
	}
	srows, err := config.DB.Query(ctx, `
		SELECT santri_id, surat_no, setor, evaluasi, status
		FROM setoran_juz_amma
		WHERE tahun_ajaran = $1 AND santri_id = ANY($2)`, tahunAjaran, ids)
	if err != nil {
		return nil, err
	}
	defer srows.Close()

	type state struct {
		setor    map[int]bool
		evaluasi string
		status   string
	}
	states := map[int]*state{}
	for srows.Next() {
		var sid, no int
		var setor bool
		var evaluasi, status string
		if err := srows.Scan(&sid, &no, &setor, &evaluasi, &status); err != nil {
			return nil, err
		}
		st := states[sid]
		if st == nil {
			st = &state{setor: map[int]bool{}, status: "belum"}
			states[sid] = st
		}
		st.setor[no] = setor
		if st.evaluasi == "" && evaluasi != "" {
			st.evaluasi = evaluasi
		}
		if status == "selesai" {
			st.status = "selesai"
		}
	}
	if err := srows.Err(); err != nil {
		return nil, err
	}

	out := []BarisJuzAmma{}
	for _, c := range kands {
		target, _ := SuratTargetJuz(c.tingkatan, c.kelas)
		st := states[c.id]
		if st == nil {
			st = &state{setor: map[int]bool{}, status: "belum"}
		}
		b := BarisJuzAmma{
			SantriID: c.id, Nama: c.nama, BagianID: c.bagianID, Bagian: c.bagian,
			SuratDari: 114, SuratSampai: target, JumlahSurat: 114 - target + 1,
			Surat: []SuratSetor{}, Evaluasi: st.evaluasi, Status: st.status,
		}
		for no := 114; no >= target; no-- {
			b.Surat = append(b.Surat, SuratSetor{No: no, Setor: st.setor[no]})
		}
		if status != "" && b.Status != status {
			continue
		}
		if evaluasi != "" && b.Evaluasi != evaluasi {
			continue
		}
		out = append(out, b)
	}
	return out, nil
}

type JuzAmmaInput struct {
	TahunAjaran string `json:"tahun_ajaran"`
	SantriID    int    `json:"santri_id"`
	SuratNo     *int   `json:"surat_no"`
	Setor       *bool  `json:"setor"`
	Evaluasi    *string `json:"evaluasi"`
	Status      *string `json:"status"`
}

// SaveJuzAmma: toggle ceklis per surat dan/atau set evaluasi+status per santri.
// Baris surat dibuat lengkap (114..target) saat pertama kali disentuh.
func SaveJuzAmma(ctx context.Context, in JuzAmmaInput) error {
	if in.SantriID <= 0 {
		return errors.New("santri tidak valid")
	}
	if in.SuratNo != nil && in.Setor != nil {
		if *in.SuratNo < 78 || *in.SuratNo > 114 {
			return errors.New("nomor surat di luar Juz Amma")
		}
		_, err := config.DB.Exec(ctx, `
			INSERT INTO setoran_juz_amma (santri_id, surat_no, setor, evaluasi, status, tahun_ajaran)
			VALUES ($1, $2, $3,
			        CASE WHEN $4::text = '' THEN NULL ELSE $4::text END,
			        COALESCE(NULLIF($5::text,''), 'belum'),
			        $6)
			ON CONFLICT (santri_id, surat_no, tahun_ajaran)
			DO UPDATE SET setor = EXCLUDED.setor,
			              evaluasi = COALESCE(EXCLUDED.evaluasi, setoran_juz_amma.evaluasi),
			              updated_at = now()`,
			in.SantriID, *in.SuratNo, *in.Setor,
			deref(in.Evaluasi), deref(in.Status), in.TahunAjaran)
		return err
	}
	if in.Evaluasi == nil && in.Status == nil {
		return errors.New("tidak ada data yang diubah")
	}
	// evaluasi/status bersifat per santri → pastikan semua baris surat ada.
	if _, err := ensureSetoranRows(ctx, in.SantriID, in.TahunAjaran); err != nil {
		return err
	}
	_, err := config.DB.Exec(ctx, `
		UPDATE setoran_juz_amma
		   SET evaluasi = CASE WHEN $3::text = '' THEN evaluasi ELSE $3::text END,
		       status   = CASE WHEN $4::text = '' THEN status   ELSE $4::text END,
		       updated_at = now()
		 WHERE santri_id = $1 AND tahun_ajaran = $2`,
		in.SantriID, in.TahunAjaran, deref(in.Evaluasi), deref(in.Status))
	return err
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// ensureSetoranRows membuat baris surat 114..target untuk santri (idempoten).
func ensureSetoranRows(ctx context.Context, santriID int, tahunAjaran string) (int, error) {
	var tingkatan *string
	var kelas string
	err := config.DB.QueryRow(ctx, `
		SELECT t.nama, k.nama
		FROM santri s
		JOIN bagian b ON b.id = s.bagian_id
		JOIN kelas k  ON k.id = b.kelas_id
		LEFT JOIN tingkatan t ON t.id = b.tingkatan_id
		WHERE s.id = $1`, santriID).Scan(&tingkatan, &kelas)
	if err != nil {
		return 0, err
	}
	tn := ""
	if tingkatan != nil {
		tn = *tingkatan
	}
	target, ok := SuratTargetJuz(tn, kelas)
	if !ok {
		return 0, ErrJuzTidakBerlaku
	}
	_, err = config.DB.Exec(ctx, fmt.Sprintf(`
		INSERT INTO setoran_juz_amma (santri_id, surat_no, tahun_ajaran)
		SELECT $1, g, $3 FROM generate_series(114, %d) AS g
		ON CONFLICT (santri_id, surat_no, tahun_ajaran) DO NOTHING`, target),
		santriID, target, tahunAjaran)
	return target, err
}

// ─── Tab 4: Nilai Kompetensi ────────────────────────────────────────────────

// ErrKompetensiTidakBerlaku dipanggil bila kelas/kategori tidak sesuai
// jadwal owner: 3 tsn (ubq+kitab+praktik), 1 aly (praktik), 2 aly (ubq),
// 3 aly (kitab+praktik).
var ErrKompetensiTidakBerlaku = errors.New("kategori ujian tidak berlaku untuk kelas ini")

var kategoriKompetensi = []string{"ubq", "praktik", "kitab"}

// KompetensiEligible: apakah kategori ujian berlaku untuk tingkatan+kelas ini.
func KompetensiEligible(tingkatan, kelas, kategori string) bool {
	t := strings.ToLower(strings.TrimSpace(tingkatan))
	k := strings.TrimSpace(kelas)
	switch kategori {
	case "ubq":
		return (t == "tsanawiyah" && k == "3") || (t == "aliyah" && k == "2")
	case "praktik":
		return (t == "tsanawiyah" && k == "3") || (t == "aliyah" && (k == "1" || k == "3"))
	case "kitab":
		return (t == "tsanawiyah" && k == "3") || (t == "aliyah" && k == "3")
	}
	return false
}

type BarisKompetensi struct {
	SantriID int    `json:"santri_id"`
	Nama     string `json:"nama"`
	BagianID int    `json:"bagian_id"`
	Bagian   string `json:"bagian"`
	Kategori string `json:"kategori"`
	Hasil    string `json:"hasil"` // "" | lulus | her | tidak_lulus
}

// GetKompetensi: daftar siswi kelas berlaku + hasil ujian per kategori.
// kategori "" → semua kategori yang berlaku untuk masing-masing kelas.
func GetKompetensi(ctx context.Context, tahunAjaran, kategori, hasil string, bagianID *int, bagianIDs []int) ([]BarisKompetensi, error) {
	args := []any{bagianIDs}
	q := `
		SELECT s.id, s.nama, b.id,
		       TRIM(k.nama || ' ' || t.nama || ' ' || b.nama_bagian),
		       COALESCE(t.nama, ''), k.nama
		FROM santri s
		JOIN bagian b   ON b.id = s.bagian_id
		JOIN kelas k    ON k.id = b.kelas_id
		LEFT JOIN tingkatan t ON t.id = b.tingkatan_id
		WHERE s.status = 'aktif' AND b.id = ANY($1)`
	if bagianID != nil {
		args = append(args, *bagianID)
		q += fmt.Sprintf(" AND b.id = $%d", len(args))
	}
	q += ` ORDER BY t.urutan DESC, k.nama ASC, b.nama_bagian ASC, s.nama ASC`

	rows, err := config.DB.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type santriRow struct {
		id int; nama string; bagianID int; bagian string; tingkatan string; kelas string
	}
	var sis []santriRow
	for rows.Next() {
		var s santriRow
		if err := rows.Scan(&s.id, &s.nama, &s.bagianID, &s.bagian, &s.tingkatan, &s.kelas); err != nil {
			return nil, err
		}
		sis = append(sis, s)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(sis) == 0 {
		return []BarisKompetensi{}, nil
	}

	ids := make([]int, 0, len(sis))
	for _, s := range sis {
		ids = append(ids, s.id)
	}
	nrows, err := config.DB.Query(ctx, `
		SELECT santri_id, kategori, COALESCE(hasil, '')
		FROM nilai_kompetensi
		WHERE tahun_ajaran = $1 AND santri_id = ANY($2)`, tahunAjaran, ids)
	if err != nil {
		return nil, err
	}
	defer nrows.Close()

	hasilMap := map[int]map[string]string{}
	for nrows.Next() {
		var sid int
		var kat, h string
		if err := nrows.Scan(&sid, &kat, &h); err != nil {
			return nil, err
		}
		if hasilMap[sid] == nil {
			hasilMap[sid] = map[string]string{}
		}
		hasilMap[sid][kat] = h
	}
	if err := nrows.Err(); err != nil {
		return nil, err
	}

	kats := kategoriKompetensi
	if kategori != "" {
		kats = []string{kategori}
	}
	out := []BarisKompetensi{}
	for _, s := range sis {
		for _, kat := range kats {
			if !KompetensiEligible(s.tingkatan, s.kelas, kat) {
				continue
			}
			h := ""
			if m := hasilMap[s.id]; m != nil {
				h = m[kat]
			}
			if hasil != "" && h != hasil {
				continue
			}
			out = append(out, BarisKompetensi{
				SantriID: s.id, Nama: s.nama, BagianID: s.bagianID, Bagian: s.bagian,
				Kategori: kat, Hasil: h,
			})
		}
	}
	return out, nil
}

type KompetensiInput struct {
	TahunAjaran string `json:"tahun_ajaran"`
	SantriID    int    `json:"santri_id"`
	Kategori    string `json:"kategori"`
	Hasil       string `json:"hasil"`
}

// SaveKompetensi: upsert hasil ujian kompetensi (validasi kelas di handler
// lewat KompetensiEligible + data santri).
func SaveKompetensi(ctx context.Context, in KompetensiInput) error {
	if in.SantriID <= 0 {
		return errors.New("santri tidak valid")
	}
	var tingkatan *string
	var kelas string
	err := config.DB.QueryRow(ctx, `
		SELECT t.nama, k.nama
		FROM santri s
		JOIN bagian b ON b.id = s.bagian_id
		JOIN kelas k  ON k.id = b.kelas_id
		LEFT JOIN tingkatan t ON t.id = b.tingkatan_id
		WHERE s.id = $1`, in.SantriID).Scan(&tingkatan, &kelas)
	if err != nil {
		return err
	}
	tn := ""
	if tingkatan != nil {
		tn = *tingkatan
	}
	if !KompetensiEligible(tn, kelas, in.Kategori) {
		return ErrKompetensiTidakBerlaku
	}
	_, err = config.DB.Exec(ctx, `
		INSERT INTO nilai_kompetensi (santri_id, kategori, hasil, tahun_ajaran)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (santri_id, kategori, tahun_ajaran)
		DO UPDATE SET hasil = EXCLUDED.hasil, updated_at = now()`,
		in.SantriID, in.Kategori, in.Hasil, in.TahunAjaran)
	return err
}

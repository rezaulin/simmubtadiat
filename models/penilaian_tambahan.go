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

// FilterBagian = filter cascading "Tingkatan → Kelas → Bagian" untuk 3 fitur
// nilai tambahan (Di Bawah Rata², Setoran Juz Amma, Kompetensi). Nama
// tingkatan/kelas case-insensitive; kosong = semua; BagianID nil = semua.
type FilterBagian struct {
	Tingkatan string
	Kelas     string
	BagianID  *int
}

// ── Konsistensi dgn Nilai Akademik (keputusan owner 2026-10-02) ─────────────
// MapelDihitungIDs mengembalikan ID mapel yang ikut dihitung kolom
// "Jumlah"/"Rata-rata" di tab Nilai Akademik — port PERSIS dari
// isExcludedMapel(m) di frontend/src/js/penilaian.js (tanpa isRaport),
// supaya jumlah & rata² di tab Di Bawah Rata² sama persis dengan akademik.
func MapelDihitungIDs(ctx context.Context) ([]int, error) {
	rows, err := config.DB.Query(ctx, `
		SELECT id, LOWER(COALESCE(kategori,'')), LOWER(COALESCE(nama_mapel,'')),
		       LOWER(COALESCE(nama_kitab,''))
		FROM mata_pelajaran`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	ids := []int{}
	for rows.Next() {
		var id int
		var kat, nama, kitab string
		if err := rows.Scan(&id, &kat, &nama, &kitab); err != nil {
			return nil, err
		}
		if mapelDihitung(kat, nama, kitab) {
			ids = append(ids, id)
		}
	}
	return ids, rows.Err()
}

// mapelDihitung = port dari isExcludedMapel (non-raport). Parameter sudah
// di-lower (latin) — ejaan Arab tidak peka huruf besar/kecil.
func mapelDihitung(kat, nama, kitab string) bool {
	// kategori selalu dikecualikan
	switch kat {
	case "al_quran", "al_khot_imla", "qiroah_kutub", "muhafadhoh", "akhlaq", "akhlaq_perilaku":
		return false
	}
	// pengecualian nama: mapel ini TETAP dihitung walau mirip kategori di atas
	for _, p := range []string{"qawaid", "qowaid", "قواعد", "tafsir", "تفسير",
		"ulum", "علوم", "tarikh", "تاريخ", "muta'allim", "متعلم", "ta'lim", "تعليم"} {
		if strings.Contains(nama, p) {
			return true
		}
	}
	for _, p := range []string{"qawaid", "qowaid", "قواعد",
		"muta'allim", "متعلم", "ta'lim", "تعليم"} {
		if strings.Contains(kitab, p) {
			return true
		}
	}
	// exclude berdasarkan nama
	for _, p := range []string{"quran", "qur'an", "قرآن", "القرءان", "القرآن"} {
		if strings.Contains(nama, p) {
			return false
		}
	}
	for _, p := range []string{"khot", "imla", "خط", "إملاء", "الخط"} {
		if strings.Contains(nama, p) {
			return false
		}
	}
	for _, p := range []string{"qiroah", "qira'ah", "qiraat", "قراءة"} {
		if strings.Contains(nama, p) {
			return false
		}
	}
	for _, p := range []string{"hafad", "muhafadhoh", "محافظة"} {
		if strings.Contains(nama, p) {
			return false
		}
	}
	// Fann Akhlaq: dikecualikan hanya jika kitab kosong/"-"/"Akhlaq" dsb
	isKitabKosong := kitab == "" || kitab == "-" || kitab == "akhlaq" || kitab == "akhlak" ||
		kitab == "al-akhlaq" || kitab == "al-akhlak" || kitab == "أخلاق" ||
		kitab == "اخلاق" || kitab == "الأخلاق" || kitab == "الاخلاق"
	if (strings.Contains(nama, "akhlaq") || strings.Contains(nama, "akhlak") ||
		strings.Contains(nama, "أخلاق") || strings.Contains(nama, "اخلاق")) && isKitabKosong {
		return false
	}
	// exclude berdasarkan nama kitab
	for _, p := range []string{"quran", "قرآن", "القرآن"} {
		if strings.Contains(kitab, p) {
			return false
		}
	}
	for _, p := range []string{"khot", "خط", "إملاء"} {
		if strings.Contains(kitab, p) {
			return false
		}
	}
	for _, p := range []string{"qiroah", "قراءة"} {
		if strings.Contains(kitab, p) {
			return false
		}
	}
	for _, p := range []string{"hafad", "محافظة"} {
		if strings.Contains(kitab, p) {
			return false
		}
	}
	for _, p := range []string{"akhlaq", "akhlak", "al-akhlaq", "al-akhlak",
		"أخلاق", "اخلاق", "الأخلاق", "الاخلاق"} {
		if kitab == p {
			return false
		}
	}
	return true
}

// GetBawahRata: filter opsional tingkatan/kelas/bagian (nama, case-insensitive)
// — untuk filter cascading "Tingkatan → Kelas → Bagian" (kosong = semua).
// filter AnakWali: wali hanya melihat santri miliknya.
func GetBawahRata(ctx context.Context, tahunAjaran string, kuartal int, dalamMasa, selesai *bool, bagianIDs []int, santriIDs []int, filter FilterBagian) ([]BarisBawahRata, error) {
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
		  AND s.status = 'aktif'
		  AND s.bagian_id = ANY($3)`
		// mapel yang IKUT dihitung kolom Jumlah/Rata² tab Nilai Akademik
		// (port isExcludedMapel) + wajib aktif di kuartal ini → konsistensi
		// dgn tampilan akademik (keputusan owner 2026-10-02).
		mapelIDs, err := MapelDihitungIDs(ctx)
		if err != nil {
			return nil, err
		}
		args = append(args, mapelIDs)
		q += fmt.Sprintf(" AND mp.id = ANY($%d) AND mp.aktif_kuartal @> to_jsonb($2::integer)", len(args))
		// filter cascading tingkatan/kelas/bagian (kosong = semua)
		if filter.Tingkatan != "" {
			args = append(args, filter.Tingkatan)
			q += fmt.Sprintf(" AND LOWER(t.nama) = LOWER($%d)", len(args))
		}
		if filter.Kelas != "" {
			args = append(args, filter.Kelas)
			q += fmt.Sprintf(" AND LOWER(k.nama) = LOWER($%d)", len(args))
		}
		if filter.BagianID != nil {
			args = append(args, *filter.BagianID)
			q += fmt.Sprintf(" AND b.id = $%d", len(args))
		}
		// filter anak (khusus wali_santri) — disisip SEBELUM filter opsional lain
		// supaya penomoran argumen tetap: $1 ta, $2 kuartal, $3 bagian, $4 santri.
	if len(santriIDs) > 0 {
		args = append(args, santriIDs)
		q += fmt.Sprintf(" AND s.id = ANY($%d)", len(args))
	}
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
	// HAVING selalu menunjuk argumen TERAKHIR (= batas), berapa pun banyak
	// filter opsional sebelumnya (dalam_masa/selesai/santri-anak).
	q = strings.Replace(q, "HAVING AVG(nk.nilai) < $4",
		fmt.Sprintf("HAVING AVG(nk.nilai) < $%d", len(args)), 1)

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
	No    int  `json:"no"`
	Setor bool `json:"setor"`
}

type BarisJuzAmma struct {
	SantriID    int          `json:"santri_id"`
	Nama        string       `json:"nama"`
	BagianID    int          `json:"bagian_id"`
	Bagian      string       `json:"bagian"`       // "6 Ibtidaiyah A"
	SuratDari   int          `json:"surat_dari"`   // selalu 114 (An-Nas)
	SuratSampai int          `json:"surat_sampai"` // batas kelas
	JumlahSurat int          `json:"jumlah_surat"`
	Surat       []SuratSetor `json:"surat"`
	Evaluasi    string       `json:"evaluasi"` // "" | lulus | her | tidak_lulus
	Status      string       `json:"status"`   // selesai | belum
}

// GetJuzAmma: daftar siswi kelas yang punya rentang setoran + ceklis per surat.
func GetJuzAmma(ctx context.Context, tahunAjaran string, filter FilterBagian, status, evaluasi string, bagianIDs []int, santriIDs []int) ([]BarisJuzAmma, error) {
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
	if filter.BagianID != nil {
		args = append(args, *filter.BagianID)
		q += fmt.Sprintf(" AND b.id = $%d", len(args))
	}
	if filter.Tingkatan != "" {
		args = append(args, filter.Tingkatan)
		q += fmt.Sprintf(" AND LOWER(t.nama) = LOWER($%d)", len(args))
	}
	if filter.Kelas != "" {
		args = append(args, filter.Kelas)
		q += fmt.Sprintf(" AND LOWER(k.nama) = LOWER($%d)", len(args))
	}
	// filter anak (khusus wali_santri)
	if len(santriIDs) > 0 {
		args = append(args, santriIDs)
		q += fmt.Sprintf(" AND s.id = ANY($%d)", len(args))
	}
	q += ` ORDER BY t.urutan DESC, k.nama ASC, b.nama_bagian ASC, s.nama ASC`

	rows, err := config.DB.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type kandidat struct {
		id        int
		nama      string
		bagianID  int
		bagian    string
		tingkatan string
		kelas     string
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
		SELECT santri_id, surat_no, setor,
		       COALESCE(evaluasi, ''), COALESCE(status, 'belum')
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
	TahunAjaran string  `json:"tahun_ajaran"`
	SantriID    int     `json:"santri_id"`
	SuratNo     *int    `json:"surat_no"`
	Setor       *bool   `json:"setor"`
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
	// Bangun SET dinamis (bug fix 2026-10-02: "(belum)" = kirim '' → harus
	// ME-RESET nilai jadi NULL; dulu '' diabaikan → pilihan lulus tetap melekat.
	// Field yang TIDAK dikirim (nil) tetap tidak diubah.)
	setClauses := []string{"updated_at = now()"}
	args := []any{in.SantriID, in.TahunAjaran}
	if in.Evaluasi != nil {
		args = append(args, *in.Evaluasi)
		setClauses = append(setClauses,
			fmt.Sprintf("evaluasi = CASE WHEN $%d::text = '' THEN NULL ELSE $%d::text END", len(args), len(args)))
	}
	if in.Status != nil {
		args = append(args, *in.Status)
		setClauses = append(setClauses,
			fmt.Sprintf("status = CASE WHEN $%d::text = '' THEN NULL ELSE $%d::text END", len(args), len(args)))
	}
	q := "UPDATE setoran_juz_amma SET " + strings.Join(setClauses, ", ") +
		" WHERE santri_id = $1 AND tahun_ajaran = $2"
	_, err := config.DB.Exec(ctx, q, args...)
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
	// generate_series harus ASCENDING dari target ke 114 (mis. 83..114 utk
	// 1 aly). Dulu "generate_series(114, target)" → start > stop → 0 baris →
	// UPDATE evaluasi/status kena 0 row ("tersimpan" palsu, bug 2026-10-02).
	_, err = config.DB.Exec(ctx, fmt.Sprintf(`
		INSERT INTO setoran_juz_amma (santri_id, surat_no, tahun_ajaran)
		SELECT $1, g, $2 FROM generate_series(%d, 114) AS g
		ON CONFLICT (santri_id, surat_no, tahun_ajaran) DO NOTHING`, target),
		santriID, tahunAjaran)
	return target, err
}

// ─── Tab 4: Nilai Kompetensi ────────────────────────────────────────────────

// ErrKompetensiTidakBerlaku dipanggil bila kelas/kategori tidak sesuai
// jadwal owner: 3 tsn (ubq+kitab+praktik), 1 aly (praktik), 2 aly (ubq),
// 3 aly (kitab+praktik), + 6 ibt (ubq+kitab+praktik) — koreksi owner
// 2026-10-02: siswi kelas 6 Ibtidaiyah wajib tampil di Nilai Kompetensi.
var ErrKompetensiTidakBerlaku = errors.New("kategori ujian tidak berlaku untuk kelas ini")

var kategoriKompetensi = []string{"ubq", "praktik", "kitab"}

// KompetensiEligible: apakah kategori ujian berlaku untuk tingkatan+kelas ini.
func KompetensiEligible(tingkatan, kelas, kategori string) bool {
	t := strings.ToLower(strings.TrimSpace(tingkatan))
	k := strings.TrimSpace(kelas)
	// Kelas 6 Ibtidaiyah: semua kategori ujian berlaku (koreksi owner 2026-10-02).
	if t == "ibtidaiyah" && k == "6" {
		return true
	}
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
func GetKompetensi(ctx context.Context, tahunAjaran, kategori, hasil string, filter FilterBagian, bagianIDs []int, santriIDs []int) ([]BarisKompetensi, error) {
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
	if filter.BagianID != nil {
		args = append(args, *filter.BagianID)
		q += fmt.Sprintf(" AND b.id = $%d", len(args))
	}
	if filter.Tingkatan != "" {
		args = append(args, filter.Tingkatan)
		q += fmt.Sprintf(" AND LOWER(t.nama) = LOWER($%d)", len(args))
	}
	if filter.Kelas != "" {
		args = append(args, filter.Kelas)
		q += fmt.Sprintf(" AND LOWER(k.nama) = LOWER($%d)", len(args))
	}
	// filter anak (khusus wali_santri)
	if len(santriIDs) > 0 {
		args = append(args, santriIDs)
		q += fmt.Sprintf(" AND s.id = ANY($%d)", len(args))
	}
	q += ` ORDER BY t.urutan DESC, k.nama ASC, b.nama_bagian ASC, s.nama ASC`

	rows, err := config.DB.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type santriRow struct {
		id        int
		nama      string
		bagianID  int
		bagian    string
		tingkatan string
		kelas     string
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

// ─── Fase 5: akses wali santri (read-only data anaknya sendiri) ────────────

// AnakWali = daftar anak milik akun wali_santri.
type AnakWali struct {
	SantriID int    `json:"santri_id"`
	Nama     string `json:"nama"`
	Bagian   string `json:"bagian"`
}

// WaliAnakSantriIDs: ID santri aktif yang dilink ke user wali ini.
// Dipakai semua GET tab tambahan sebagai filter "hanya anak".
func WaliAnakSantriIDs(ctx context.Context, userID int) ([]int, error) {
	rows, err := config.DB.Query(ctx, `
				SELECT wsl.santri_id
				FROM wali_santri_link wsl
				JOIN santri s ON s.id = wsl.santri_id AND s.status = 'aktif'
				WHERE wsl.user_id = $1
				ORDER BY wsl.santri_id`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	ids := []int{}
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// WaliAnakRows: info anak utk endpoint GET /wali/anak.
func WaliAnakRows(ctx context.Context, userID int) ([]AnakWali, error) {
	rows, err := config.DB.Query(ctx, `
				SELECT s.id, s.nama,
				       TRIM(COALESCE(k.nama,'') || ' ' || COALESCE(t.nama,'') || ' ' || COALESCE(b.nama_bagian,''))
				FROM wali_santri_link wsl
				JOIN santri s   ON s.id = wsl.santri_id AND s.status = 'aktif'
				LEFT JOIN bagian b  ON b.id = s.bagian_id
				LEFT JOIN kelas k   ON k.id = b.kelas_id
				LEFT JOIN tingkatan t ON t.id = b.tingkatan_id
				WHERE wsl.user_id = $1
				ORDER BY s.nama`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AnakWali{}
	for rows.Next() {
		var a AnakWali
		if err := rows.Scan(&a.SantriID, &a.Nama, &a.Bagian); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

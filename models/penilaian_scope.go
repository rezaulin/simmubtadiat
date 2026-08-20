package models

import (
	"context"
	"strings"

	"github.com/mubtadiaat/app/config"
)

// Cakupan akses penilaian untuk mustahiq.
//
// Aturan (sesuai kebutuhan): seorang mustahiq yang ditugaskan pada suatu bagian
// hanya boleh melihat & mengedit nilai pada bagian-bagian yang berada dalam
// KELAS + TINGKATAN yang sama dengan penugasannya. Contoh: mustahiq "Kelas 1
// Tsanawiyah" boleh mengakses semua bagian/ruangan di Kelas 1 Tsanawiyah, tetapi
// tidak boleh menyentuh kelas/tingkatan lain.
//
// pimpinan & admin tidak dibatasi (akses penuh).

// GetBagianForPenilaian mengembalikan daftar bagian yang boleh diakses pengguna
// pada halaman Penilaian, sesuai peran.
//   - pimpinan / admin: seluruh bagian aktif.
//   - mustahiq: hanya bagian dalam kelas+tingkatan penugasannya.
//   - selain itu: kosong.
func GetBagianForPenilaian(ctx context.Context, roles []string, pengajarID *int) ([]Bagian, error) {
	for _, role := range roles {
		if role == "pimpinan" || role == "admin" || role == "tim_rapot" || role == "muroqib" {
			bagians, err := GetBagian(ctx)
			if err == nil {
				for i := range bagians {
					bagians[i].CanEditAbsensi, _ = CanEditBagianAbsensi(ctx, roles, pengajarID, bagians[i].ID)
					
					canEditNilai, _ := CanEditBagianPenilaian(ctx, roles, pengajarID, bagians[i].ID)
					if !canEditNilai {
						for _, r := range roles {
							if r == "tim_rapot" && containsIbtidaiyah(bagians[i].Tingkatan) {
								canEditNilai = true
								break
							}
						}
					}
					bagians[i].CanEditNilai = canEditNilai
				}
			}
			return bagians, err
		}
	}

	if pengajarID == nil {
		return []Bagian{}, nil
	}

	var conditions []string
	for _, role := range roles {
		if role == "mustahiq" {
			conditions = append(conditions, `
			  EXISTS (
			      SELECT 1 FROM mustahiq_bagian mb
			      JOIN bagian mbb ON mb.bagian_id = mbb.id
			      WHERE mb.pengajar_id = $1
			        AND mbb.tingkatan_id = b.tingkatan_id
			        AND mbb.kelas_id = b.kelas_id
			  )`)
		} else if role == "mufatish" {
			conditions = append(conditions, `
			  EXISTS (
			      SELECT 1 FROM mufatish_kelas mk
			      WHERE mk.pengajar_id = $1
			        AND mk.tingkatan_id = b.tingkatan_id
			        AND mk.kelas_id = b.kelas_id
			  )`)
		}
	}

	if len(conditions) == 0 {
		return []Bagian{}, nil
	}

	query := `
		SELECT DISTINCT b.id, b.kelas_id, b.tingkatan_id, b.nama_bagian, b.is_active, b.created_at,
		       t.nama AS tingkatan, k.nama AS kelas
		FROM bagian b
		LEFT JOIN tingkatan t ON b.tingkatan_id = t.id
		LEFT JOIN kelas k ON b.kelas_id = k.id
		WHERE b.is_active = true
		  AND (` + strings.Join(conditions, " OR ") + `)
		ORDER BY b.id ASC`

	rows, err := config.DB.Query(ctx, query, *pengajarID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []Bagian{}
	for rows.Next() {
		var b Bagian
		var tingkatan, kelas *string
		if err := rows.Scan(&b.ID, &b.KelasID, &b.TingkatanID, &b.NamaBagian, &b.IsActive, &b.CreatedAt, &tingkatan, &kelas); err != nil {
			return nil, err
		}
		if tingkatan != nil {
			b.Tingkatan = *tingkatan
		}
		if kelas != nil {
			b.Kelas = *kelas
		}
		result = append(result, b)
	}
	for i := range result {
		// Populate CanEditNilai dan CanEditAbsensi
		canEdit, _ := CanEditBagianPenilaian(ctx, roles, pengajarID, result[i].ID)
		result[i].CanEditNilai = canEdit

		canEditAbsensi, _ := CanEditBagianAbsensi(ctx, roles, pengajarID, result[i].ID)
		result[i].CanEditAbsensi = canEditAbsensi
	}
	
	return result, nil
}

// CanViewBagianPenilaian mengecek apakah pengguna boleh sekedar melihat
// nilai pada sebuah bagian. pimpinan/admin selalu boleh. 
// mustahiq dan mufatish bila bagian berada dalam kelas+tingkatan penugasannya.
func CanViewBagianPenilaian(ctx context.Context, roles []string, pengajarID *int, bagianID int) (bool, error) {
	for _, role := range roles {
		if role == "pimpinan" || role == "admin" || role == "muroqib" || role == "tim_rapot" {
			return true, nil
		}
	}

	if pengajarID == nil {
		return false, nil
	}

	var conditions []string
	for _, role := range roles {
		if role == "mustahiq" {
			conditions = append(conditions, `
			  EXISTS (
			      SELECT 1 FROM mustahiq_bagian mb
			      JOIN bagian mbb ON mb.bagian_id = mbb.id
			      WHERE mb.pengajar_id = $2
			        AND mbb.tingkatan_id = b.tingkatan_id
			        AND mbb.kelas_id = b.kelas_id
			  )`)
		} else if role == "mufatish" {
			conditions = append(conditions, `
			  EXISTS (
			      SELECT 1 FROM mufatish_kelas mk
			      WHERE mk.pengajar_id = $2
			        AND mk.tingkatan_id = b.tingkatan_id
			        AND mk.kelas_id = b.kelas_id
			  )`)
		}
	}

	if len(conditions) == 0 {
		return false, nil
	}

	var cnt int
	err := config.DB.QueryRow(ctx, `
		SELECT COUNT(1)
		FROM bagian b
		WHERE b.id = $1
		  AND (`+strings.Join(conditions, " OR ")+`)`, bagianID, *pengajarID).Scan(&cnt)
	return cnt > 0, err
}

// CanEditBagianAbsensi mengecek apakah pengguna boleh mengedit absensi bagian ini.
// Pimpinan selalu boleh. Mufatish bila bagian berada dalam kelas+tingkatan penugasannya.
func CanEditBagianAbsensi(ctx context.Context, roles []string, pengajarID *int, bagianID int) (bool, error) {
	for _, role := range roles {
		if role == "pimpinan" || role == "admin" || role == "muroqib" {
			return true, nil
		}
	}

	if pengajarID == nil {
		return false, nil
	}

	var conditions []string
	for _, role := range roles {
		if role == "mufatish" {
			conditions = append(conditions, `
			  EXISTS (
			      SELECT 1 FROM mufatish_kelas mk
			      WHERE mk.pengajar_id = $2
			        AND mk.tingkatan_id = b.tingkatan_id
			        AND mk.kelas_id = b.kelas_id
			  )`)
		}
	}

	if len(conditions) == 0 {
		return false, nil
	}

	var cnt int
	err := config.DB.QueryRow(ctx, `
		SELECT COUNT(1)
		FROM bagian b
		WHERE b.id = $1
		  AND (`+strings.Join(conditions, " OR ")+`)`, bagianID, *pengajarID).Scan(&cnt)
	return cnt > 0, err
}

// CanEditBagianPenilaian mengecek apakah pengguna boleh mengedit (tulis)
// nilai pada sebuah bagian. pimpinan/admin selalu boleh. 
// mustahiq hanya bila bagian berada dalam kelas+tingkatan penugasannya. mufatish tidak boleh.
func CanEditBagianPenilaian(ctx context.Context, roles []string, pengajarID *int, bagianID int) (bool, error) {
	for _, role := range roles {
		if role == "pimpinan" || role == "admin" {
			return true, nil
		}
	}

	for _, role := range roles {
		if role == "tim_rapot" {
			isIbtidaiyah, err := IsBagianIbtidaiyah(ctx, bagianID)
			if err != nil {
				return false, err
			}
			if isIbtidaiyah {
				return true, nil
			}
		}
	}

	if pengajarID == nil {
		return false, nil
	}

	var conditions []string
	for _, role := range roles {
		if role == "mustahiq" {
			conditions = append(conditions, `
			  EXISTS (
			      SELECT 1 FROM mustahiq_bagian mb
			      JOIN bagian mbb ON mb.bagian_id = mbb.id
			      WHERE mb.pengajar_id = $2
			        AND mbb.tingkatan_id = b.tingkatan_id
			        AND mbb.kelas_id = b.kelas_id
			  )`)
		}
	}

	if len(conditions) == 0 {
		return false, nil
	}

	var cnt int
	err := config.DB.QueryRow(ctx, `
		SELECT COUNT(1)
		FROM bagian b
		WHERE b.id = $1
		  AND (`+strings.Join(conditions, " OR ")+`)`, bagianID, *pengajarID).Scan(&cnt)
	return cnt > 0, err
}

// CanEditSantriPenilaian mengecek apakah pengguna boleh mengedit nilai seorang
// santri (berdasarkan bagian santri saat ini). Dipakai pada endpoint input nilai
// yang berbasis santri (kuartal/khos/bayan/generate).
func CanEditSantriPenilaian(ctx context.Context, roles []string, pengajarID *int, santriID int) (bool, error) {
	for _, role := range roles {
		if role == "pimpinan" || role == "admin" {
			return true, nil
		}
	}

	for _, role := range roles {
		if role == "tim_rapot" {
			isIbtidaiyah, err := IsSantriIbtidaiyah(ctx, santriID)
			if err != nil {
				return false, err
			}
			if isIbtidaiyah {
				return true, nil
			}
		}
	}

	if pengajarID == nil {
		return false, nil
	}
	
	var conditions []string
	for _, role := range roles {
		if role == "mustahiq" {
			conditions = append(conditions, `
			  EXISTS (
			      SELECT 1 FROM mustahiq_bagian mb
			      JOIN bagian mbb ON mb.bagian_id = mbb.id
			      WHERE mb.pengajar_id = $2
			        AND mbb.tingkatan_id = sb.tingkatan_id
			        AND mbb.kelas_id = sb.kelas_id
			  )`)
		}
	}

	if len(conditions) == 0 {
		return false, nil
	}

	var cnt int
	err := config.DB.QueryRow(ctx, `
		SELECT COUNT(1)
		FROM santri s
		JOIN bagian sb ON s.bagian_id = sb.id
		WHERE s.id = $1
		  AND (`+strings.Join(conditions, " OR ")+`)`, santriID, *pengajarID).Scan(&cnt)
	return cnt > 0, err
}

// CanEditAbsensiBagian mengecek apakah pengguna boleh mengedit absensi manual.
// pimpinan/admin selalu boleh. mufatish hanya bila bagian berada dalam kelas penugasannya.
// mustahiq tidak diizinkan.
func CanEditAbsensiBagian(ctx context.Context, roles []string, pengajarID *int, bagianID int) (bool, error) {
	for _, role := range roles {
		if role == "pimpinan" || role == "admin" || role == "muroqib" {
			return true, nil
		}
	}

	if pengajarID == nil {
		return false, nil
	}

	var conditions []string
	for _, role := range roles {
		if role == "mufatish" {
			conditions = append(conditions, `
			  EXISTS (
			      SELECT 1 FROM mufatish_kelas mk
			      WHERE mk.pengajar_id = $2
			        AND mk.tingkatan_id = b.tingkatan_id
			        AND mk.kelas_id = b.kelas_id
			  )`)
		}
	}

	if len(conditions) == 0 {
		return false, nil
	}

	var cnt int
	err := config.DB.QueryRow(ctx, `
		SELECT COUNT(1)
		FROM bagian b
		WHERE b.id = $1
		  AND (`+strings.Join(conditions, " OR ")+`)`, bagianID, *pengajarID).Scan(&cnt)
	return cnt > 0, err
}

func IsBagianIbtidaiyah(ctx context.Context, bagianID int) (bool, error) {
	var namaTingkatan string
	err := config.DB.QueryRow(ctx, `
		SELECT t.nama 
		FROM bagian b 
		JOIN tingkatan t ON b.tingkatan_id = t.id 
		WHERE b.id = $1`, bagianID).Scan(&namaTingkatan)
	if err != nil {
		return false, err
	}
	return containsIbtidaiyah(namaTingkatan), nil
}

func IsSantriIbtidaiyah(ctx context.Context, santriID int) (bool, error) {
	var namaTingkatan string
	err := config.DB.QueryRow(ctx, `
		SELECT t.nama 
		FROM santri s 
		JOIN bagian b ON s.bagian_id = b.id 
		JOIN tingkatan t ON b.tingkatan_id = t.id 
		WHERE s.id = $1`, santriID).Scan(&namaTingkatan)
	if err != nil {
		return false, err
	}
	return containsIbtidaiyah(namaTingkatan), nil
}

func containsIbtidaiyah(nama string) bool {
	lower := strings.ToLower(nama)
	return strings.Contains(lower, "ibtidaiyah") || strings.Contains(lower, "ibtidaiyyah") || strings.Contains(lower, "ibtida")
}

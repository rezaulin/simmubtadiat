package models

import (
	"context"
	"errors"
	"strconv"
	"strings"

	"golang.org/x/crypto/bcrypt"

	"github.com/mubtadiaat/app/config"
)

type User struct {
	ID                int      `json:"id"`
	Username          string   `json:"username"`
	Role              string   `json:"role"` // Primary role (first role or legacy)
	Roles             []string `json:"roles"`
	Nama              string   `json:"nama"`
	IsActive          bool     `json:"is_active"`
	IsPasswordChanged bool     `json:"is_password_changed"`
	PengajarID        *int     `json:"pengajar_id,omitempty"`

	// Konteks wali santri (hanya terisi untuk role wali_santri).
	// AnakNama/AnakKelas diambil dari wali_santri_link supaya pimpinan tahu
	// akun wali ini milik siapa. Orphan=true bila akun wali tidak tertaut
	// ke santri manapun (sampah data yang perlu dibersihkan).
	AnakNama  string `json:"anak_nama,omitempty"`
	AnakKelas string `json:"anak_kelas,omitempty"`
	Orphan    bool   `json:"orphan,omitempty"`
}

// GetAllUsers mengembalikan daftar user dengan filter & paginasi.
//   role: "" atau "staf" → semua KECUALI wali_santri; "wali_santri" → hanya wali;
//         "all" → semua role termasuk wali; nilai peran lain → tepat peran itu.
//   q: cari di nama/username (opsional). limit/offset: paginasi.
// Mengembalikan (items, total, error); total = jumlah baris sesuai filter (untuk paginasi).
func GetAllUsers(ctx context.Context, role, q string, limit, offset int) ([]User, int, error) {
	where := "WHERE 1=1"
	args := []interface{}{}

	// Hanya tampilkan akun aktif; akun yang dihapus (soft delete) disembunyikan.
	where += " AND is_active = true"

	switch role {
	case "all":
		// Semua role, termasuk wali_santri (dipakai filter "Semua Role" di UI).
	case "", "staf":
		where += " AND role <> 'wali_santri'"
	case "wali_santri":
		where += " AND role = 'wali_santri'"
	default:
		args = append(args, role)
		where += " AND role = $" + strconv.Itoa(len(args))
	}

	if s := strings.TrimSpace(q); s != "" {
		args = append(args, "%"+s+"%")
		p := strconv.Itoa(len(args))
		where += " AND (COALESCE(nama,'') ILIKE $" + p + " OR username ILIKE $" + p + ")"
	}

	// Total untuk paginasi.
	var total int
	if err := config.DB.QueryRow(ctx, "SELECT COUNT(*) FROM users "+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// Urutan: staf dulu (wali_santri terakhir), lalu nama/username.
	query := "SELECT id, username, role, COALESCE(nama, ''), is_active, is_password_changed, pengajar_id FROM users " +
		where + " ORDER BY (role = 'wali_santri'), COALESCE(NULLIF(nama,''), username) ASC"
	if limit > 0 {
		args = append(args, limit)
		query += " LIMIT $" + strconv.Itoa(len(args))
		args = append(args, offset)
		query += " OFFSET $" + strconv.Itoa(len(args))
	}

	rows, err := config.DB.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	results := make([]User, 0)
	var userIDs []int
	userMap := make(map[int]*User)

	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Username, &u.Role, &u.Nama, &u.IsActive, &u.IsPasswordChanged, &u.PengajarID); err != nil {
			return nil, 0, err
		}
		u.Roles = []string{u.Role} // Default to primary role
		results = append(results, u)
		userIDs = append(userIDs, u.ID)
	}
	
	for i := range results {
		userMap[results[i].ID] = &results[i]
	}

	if len(userIDs) > 0 {
		// Fetch roles from user_roles
		rolesQuery := "SELECT user_id, role FROM user_roles WHERE user_id = ANY($1)"
		roleRows, err := config.DB.Query(ctx, rolesQuery, userIDs)
		if err == nil {
			defer roleRows.Close()
			
			// Clear Roles for users that have entries in user_roles
			// We track which users have user_roles entries
			hasRoles := make(map[int]bool)
			
			for roleRows.Next() {
				var uid int
				var r string
				if err := roleRows.Scan(&uid, &r); err == nil {
					if u, ok := userMap[uid]; ok {
						if !hasRoles[uid] {
							u.Roles = []string{} // Clear default primary role
							hasRoles[uid] = true
						}
						// Check if role already exists in array to prevent duplicates
						exists := false
						for _, existing := range u.Roles {
							if existing == r {
								exists = true
								break
							}
						}
						if !exists {
							u.Roles = append(u.Roles, r)
						}
					}
				}
			}
		}
	}

	// Konteks wali: anak yang tertaut (nama + kelas/tingkatan). Tanpa ini
	// pimpinan cuma lihat "Wali <NamaAnak>" + username NIK tanpa tahu
	// anaknya siapa / kelas berapa — susah cari wali yang mau direset.
	if len(userIDs) > 0 {
		linkRows, err := config.DB.Query(ctx, `
			SELECT wl.user_id, COALESCE(s.nama,''), COALESCE(k.nama,''), COALESCE(t.nama,'')
			FROM wali_santri_link wl
			JOIN santri s ON s.id = wl.santri_id
			LEFT JOIN bagian b ON s.bagian_id = b.id
			LEFT JOIN tingkatan t ON b.tingkatan_id = t.id
			LEFT JOIN kelas k ON b.kelas_id = k.id
			WHERE wl.user_id = ANY($1)
			ORDER BY s.nama`, userIDs)
		if err == nil {
			defer linkRows.Close()
			anakNama := map[int][]string{}
			anakKelas := map[int][]string{}
			for linkRows.Next() {
				var uid int
				var nama, kelas, tingkatan string
				if err := linkRows.Scan(&uid, &nama, &kelas, &tingkatan); err != nil {
					continue
				}
				anakNama[uid] = append(anakNama[uid], nama)
				// Konvensi raport: "<kelas> <tingkatan>", mis. "3 Aliyah".
				anakKelas[uid] = append(anakKelas[uid], strings.TrimSpace(kelas+" "+tingkatan))
			}
			for uid, names := range anakNama {
				if u, ok := userMap[uid]; ok {
					u.AnakNama = strings.Join(names, ", ")
					u.AnakKelas = strings.Join(anakKelas[uid], ", ")
				}
			}
		}
		// Wali aktif yang tidak tertaut santri manapun = orphan.
		for i := range results {
			if results[i].Role == "wali_santri" && results[i].AnakNama == "" {
				results[i].Orphan = true
			}
		}
	}

	return results, total, nil
}

// isTeachingRole menandai role yang butuh profil pengajar (untuk penugasan
// mufatish/mustahiq/muroqib dan pencatatan absensi).
func isTeachingRole(role string) bool {
	switch role {
	case "mufatish", "mustahiq", "muroqib":
		return true
	}
	return false
}

// pengajarStatusForRole memetakan role ke nilai kolom pengajar.status yang valid
// (constraint hanya mengizinkan 'mustahiq' atau 'muroqib'; selain itu NULL).
func pengajarStatusForRole(role string) *string {
	switch role {
	case "mustahiq":
		s := "mustahiq"
		return &s
	case "muroqib":
		s := "muroqib"
		return &s
	}
	return nil
}

// CreateUser membuat akun pengguna. Untuk role pengajar (mufatish/mustahiq/
// muroqib), profil Pengajar dibuat otomatis dari nama pengguna bila
// belum ditautkan ke pengajar yang sudah ada â€” sehingga admin cukup satu langkah.
// Role non-pengajar dipastikan tidak tertaut ke data pengajar.
func CreateUser(ctx context.Context, u User, password string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return err
	}

	tx, err := config.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	pengajarID := u.PengajarID
	
	// Determine if any of the roles is a teaching role
	isTeaching := false
	if len(u.Roles) > 0 {
		for _, r := range u.Roles {
			if isTeachingRole(r) {
				isTeaching = true
				break
			}
		}
	} else if isTeachingRole(u.Role) {
		isTeaching = true
	}

	if isTeaching {
		var status *string
		for _, r := range u.Roles {
			if isTeachingRole(r) {
				status = pengajarStatusForRole(r)
				break
			}
		}
		if status == nil {
			status = pengajarStatusForRole(u.Role)
		}

		if pengajarID == nil || *pengajarID == 0 {
			var newID int
			if err := tx.QueryRow(ctx,
				`INSERT INTO pengajar (nama, status, is_active) VALUES ($1, $2, true) RETURNING id`,
				u.Nama, status).Scan(&newID); err != nil {
				return err
			}
			pengajarID = &newID
		} else if status != nil {
			// Update status pengajar yang sudah ada jika belum memiliki status atau diubah
			if _, err := tx.Exec(ctx, `UPDATE pengajar SET status = $1 WHERE id = $2 AND (status IS NULL OR status != $1)`, status, *pengajarID); err != nil {
				return err
			}
		}
	} else {
		pengajarID = nil
	}

	// Prepare primary role
	primaryRole := u.Role
	if len(u.Roles) > 0 && primaryRole == "" {
		primaryRole = u.Roles[0]
	}

	var userID int
	// is_password_changed = true: admin sudah menetapkan password saat membuat
	// akun, sehingga pengguna bisa langsung login tanpa dipaksa ganti sandi dulu.
	if err := tx.QueryRow(ctx,
		`INSERT INTO users (username, password_hash, role, nama, is_active, is_password_changed, pengajar_id) 
		 VALUES ($1, $2, $3, $4, $5, true, $6) RETURNING id`,
		u.Username, string(hash), primaryRole, u.Nama, u.IsActive, pengajarID).Scan(&userID); err != nil {
		return err
	}

	// Insert into user_roles
	rolesToInsert := u.Roles
	if len(rolesToInsert) == 0 && primaryRole != "" {
		rolesToInsert = []string{primaryRole}
	}
	for _, r := range rolesToInsert {
		if r == "" {
			continue
		}
		if _, err := tx.Exec(ctx, "INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING", userID, r); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func UpdateUser(ctx context.Context, id int, u User) error {
	tx, err := config.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	primaryRole := u.Role
	if len(u.Roles) > 0 && primaryRole == "" {
		primaryRole = u.Roles[0]
	}

	_, err = tx.Exec(ctx,
		`UPDATE users SET username=$1, role=$2, nama=$3, is_active=$4, pengajar_id=$5 WHERE id=$6`,
		u.Username, primaryRole, u.Nama, u.IsActive, u.PengajarID, id)
	if err != nil {
		return err
	}

	// Update user_roles
	rolesToInsert := u.Roles
	if len(rolesToInsert) == 0 && primaryRole != "" {
		rolesToInsert = []string{primaryRole}
	}

	_, err = tx.Exec(ctx, "DELETE FROM user_roles WHERE user_id = $1", id)
	if err != nil {
		return err
	}

	for _, r := range rolesToInsert {
		if r == "" {
			continue
		}
		if _, err := tx.Exec(ctx, "INSERT INTO user_roles (user_id, role) VALUES ($1, $2)", id, r); err != nil {
			return err
		}
	}

	// Update pengajar.status if they have a teaching role and pengajarID is set
	if u.PengajarID != nil && *u.PengajarID != 0 {
		var status *string
		for _, r := range rolesToInsert {
			if isTeachingRole(r) {
				status = pengajarStatusForRole(r)
				break
			}
		}
		if status != nil {
			if _, err := tx.Exec(ctx, `UPDATE pengajar SET status = $1 WHERE id = $2 AND (status IS NULL OR status != $1)`, status, *u.PengajarID); err != nil {
				return err
			}
		}
	}

	return tx.Commit(ctx)
}

func DeleteUser(ctx context.Context, id int) error {
	// Soft delete: nonaktifkan akun. Sekaligus BEBASKAN username (tambah sufiks
	// unik) agar username tsb bisa dipakai lagi untuk akun baru, dan cabut sesi
	// aktif supaya pengguna langsung logout. Referensi FK (catatan, penilaian,
	// dll) tetap utuh karena baris user tidak benar-benar dihapus.
	tag, err := config.DB.Exec(ctx,
		`UPDATE users
		   SET is_active = false,
		       username = username || '__deleted_' || id::text
		 WHERE id = $1 AND is_active = true`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() > 0 {
		_, _ = config.DB.Exec(ctx, "DELETE FROM sessions WHERE user_id=$1", id)
	}
	return nil
}

// ErrUserNotFound dikembalikan bila id user tidak ada / sudah dihapus.
var ErrUserNotFound = errors.New("user tidak ditemukan")

// ResetPassword mengganti sandi user.
//
// is_password_changed di-set FALSE supaya user WAJIB mengganti sandinya sendiri
// saat login berikutnya — sandi yang direset pimpinan tidak boleh jadi sandi
// permanen yang diketahui orang lain (keputusan owner 2026-09).
// Sesi lama juga dicabut: sandi lama tidak boleh tetap hidup di perangkat lain.
func ResetPassword(ctx context.Context, id int, defaultPassword string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(defaultPassword), 12)
	if err != nil {
		return err
	}

	tx, err := config.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx,
		`UPDATE users SET password_hash=$1, is_password_changed=false, updated_at=NOW() WHERE id=$2`,
		string(hash), id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrUserNotFound
	}

	if _, err := tx.Exec(ctx, `DELETE FROM sessions WHERE user_id=$1`, id); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// ResetPasswordBulkResult melaporkan hasil reset per user.
type ResetPasswordBulkResult struct {
	ID       int    `json:"id"`
	Nama     string `json:"nama"`
	Username string `json:"username"`
	AnakNama string `json:"anak_nama,omitempty"`
	Password string `json:"password,omitempty"` // sandi baru, untuk diberitahukan ke wali
	Status   string `json:"status"`             // "sukses" | "gagal"
	Pesan    string `json:"pesan,omitempty"`
}

// ResetPasswordBulk mereset sandi banyak user sekaligus.
//
// password kosong → sandi dikembalikan ke NIK anak (untuk wali, username == NIK
// anak — sudah diverifikasi di produksi 2026-09). Setiap user diproses terpisah
// (PARTIAL): satu id yang bermasalah tidak menggagalkan sisanya.
func ResetPasswordBulk(ctx context.Context, ids []int, password string) ([]ResetPasswordBulkResult, error) {
	results := make([]ResetPasswordBulkResult, 0, len(ids))

	for _, id := range ids {
		var nama, username, anakNama string
		err := config.DB.QueryRow(ctx, `
			SELECT COALESCE(u.nama,''), u.username,
			       COALESCE((SELECT s.nama FROM wali_santri_link wl
			                 JOIN santri s ON s.id = wl.santri_id
			                 WHERE wl.user_id = u.id
			                 ORDER BY s.nama LIMIT 1), '')
			FROM users u WHERE u.id=$1 AND u.is_active=true`, id).
			Scan(&nama, &username, &anakNama)
		if err != nil {
			results = append(results, ResetPasswordBulkResult{
				ID: id, Status: "gagal", Pesan: "user tidak ditemukan / nonaktif",
			})
			continue
		}

		pw := password
		if pw == "" {
			// Default: NIK anak == username wali.
			pw = username
		}

		if err := ResetPassword(ctx, id, pw); err != nil {
			results = append(results, ResetPasswordBulkResult{
				ID: id, Nama: nama, Username: username, AnakNama: anakNama,
				Status: "gagal", Pesan: err.Error(),
			})
			continue
		}

		results = append(results, ResetPasswordBulkResult{
			ID: id, Nama: nama, Username: username, AnakNama: anakNama,
			Password: pw, Status: "sukses",
		})
	}

	return results, nil
}

type DynamicColumn struct {
	ID        int    `json:"id"`
	TableName string `json:"table_name"`
	ColKey    string `json:"col_key"`
	ColLabel  string `json:"col_label"`
	ColType   string `json:"col_type"`
}

func GetDynamicColumns(ctx context.Context, tableName string) ([]DynamicColumn, error) {
	rows, err := config.DB.Query(ctx, 
		"SELECT id, table_name, col_key, col_label, col_type FROM dynamic_columns WHERE table_name = $1 ORDER BY id ASC", 
		tableName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []DynamicColumn
	for rows.Next() {
		var dc DynamicColumn
		if err := rows.Scan(&dc.ID, &dc.TableName, &dc.ColKey, &dc.ColLabel, &dc.ColType); err != nil {
			return nil, err
		}
		results = append(results, dc)
	}
	return results, nil
}

func CreateDynamicColumn(ctx context.Context, dc DynamicColumn) error {
	_, err := config.DB.Exec(ctx,
		`INSERT INTO dynamic_columns (table_name, col_key, col_label, col_type) VALUES ($1, $2, $3, $4)`,
		dc.TableName, dc.ColKey, dc.ColLabel, dc.ColType)
	return err
}

func UpdateDynamicColumn(ctx context.Context, id int, dc DynamicColumn) error {
	_, err := config.DB.Exec(ctx,
		`UPDATE dynamic_columns SET col_label=$1, col_type=$2 WHERE id=$3`,
		dc.ColLabel, dc.ColType, id)
	return err
}

func DeleteDynamicColumn(ctx context.Context, id int) error {
	_, err := config.DB.Exec(ctx, "DELETE FROM dynamic_columns WHERE id=$1", id)
	return err
}

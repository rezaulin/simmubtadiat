package models

import (
	"context"
	"time"

	"github.com/mubtadiaat/app/config"
)

// Agenda merepresentasikan satu acara/agenda bebas (all-day) yang dibuat admin.
// TglSelesai nullable: kosong berarti acara satu hari. Tanggal diformat
// 'YYYY-MM-DD' agar konsisten dengan sumber kalender lain di frontend.
type Agenda struct {
	ID         int       `json:"id"`
	Judul      string    `json:"judul"`
	Deskripsi  string    `json:"deskripsi"`
	TglMulai   string    `json:"tgl_mulai"`
	TglSelesai *string   `json:"tgl_selesai"`
	DibuatOleh *int      `json:"dibuat_oleh"`
	CreatedAt  time.Time `json:"created_at"`
}

// scanAgenda memindai satu baris hasil kueri agenda ke struct Agenda.
// tgl_selesai bisa NULL sehingga dipindai ke *string.
func scanAgenda(rows interface {
	Scan(dest ...any) error
}) (Agenda, error) {
	var a Agenda
	var deskripsi *string
	err := rows.Scan(&a.ID, &a.Judul, &deskripsi, &a.TglMulai, &a.TglSelesai, &a.DibuatOleh, &a.CreatedAt)
	if err != nil {
		return a, err
	}
	if deskripsi != nil {
		a.Deskripsi = *deskripsi
	}
	return a, nil
}

const agendaSelectCols = `id, judul, deskripsi,
	TO_CHAR(tgl_mulai, 'YYYY-MM-DD'),
	CASE WHEN tgl_selesai IS NULL THEN NULL ELSE TO_CHAR(tgl_selesai, 'YYYY-MM-DD') END,
	dibuat_oleh, created_at`

// GetAgendaByRange mengembalikan agenda yang beririsan dengan rentang [from, to]
// (inklusif). Sebuah agenda beririsan jika tgl_mulai <= to DAN
// COALESCE(tgl_selesai, tgl_mulai) >= from. Diurutkan menaik berdasarkan
// tgl_mulai lalu id agar deterministik.
func GetAgendaByRange(ctx context.Context, from, to string) ([]Agenda, error) {
	rows, err := config.DB.Query(ctx,
		`SELECT `+agendaSelectCols+`
		 FROM agenda
		 WHERE tgl_mulai <= $2 AND COALESCE(tgl_selesai, tgl_mulai) >= $1
		 ORDER BY tgl_mulai ASC, id ASC`, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := []Agenda{}
	for rows.Next() {
		a, err := scanAgenda(rows)
		if err != nil {
			return nil, err
		}
		res = append(res, a)
	}
	return res, rows.Err()
}

// GetUpcomingAgenda mengembalikan agenda yang masih berlangsung atau akan datang
// pada/atas tanggal `from` (COALESCE(tgl_selesai, tgl_mulai) >= from), diurutkan
// menaik, dibatasi `limit` entri (limit <= 0 → tanpa batas praktis).
func GetUpcomingAgenda(ctx context.Context, from string, limit int) ([]Agenda, error) {
	query := `SELECT ` + agendaSelectCols + `
		 FROM agenda
		 WHERE COALESCE(tgl_selesai, tgl_mulai) >= $1
		 ORDER BY tgl_mulai ASC, id ASC`
	args := []any{from}
	if limit > 0 {
		query += ` LIMIT $2`
		args = append(args, limit)
	}
	rows, err := config.DB.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := []Agenda{}
	for rows.Next() {
		a, err := scanAgenda(rows)
		if err != nil {
			return nil, err
		}
		res = append(res, a)
	}
	return res, rows.Err()
}

// CreateAgenda menyisipkan agenda baru dan mengembalikan baris hasil (termasuk id
// & created_at). tglSelesai nil disimpan sebagai NULL (acara satu hari).
func CreateAgenda(ctx context.Context, a Agenda) (Agenda, error) {
	row := config.DB.QueryRow(ctx,
		`INSERT INTO agenda (judul, deskripsi, tgl_mulai, tgl_selesai, dibuat_oleh)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING `+agendaSelectCols,
		a.Judul, nullIfEmpty(a.Deskripsi), a.TglMulai, a.TglSelesai, a.DibuatOleh)
	return scanAgenda(row)
}

// UpdateAgenda memperbarui agenda berdasarkan id dan menyegarkan updated_at.
func UpdateAgenda(ctx context.Context, id int, a Agenda) error {
	_, err := config.DB.Exec(ctx,
		`UPDATE agenda
		 SET judul = $1, deskripsi = $2, tgl_mulai = $3, tgl_selesai = $4, updated_at = now()
		 WHERE id = $5`,
		a.Judul, nullIfEmpty(a.Deskripsi), a.TglMulai, a.TglSelesai, id)
	return err
}

// DeleteAgenda menghapus agenda berdasarkan id.
func DeleteAgenda(ctx context.Context, id int) error {
	_, err := config.DB.Exec(ctx, `DELETE FROM agenda WHERE id = $1`, id)
	return err
}

// nullIfEmpty mengubah string kosong menjadi NULL agar kolom deskripsi tidak
// menyimpan string kosong yang tidak berarti.
func nullIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

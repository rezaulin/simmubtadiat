package models

import (
	"context"
	"github.com/mubtadiaat/app/config"
)

// GetTahunAjaranAktif retrieves the current active academic year.
// It checks settings first, then falls back to current date in kalender, then latest kalender.
func GetTahunAjaranAktif(ctx context.Context) string {
	var ta string
	err := config.DB.QueryRow(ctx, "SELECT value FROM settings WHERE key = 'tahun_ajaran_aktif'").Scan(&ta)
	if err == nil && ta != "" {
		return ta
	}

	err = config.DB.QueryRow(ctx, 
		`SELECT tahun_ajaran FROM kalender_kuartal 
		 WHERE CURRENT_DATE >= tgl_mulai AND CURRENT_DATE <= tgl_selesai 
		 ORDER BY id DESC LIMIT 1`).Scan(&ta)
	if err == nil && ta != "" {
		return ta
	}

	config.DB.QueryRow(ctx, "SELECT tahun_ajaran FROM kalender_kuartal ORDER BY tgl_selesai DESC LIMIT 1").Scan(&ta)
	if ta != "" {
		return ta
	}
	
	// Absolute fallback
	return "2026/2027"
}

// GetTahunHijriAktif retrieves the current active Hijri year from settings.
func GetTahunHijriAktif(ctx context.Context) string {
	var th string
	err := config.DB.QueryRow(ctx, "SELECT value FROM settings WHERE key = 'tahun_hijri_aktif'").Scan(&th)
	if err == nil && th != "" {
		return th
	}
	return "1447" // fallback
}

// GetSettingsActive retrieves the active settings map
func GetSettingsActive(ctx context.Context) (map[string]string, error) {
	rows, err := config.DB.Query(ctx, "SELECT key, value FROM settings")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := make(map[string]string)
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err == nil {
			res[k] = v
		}
	}
	return res, nil
}

// UpdateSetting updates a specific setting key
func UpdateSetting(ctx context.Context, key, value string) error {
	_, err := config.DB.Exec(ctx,
		`INSERT INTO settings (key, value) VALUES ($1, $2)
		 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
		key, value)
	return err
}

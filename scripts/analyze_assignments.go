package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/mubtadiaat/app/config"
)

func main() {
	config.InitDB("postgres://mubtadiaat:mubtadiaat_secret@localhost:5432/mubtadiaat_db")
	defer config.DB.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	rows, err := config.DB.Query(ctx, "SELECT id, pengajar_id, bagian_id, user_id FROM mustahiq_bagian")
	if err != nil {
		fmt.Println("Error querying mustahiq_bagian:", err)
		return
	}
	defer rows.Close()

	var mb []map[string]interface{}
	for rows.Next() {
		var id, pid, bid int
		var uid *int
		rows.Scan(&id, &pid, &bid, &uid)
		mb = append(mb, map[string]interface{}{"id": id, "pengajar_id": pid, "bagian_id": bid, "user_id": uid})
	}
	b, _ := json.MarshalIndent(mb, "", "  ")
	os.WriteFile("tmp/analysis_mustahiq.json", b, 0644)

	rows2, err := config.DB.Query(ctx, "SELECT id, pengajar_id, kelas_id, tingkatan_id, user_id FROM mufatish_kelas")
	if err == nil {
		defer rows2.Close()
		var mk []map[string]interface{}
		for rows2.Next() {
			var id, pid, kid, tid int
			var uid *int
			rows2.Scan(&id, &pid, &kid, &tid, &uid)
			mk = append(mk, map[string]interface{}{"id": id, "pengajar_id": pid, "kelas_id": kid, "tingkatan_id": tid, "user_id": uid})
		}
		b2, _ := json.MarshalIndent(mk, "", "  ")
		os.WriteFile("tmp/analysis_mufatish.json", b2, 0644)
	}

	rows3, err := config.DB.Query(ctx, "SELECT pengajar_id, bagian_id, peran FROM pengajar_bagian")
	if err == nil {
		defer rows3.Close()
		var pb []map[string]interface{}
		for rows3.Next() {
			var pid, bid int
			var peran string
			rows3.Scan(&pid, &bid, &peran)
			pb = append(pb, map[string]interface{}{"pengajar_id": pid, "bagian_id": bid, "peran": peran})
		}
		b3, _ := json.MarshalIndent(pb, "", "  ")
		os.WriteFile("tmp/analysis_pengajar_bagian.json", b3, 0644)
	}
}

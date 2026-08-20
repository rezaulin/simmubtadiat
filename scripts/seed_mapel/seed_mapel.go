package main

import (
	"context"
	"fmt"
	"log"
	"strings"

	"github.com/mubtadiaat/app/config"
)

type mapelData struct {
	Tingkatan string
	Angkatan  string
	Mapels    []string
}

func main() {
	config.ConnectDB()
	ctx := context.Background()

	data := []mapelData{
		{"Tsanawiyah", "Kelas 1", []string{"Mukhtashor Jiddan", "Al-Khoridah al-Bahiyyah", "Al-Qowa'id al-Shorfiyyah", "Al-Tashrif al-Ishthilahi", "Al-I'lal", "Sullam al-Taufiq", "Bulugh al-Marom", "Fath al-Mubin", "Washoya", "Tuhfah al-Athfal", "Al-Qur'an"}},
		{"Tsanawiyah", "Kelas 2", []string{"Al-Maqshud", "Mutammimah al-Ajurrumiyyah", "Al-Qowa'id al-Shorfiyyah", "Al-Tashrif al-Lughowi", "Fath al-Qorib", "Bulugh al-Marom", "Maslak al-Muhtajiin", "Hujjat Ahli al-Sunnah wa al-Jamaah", "Al-I'lal", "Taisir al-Khollaq", "Matan al-Sanusiyyah", "Hidayah al-Mustafid", "Al-Qur'an"}},
		{"Tsanawiyah", "Kelas 3", []string{"Al-Imrithi", "Fath al-Qorib", "Al-Jazariyyah", "Al-Qur'an", "Bulugh al-Marom", "Tarikh al-Hawadits", "Al-Qowa'id al-Asasiyyah", "Al-Jawahir al-Kalamiyyah", "Qowaid al-Imla'", "Organisasi & Administrasi", "Ta'lim al-Muta'allim", "Uyun al-Masa'il li al-Nisa'"}},
		{"Aliyah", "Kelas 1", []string{"Alfiyah Ibnu Malik", "Al-Baiquniyyah", "Fath al-Mu'in", "Qowa'id al-I'rob / Al-I'rob", "Riyadl al-Sholihin", "Al-Minah al-Saniyyah", "Syarh al-Waroqot", "Al-Kawakib al-Lamma'ah", "Tafsir al-Jalalain"}},
		{"Aliyah", "Kelas 2", []string{"Alfiyah Ibnu Malik", "Fath al-Mu'in", "'Uddah al-Farid", "Tashil al-Thuruqot", "Kifayah al-Awam", "Riyadl al-Sholihin", "Bidayah al-Hidayah", "Tafsir al-Jalalain", "Itmam al-Diroyah", "Mabadi' Qowa'id al-Fiqhiyyah"}},
		{"Aliyah", "Kelas 3", []string{"Al-Jauhar al-Maknun", "Al-Faro'id al-Bahiyyah", "Fath al-Mu'in", "Al-Sullam al-Munawroq", "Salalim al-Fudlola'", "Tafsir al-Jalalain", "Al-'Arudl", "Al-Fajru al-Shodiq", "Riyadl al-Sholihin"}},
		{"I'dadiyah", "Kelas 1", []string{"Baca Tulis Arab", "Baca Tulis Latin", "Ro'sun Sirah", "Fasholatan", "Pengantar Akhlak", "Yanbu'a"}},
		{"I'dadiyah", "Kelas 2", []string{"Al-Ajurrumiyah", "Al-I'rob", "Al-Qowa'id al-Natsriyyah", "Al-Tashrif al-Isthilahii", "Hidayah al-Shibyan", "Aqidah al-Awwam", "Safinah as-Sholah", "Fath al-Mubin", "Al-Akhlaq Li al-Banat", "Al-Qur'an", "Al-Khoth / Al-Imla'"}},
		{"I'dadiyah", "Kelas 3", []string{"Mukhtashor Jiddan", "Al-Qowa'id al-Shorfiyyah", "Al-Tashrif al-Isthilahi", "Sullam at-Taufiq", "Al-Akhlaq Li al-Banat", "Al-Khoridah al-Bahiyyah", "Al-I'lal", "Al-Khoth / Al-Imla'", "Tuhfah al-Athfal", "Al-Qur'an"}},
		{"Ibtidaiyah", "Kelas 3", []string{"Zad al-Mubtadi'", "Fasholatan", "Nadhom al-Mathlab", "Hisab Aba-ja-dun", "Al-Lughoh al-Jawiyyah", "Madarij al-Durus al-Arobiyyah", "Al-Qur'an", "Aswaja dan Ke-NU-an", "Qiro'ah al-Kutub", "Nadhom Birru Walidaikum", "Tarikh al-Anbiya'", "Al-Khoth / Al-Imla'"}},
		{"Ibtidaiyah", "Kelas 4", []string{"Aqidah al-Awwam", "Al-Ajurrumiyah", "Al-Mabadi' al-Fiqhiyyah", "Madarij al-Durus al-Arobiyyah", "Al-Akhlaq Li al-Banat", "Mabadi' al-Tajwid", "Al-Qur'an", "Tarikh Khulafa' al-Rosyidin", "Al-Khoth / Al-Imla'", "Pedoman Ke-NU-an"}},
		{"Ibtidaiyah", "Kelas 5", []string{"Al-Nahwu al-Wadlih", "Ta'lim al-Lughoh al-Arobiyyah", "Hidayah al-Shibyan", "Safinah al-Sholah", "Awamil al-Jurjani", "Al-Akhlaq Li al-Banat", "Al-I'rob", "Al-Khoth / Al-Imla'", "Hadits 101", "Pedoman Ke-NU-an", "Matan Qothrul al-Ghoits", "Al-Qur'an"}},
		{"Ibtidaiyah", "Kelas 6", []string{"Tanwir al-Hija", "Al-Qowa'id al-Natsriyyah", "Al-Tashrif al-Isthilahii", "Al-Nahwu al-Wadlih", "Al-Akhlaq Li al-Banat", "Fath al-Mubin", "Pedoman Ke-NU-an", "Fath al-Rohman", "Al-Qur'an", "Al-Arba'in al-Nawawiyyah", "Al-I'rob", "Ta'lim al-Lughoh al-Arobiyyah", "Matan Ibrahim al-Bajuri", "Haidl dan Permasalahannya"}},
	}

	tingkatanUrutan := 1

	for _, d := range data {
		var tingkatanID int
		err := config.DB.QueryRow(ctx, "SELECT id FROM tingkatan WHERE nama ILIKE $1 LIMIT 1", "%"+d.Tingkatan+"%").Scan(&tingkatanID)
		if err != nil {
			err = config.DB.QueryRow(ctx, "INSERT INTO tingkatan (nama, urutan) VALUES ($1, $2) RETURNING id", d.Tingkatan, tingkatanUrutan).Scan(&tingkatanID)
			if err != nil {
				log.Printf("Gagal insert tingkatan %s: %v", d.Tingkatan, err)
				continue
			}
			tingkatanUrutan++
		}

		var angkatanID int
		err = config.DB.QueryRow(ctx, "SELECT id FROM angkatan WHERE nama ILIKE $1 LIMIT 1", "%"+d.Angkatan+"%").Scan(&angkatanID)
		if err != nil {
			err = config.DB.QueryRow(ctx, "INSERT INTO angkatan (nama, tahun_masuk) VALUES ($1, $2) RETURNING id", d.Angkatan, "2024").Scan(&angkatanID)
			if err != nil {
				log.Printf("Gagal insert angkatan %s: %v", d.Angkatan, err)
				continue
			}
		}

		fmt.Printf("Seeding Mapel untuk %s - %s...\n", d.Tingkatan, d.Angkatan)
		for i, mapel := range d.Mapels {
			// Clear existing similar to avoid dupes? Let's just INSERT
			_, err := config.DB.Exec(ctx, `
				INSERT INTO mata_pelajaran (angkatan_id, tingkatan_id, nama_mapel, urutan, kategori)
				VALUES ($1, $2, $3, $4, 'Khos')
			`, angkatanID, tingkatanID, mapel, i+1)
			if err != nil {
				// if duplicate just ignore, or print
				if !strings.Contains(err.Error(), "duplicate key") {
					log.Printf("Gagal insert mapel %s: %v", mapel, err)
				}
			}
		}
	}

	fmt.Println("Seeding Mata Pelajaran selesai!")
}

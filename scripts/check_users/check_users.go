package main

import (
	"context"
	"fmt"

	"github.com/mubtadiaat/app/config"
	"github.com/mubtadiaat/app/models"
)

func main() {
	config.ConnectDB()

	fmt.Println("GetDashboardStats(pengajar 5):")
	pID := 5
	stats, err := models.GetDashboardStats(context.Background(), "mustahiq", &pID)
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	fmt.Printf("%+v\n", stats)
}

package main

import (
	"context"
	"fmt"
	"time"

	"github.com/mubtadiaat/app/config"
)

func main() {
	// Initialize DB
	config.InitDB("postgres://mubtadiaat:mubtadiaat_secret@localhost:5432/mubtadiaat_db")
	defer config.DB.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	fmt.Println("Starting sync...")
	// Find all teaching roles and their users
	query := `
		WITH teaching_users AS (
			SELECT u.pengajar_id, ur.role,
			       CASE 
			         WHEN ur.role = 'mustahiq' THEN 1 
			         WHEN ur.role = 'muroqib' THEN 2
			         WHEN ur.role = 'mufatish' THEN 3
			         ELSE 4 
			       END as priority
			FROM users u
			JOIN user_roles ur ON u.id = ur.user_id
			WHERE u.pengajar_id IS NOT NULL 
			  AND ur.role IN ('mustahiq', 'muroqib', 'mufatish')
			  AND u.is_active = true
		),
		highest_role AS (
			SELECT pengajar_id, 
			       (array_agg(role ORDER BY priority ASC))[1] as primary_role
			FROM teaching_users
			GROUP BY pengajar_id
		)
		UPDATE pengajar p
		SET status = hr.primary_role
		FROM highest_role hr
		WHERE p.id = hr.pengajar_id 
		  AND (p.status IS NULL OR p.status != hr.primary_role);
	`
	
	res, err := config.DB.Exec(ctx, query)
	if err != nil {
		fmt.Printf("Error updating pengajar status: %v\n", err)
		return
	}
	
	fmt.Printf("Updated %d pengajar records.\n", res.RowsAffected())
	fmt.Println("Sync completed.")
}

# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
# Vite outDir = ../public/dist (lihat vite.config.js) -> output ke /app/public/dist
RUN npm run build

# Stage 2: Build Backend
# Versi Go harus >= directive di go.mod (go 1.26.x).
FROM golang:1.26-alpine AS backend-builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go mod tidy
# Batasi paralelisme kompilasi (GOMAXPROCS=1, -p 1) agar VPS ber-RAM kecil
# tidak kehabisan memori / hang saat merakit aplikasi.
RUN GOMAXPROCS=1 go build -p 1 -o main .
# Binary runner migrasi (dipakai entrypoint untuk auto-migrate saat start)
RUN GOMAXPROCS=1 go build -p 1 -o migrate-runner ./scripts/migrate-all

# Stage 3: Final Image
FROM alpine:latest
WORKDIR /app

# Binary aplikasi + runner migrasi
COPY --from=backend-builder /app/main .
COPY --from=backend-builder /app/migrate-runner .

# Frontend hasil build (Vite menaruhnya di /app/public/dist)
COPY --from=frontend-builder /app/public/dist ./public/dist

# Berkas migrasi + baseline + entrypoint (untuk auto-migrate saat container start)
COPY migrations ./migrations
COPY db ./db
COPY docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["./docker-entrypoint.sh"]

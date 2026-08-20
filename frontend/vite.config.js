/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.{test,spec}.{js,mjs,ts}', 'src/**/*.{test,spec}.{js,mjs,ts}'],
  },
  build: {
    outDir: '../public/dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        santri: resolve(__dirname, 'santri.html'),
        kelas: resolve(__dirname, 'kelas.html'),
        penilaian: resolve(__dirname, 'penilaian.html'),
        absensi: resolve(__dirname, 'absensi.html'),
        alumni: resolve(__dirname, 'alumni.html'),
        arsip: resolve(__dirname, 'arsip.html'),
        login: resolve(__dirname, 'login.html'),
        pengajar: resolve(__dirname, 'pengajar.html'),
        dewanHarian: resolve(__dirname, 'dewan-harian.html'),
        perpindahan: resolve(__dirname, 'perpindahan.html'),
        rapot: resolve(__dirname, 'rapot.html'),
        rekap: resolve(__dirname, 'rekap.html'),
        settings: resolve(__dirname, 'settings.html'),
        changePassword: resolve(__dirname, 'change-password.html'),
        profilSantri: resolve(__dirname, 'profil-santri.html'),
        catatan: resolve(__dirname, 'catatan.html'),
        absensiManual: resolve(__dirname, 'absensi-manual.html'),
        pengajarPurna: resolve(__dirname, 'pengajar-purna.html'),
      }
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
});

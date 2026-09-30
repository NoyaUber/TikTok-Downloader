# TikDown v2.0 — TikTok Downloader for Vercel

Aplikasi web modern untuk mengunduh video TikTok tanpa watermark, audio MP3, dan foto slide secara gratis dan cepat. Dioptimalkan khusus untuk deployment di **Vercel** tanpa memerlukan dependensi binary eksternal seperti `yt-dlp`.

---

## 🚀 Fitur Unggulan v2.0
- **100% Vercel Ready**: Tidak memerlukan instalasi `yt-dlp` atau C++ compiler di server.
- **Serverless API Multi-Provider**: Dilengkapi dengan sistem pemroses utama dan fallback otomatis jika API utama mengalami kegagalan.
- **Media Stream Proxy**: Mengatasi masalah CORS / Hotlinking blocking dari CDN TikTok sehingga file diunduh langsung ke perangkat pengakses.
- **Dukungan Lengkap**:
  - MP4 Video Tanpa Watermark (HD & Standard)
  - MP4 Video Dengan Watermark
  - File Audio MP3
  - Gallery Foto Slide Post TikTok
- **UI/UX Modern**: Desain Glassmorphism dengan Dark Mode yang responsif dan cepat.

---

## 🛠️ Struktur Project
```text
tikdown/
├── api/
│   └── index.js       # Express App & Serverless API Handler Vercel
├── index.html         # Tampilan Antarmuka (Frontend UI)
├── style.css          # Style CSS Modern Glassmorphism
├── script.js          # Logic Client-side & Fetch Handler
├── server.js          # Server Entrypoint untuk Lokal Development
├── package.json       # Project Dependencies
├── vercel.json        # Konfigurasi Routing Vercel
└── README.md
```

---

## 📦 Jalankan di Lokal (Local Development)

1. Pastikan Anda sudah menginstal Node.js (versi 18 ke atas).
2. Install dependency:
   ```bash
   npm install
   ```
3. Jalankan server lokal:
   ```bash
   npm start
   # atau untuk mode dev dengan watch:
   npm run dev
   ```
4. Buka di browser: `http://localhost:3000`

---

## ☁️ Deployment ke Vercel

Aplikasi ini dapat langsung dideploy ke Vercel tanpa konfigurasi tambahan!

### Opsi A: Menggunakan Vercel CLI
1. Install Vercel CLI jika belum: `npm i -g vercel`
2. Jalankan perintah:
   ```bash
   vercel
   ```

### Opsi B: Menggunakan GitHub / GitLab Integration
1. Push project ini ke repository GitHub/GitLab Anda.
2. Buka dashboard Vercel ([vercel.com](https://vercel.com)) -> Klik **New Project**.
3. Import repository Anda dan klik **Deploy**.
4. Selesai! Vercel secara otomatis mengenali file `vercel.json` dan folder `api/`.

---

## 📄 Lisensi & Disclaimer
Proyek ini dibuat hanya untuk tujuan pembelajaran dan penggunaan pribadi yang sah. Mohon hargai hak cipta para kreator konten TikTok.

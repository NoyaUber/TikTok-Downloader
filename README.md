# TikDown v2.0 — TikTok Downloader for Vercel

Aplikasi web modern untuk mengunduh video TikTok tanpa watermark, audio MP3, dan foto slide secara gratis dan cepat. Dioptimalkan khusus untuk deployment di **Vercel** tanpa memerlukan dependensi binary eksternal seperti `yt-dlp`.

---

## 🚀 Fitur Unggulan v2.0
- **100% Vercel Ready**: Tidak memerlukan instalasi `yt-dlp` atau C++ compiler di server.
- **Serverless API Multi-Provider**: Dilengkapi dengan sistem pemroses utama dan fallback otomatis jika API utama mengalami kegagalan.
- **Media Stream Proxy**: Mengatasi masalah CORS / Hotlinking blocking dari CDN TikTok sehingga file diunduh langsung ke perangkat pengakses. Media di-*stream* (bukan di-buffer) agar file besar tidak membuat server kehabisan memori.
- **Serverless Ready**: Routing handled by Vercel zero-config, halaman `/` tidak lagi error `Cannot GET /`.
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
│   ├── download.js    # Serverless Function: POST /api/download
│   ├── proxy.js       # Serverless Function: GET /api/proxy (streaming media)
│   └── health.js      # Serverless Function: GET /api/health
├── lib/
│   ├── tiktok.js      # Core logika: provider TikWM + Tiklydown, payload builder
│   └── handlers.js    # Request handler yang dipakai bersama Vercel & lokal
├── index.html         # Tampilan Antarmuka (Frontend UI)
├── style.css          # Style CSS Modern Glassmorphism
├── script.js          # Logic Client-side & Fetch Handler
├── server.js          # Server Express untuk Lokal Development
├── package.json       # Project Dependencies
├── vercel.json        # Konfigurasi Functions Vercel
└── README.md
```

### Cara Kerja Routing di Vercel

Berkas statis (`index.html`, `style.css`, `script.js`) dilayani langsung oleh
Vercel, sedangkan folder `api/` otomatis menjadi Serverless Functions. Tidak
perlu `routes`/`builds` manual, sehingga halaman `/` tidak lagi dialihkan ke
function dan tidak muncul error `Cannot GET /`.

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
4. Jika pernah mengubah `vercel.json`, `package.json`, atau struktur folder `api/`,
   bersihkan cache build lama dengan:
   ```bash
   vercel --force
   ```

### Opsi B: Menggunakan GitHub / GitLab Integration
1. Push project ini ke repository GitHub/GitLab Anda.
2. Buka dashboard Vercel ([vercel.com](https://vercel.com)) -> Klik **New Project**.
3. Import repository Anda dan klik **Deploy**.
4. Selesai! Vercel otomatis menyajikan berkas statis dari root repo dan mengenali
   folder `api/` sebagai Serverless Functions.

### Endpoint API

| Method | Endpoint              | Keterangan                                   |
| ------ | --------------------- | -------------------------------------------- |
| POST   | `/api/download`       | Ambil metadata + link unduhan dari TikTok URL |
| GET    | `/api/proxy`          | Streaming media dari CDN (anti hotlink/CORS) |
| GET    | `/api/health`         | Health check service                         |

---

## 📄 Lisensi & Disclaimer
Proyek ini dibuat hanya untuk tujuan pembelajaran dan penggunaan pribadi yang sah. Mohon hargai hak cipta para kreator konten TikTok.

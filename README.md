# ORBYTE — Website Crypto Market

Landing page crypto market dengan animasi partikel, harga crypto live (CoinGecko), Swap & Bridge (estimasi),
dan asisten AI (Claude) yang menjawab memakai harga terbaru. Siap di-upload ke **Vercel**.

```
orbyte/
├── public/              ← website (index.html, favicon, ikon)
├── api/                 ← fungsi server untuk Vercel
│   ├── chat.js          ← POST /api/chat     → jawaban ORBYTE AI
│   ├── markets.js       ← GET  /api/markets  → harga live (cache 60 detik)
│   └── health.js        ← GET  /api/health   → cek AI aktif atau tidak
├── lib/
│   ├── brief.js         ← "otak" asisten: fakta & aturan menjawab (edit di sini)
│   ├── markets.js       ← ambil & simpan harga dari CoinGecko
│   └── chat.js          ← validasi, batas pemakaian, streaming ke Claude
├── server.js            ← hanya untuk menjalankan di komputer sendiri (npm start)
├── vercel.json          ← pengaturan Vercel
└── package.json
```

---

## A. Upload ke Vercel (disarankan)

Siapkan dulu:
- Akun **GitHub** (github.com) dan akun **Vercel** (vercel.com, daftar pakai akun GitHub)
- **API key Claude** dari https://console.anthropic.com → *API Keys* (akun perlu saldo/kredit)

### Langkah 1 — Upload ke GitHub
1. Buka github.com → tombol **New** (repository baru) → beri nama, misalnya `orbyte` → **Create repository**.
2. Di halaman repo yang masih kosong, klik **uploading an existing file**.
3. Ekstrak `orbyte.zip` di komputer, buka folder `orbyte`, lalu **seret semua isinya**
   (folder `public`, `api`, `lib`, dan file `package.json`, `vercel.json`, dll.) ke halaman GitHub.
   Yang diseret adalah *isi* folder, bukan folder `orbyte`-nya.
4. Klik **Commit changes**.

### Langkah 2 — Hubungkan ke Vercel
1. Buka vercel.com → **Add New… → Project**.
2. Pilih repo `orbyte` → **Import**.
3. *Framework Preset*: biarkan **Other**. Jangan ubah Build/Output (sudah diatur `vercel.json`).
4. Buka **Environment Variables**, tambahkan:
   - Name: `ANTHROPIC_API_KEY` → Value: `sk-ant-...` (API key kamu)
5. Klik **Deploy**. Tunggu ±1 menit.

Selesai. Kamu dapat link seperti `https://orbyte-xxxx.vercel.app`.

### Cek hasilnya
- Bagian **Live markets** menampilkan titik hijau "Live · updated …"
- **Swap & Bridge** menghitung estimasi saat jumlah diketik
- Tombol **Ask ORBYTE AI** muncul di kanan bawah
- Buka `https://<domain-kamu>/api/health` → harus muncul `{"ok":true}`

Kalau `{"ok":false}`: API key belum terbaca. Cek Environment Variables di Vercel
(Settings → Environment Variables), lalu **Redeploy** (Deployments → ⋯ → Redeploy).

### Mengubah isi setelah online
Edit file di GitHub (misalnya `lib/brief.js` atau `public/index.html`) → **Commit** →
Vercel otomatis deploy ulang dalam ±1 menit.

### Domain sendiri
Vercel → Project → **Settings → Domains** → masukkan domain (mis. `orbyte.app`) dan ikuti instruksi DNS-nya.

---

## B. Jalankan di komputer sendiri
1. Install **Node.js 18+** dari https://nodejs.org
2. Salin `.env.example` menjadi `.env`, isi `ANTHROPIC_API_KEY=sk-ant-...`
3. Jalankan `npm start`, buka http://localhost:3000

---

## Pengaturan opsional (Environment Variables)

| Nama | Default | Fungsi |
|---|---|---|
| `ANTHROPIC_MODEL` | `claude-haiku-5-5` | Model Claude. Ganti ke `claude-sonnet-5-5` untuk jawaban lebih pintar |
| `MAX_TOKENS` | `400` | Batas panjang satu jawaban |
| `RATE_LIMIT` / `RATE_WINDOW_MIN` | `20` / `10` | Maks. 20 pertanyaan per pengunjung tiap 10 menit |
| `COINGECKO_API_KEY` | – | Demo key CoinGecko (gratis) untuk trafik tinggi |

Di Vercel, batas pertanyaan dihitung per server-instance (Vercel bisa menjalankan beberapa sekaligus),
jadi anggap sebagai rem darurat. **Pasang batas pengeluaran (spend limit) di console.anthropic.com.**

## Harga live
- 12 aset: BTC, ETH, SOL, BNB, XRP, ADA, DOGE, AVAX, LINK, TON, USDT, USDC — USD atau IDR, diperbarui tiap 60 detik.
- Server mengambil dari CoinGecko dan menyimpannya 60 detik (di Vercel juga di-cache di CDN), jadi hemat kuota.
- Mengganti daftar koin: ubah `COINS` di `lib/markets.js` **dan** di `public/index.html`.

## Swap & Bridge
- Estimasi dari harga live: jumlah diterima, kurs, *minimum received* sesuai slippage.
- **Belum ada transaksi sungguhan** (tombol "coming soon"). Transaksi asli butuh integrasi wallet
  (MetaMask/WalletConnect) dan agregator (mis. LI.FI), plus audit keamanan.

## Mengubah jawaban asisten
Edit teks di `lib/brief.js` (produk, prinsip, kontak, aturan). Instruksi ini hanya ada di server,
pengunjung tidak bisa melihat atau mengubahnya. Asisten diatur untuk **tidak** memberi saran beli/jual
atau prediksi harga.

## Keamanan
- API key hanya di server (Environment Variables), tidak pernah dikirim ke browser.
  **Jangan pernah menulis API key di `public/index.html` atau meng-upload file `.env` ke GitHub.**
- Batas panjang pesan (1.000 karakter) dan riwayat (12 pesan terakhir).
- Kalau pengunjung menutup chat di tengah jawaban, permintaan ke Claude ikut dihentikan.

## Catatan legal
Teks produk ORBYTE dan email `hello@orbyte.app` adalah contoh. Sesuaikan dengan layanan yang benar-benar
tersedia dan aturan di negaramu (di Indonesia, perdagangan aset kripto diawasi OJK).
Disclaimer risiko di footer sebaiknya tetap dipertahankan.

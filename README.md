# Finora — Smart Personal Finance (PWA)

Aplikasi pencatatan keuangan pribadi berbasis Progressive Web App (PWA) yang dapat dipasang langsung di HP Android maupun iPhone.

## Fitur Utama
- **Beranda**: Ringkasan saldo kas, pemasukan & pengeluaran bulanan, tren pengeluaran 7 hari, dan transaksi terkini.
- **Mutasi**: Pencarian, filter tipe/kategori/dompet, serta detail & hapus transaksi.
- **Catat**: Input transaksi pemasukan/pengeluaran lengkap dengan kategori, dompet, tanggal, label, dan lampiran struk.
- **Budget**: Monitoring batas anggaran bulanan per kategori dan pengelolaan saldo dompet.
- **Laporan**: Rekap periode mingguan/bulanan, distribusi kategori, dan ekspor langsung ke **`.CSV`** dan **`.XLS`**.
- **Installable PWA**: Mendukung *Add to Home Screen* di Android & iOS serta mode offline melalui Service Worker (`sw.js`).

## Menjalankan Secara Lokal
```bash
python3 -m http.server 5502 --bind 127.0.0.1
```
Lalu buka http://127.0.0.1:5502/ di browser.

## Memasang di HP
- **Android (Chrome)**: Buka URL aplikasi HTTPS → ketuk **Pasang** atau menu **⋮ → Tambahkan ke layar utama / Install App**.
- **iPhone / iPad (Safari)**: Buka URL aplikasi HTTPS → ketuk ikon **Bagikan (Share)** → **Tambah ke Layar Utama (Add to Home Screen)**.

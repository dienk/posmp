# Panduan Instalasi — POSMerahPutih

Cara memasang aplikasi kasir **POSMerahPutih** di **macOS**, **Windows**, dan
**Android**. Aplikasi bekerja **100% offline** — semua data tersimpan di perangkat
Anda.

**Di mana mengunduh installer?**
- **Releases** GitHub: `https://github.com/dienk/posmp/releases` (installer terbaru), atau
- **Actions → run terbaru → Artifacts** (hasil build otomatis).

Nama berkas mengikuti pola versi, mis. `POSMerahPutih_1.5.0_...`.

---

## 🍎 macOS (`.dmg`)

1. Unduh `POSMerahPutih_<versi>_universal.dmg` (cocok untuk Apple Silicon **dan** Intel).
2. Klik dua kali file `.dmg` → **seret ikon POSMerahPutih ke folder Applications**.
3. Buka dari **Launchpad** atau folder Applications.

> **"Aplikasi dari pengembang tak dikenal"** — jika muncul saat pertama membuka
> (installer belum di-*notarize*): klik kanan ikon aplikasi → **Open** → **Open**.
> Atau: **System Settings → Privacy & Security** → tombol **Open Anyway**. Cukup sekali.

---

## 🪟 Windows (`.msi` atau `.exe`)

**Pilihan A — Installer `.exe` (NSIS, disarankan):**
1. Unduh `POSMerahPutih_<versi>_x64-setup.exe`.
2. Klik dua kali → ikuti wizard → aplikasi terpasang untuk pengguna saat ini +
   pintasan Start Menu/Desktop.

**Pilihan B — `.msi`:**
1. Unduh `POSMerahPutih_<versi>_x64_en-US.msi` → klik dua kali → **Next** hingga selesai.

> **"Windows protected your PC" (SmartScreen)** — jika muncul (installer belum
> ditandatangani sertifikat): klik **More info** → **Run anyway**.
>
> **WebView2** — dibutuhkan (sudah tersedia default di Windows 10/11). Bila diminta,
> pasang *Microsoft Edge WebView2 Runtime* dari situs Microsoft.

---

## 🤖 Android (`.apk`)

1. Unduh `app-debug.apk` (atau `app-release.apk` bila tersedia) ke perangkat.
2. Buka file → Android meminta izin **"Install unknown apps"**:
   - **Settings → Apps → Special access → Install unknown apps** → pilih peramban/File
     Manager yang dipakai → aktifkan **Allow from this source**.
3. Kembali, ketuk **Install** → **Open**.

> **APK vs AAB** — pasang **`.apk`** langsung di perangkat. Berkas **`.aab`** hanya
> untuk **unggah ke Google Play Console**, bukan untuk dipasang manual.
>
> **APK debug** cocok untuk uji coba/pemakaian internal. Untuk distribusi luas,
> gunakan APK/AAB **release** yang sudah ditandatangani (lihat [BUILD.md](BUILD.md)).

---

## Setelah terpasang

- **Pertama kali dibuka**: aplikasi menyiapkan database lokal + data awal (produk,
  kategori, meja contoh). Login memakai persona/PIN sesuai pengaturan.
- **Data aman di perangkat**: gunakan **Setelan → Cadangan Otomatis** untuk backup
  terjadwal, dan **Setelan → Koneksi Database** untuk ekspor/impor `.sqlite`.
- **Beberapa perangkat dalam 1 jaringan**: aktifkan **Relay LAN** di Koneksi Database
  (opsional) agar kasir & self-order tersinkron real-time.

## Uninstall

- **macOS**: seret aplikasi dari Applications ke Trash.
- **Windows**: **Settings → Apps → Installed apps → POSMerahPutih → Uninstall**.
- **Android**: tekan lama ikon → **Uninstall**, atau **Settings → Apps → POSMerahPutih**.

> Uninstall dapat menghapus data lokal. **Backup dulu** (ekspor `.sqlite`) bila ingin
> memindahkan data ke perangkat lain.

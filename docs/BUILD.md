# Panduan Build Installer — POSMerahPutih

Panduan membuat **installer** POSMerahPutih untuk **macOS**, **Windows**, dan
**Android**. Aplikasi ini *local-first*: seluruh data (SQLite via sql.js) hidup di
perangkat dan berfungsi penuh tanpa internet, sehingga installer-nya berupa aplikasi
native mandiri.

| Platform | Teknologi | Hasil |
|----------|-----------|-------|
| macOS    | [Tauri v2](https://tauri.app) | `.dmg` (universal: Apple Silicon + Intel) & `.app` |
| Windows  | Tauri v2  | `.msi` & setup `.exe` (NSIS) |
| Android  | [Capacitor 6](https://capacitorjs.com) | `.apk` (sideload) & `.aab` (Play Store) |

> **Cara tercepat & paling andal: pakai GitHub Actions** (lihat
> [§4](#4-build-otomatis-github-actions)). CI membangun ketiga installer di runner
> OS yang benar — tanpa perlu menyiapkan toolchain lokal. Windows **tidak bisa**
> di-cross-compile dari macOS/Linux, jadi CI adalah jalur yang disarankan.

---

## 1. Prasyarat umum

- **Node.js 20+** dan npm.
- Kode ter-checkout & dependensi terpasang:
  ```bash
  npm ci
  npm run build      # WAJIB lolos — menghasilkan folder dist/ (web bundle)
  ```

Ikon aplikasi sudah disediakan di `src-tauri/icons/`. Untuk membangkitkan ulang dari
logo (`public/logo-mark.png`):
```bash
npm run icons        # = tauri icon public/logo-mark.png (png/ico/icns lengkap)
```

---

## 2. Desktop (macOS & Windows) — Tauri

### Prasyarat
- **Rust** (stable) — pasang via [rustup](https://rustup.rs).
- **macOS**: Xcode Command Line Tools (`xcode-select --install`).
- **Windows**: Microsoft C++ Build Tools + WebView2 Runtime (umumnya sudah ada di
  Windows 10/11).
- Tauri CLI sudah menjadi devDependency (`@tauri-apps/cli`).

### Build
```bash
# macOS — universal (Apple Silicon + Intel)
rustup target add aarch64-apple-darwin x86_64-apple-darwin
npm run tauri:build -- --target universal-apple-darwin

# Windows (dijalankan DI Windows)
npm run tauri:build
```

### Lokasi hasil
```
src-tauri/target/**/release/bundle/
  ├─ dmg/POSMerahPutih_1.5.0_universal.dmg      (macOS)
  ├─ macos/POSMerahPutih.app                    (macOS)
  ├─ msi/POSMerahPutih_1.5.0_x64_en-US.msi      (Windows)
  └─ nsis/POSMerahPutih_1.5.0_x64-setup.exe     (Windows)
```

### Penandatanganan (opsional, untuk distribusi publik)
- **macOS**: butuh Apple Developer ID untuk *code signing* + *notarization* agar
  tidak diblok Gatekeeper. Set env `APPLE_CERTIFICATE`, `APPLE_SIGNING_IDENTITY`,
  `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` (didukung `tauri-action`).
- **Windows**: butuh sertifikat *code signing* (Authenticode). Tanpa itu, Windows
  SmartScreen menampilkan peringatan (aplikasi tetap bisa dipasang — lihat
  [INSTALL.md](INSTALL.md)).

---

## 3. Android — Capacitor

### Prasyarat
- **JDK 21** (Temurin/OpenJDK).
- **Android SDK** (Android Studio, atau command-line tools) + variabel
  `ANDROID_HOME`/`ANDROID_SDK_ROOT`.

### Build
```bash
npm run build                 # web bundle → dist/
npm run android:add           # sekali saja: bangkitkan proyek android/ (npx cap add android)
npm run android:sync          # build web + cap sync android

# APK debug (langsung dapat di-install / sideload)
npm run android:apk           # → android/app/build/outputs/apk/release|debug/*.apk
# atau langsung: cd android && ./gradlew assembleDebug

# AAB (untuk Google Play)
npm run android:aab           # → android/app/build/outputs/bundle/release/*.aab
```

Folder `android/` di-generate oleh Capacitor dan **tidak di-commit** — dibangkitkan
ulang dari `capacitor.config.ts` (appId `id.posmerahputih.pos`).

### Penandatanganan rilis
`assembleRelease`/`bundleRelease` butuh *keystore*. Buat sekali:
```bash
keytool -genkey -v -keystore posmp.keystore -alias posmp \
  -keyalg RSA -keysize 2048 -validity 10000
```
lalu tandatangani lewat `signingConfig` di `android/app/build.gradle`, atau via
properti Gradle `-Pandroid.injected.signing.*` (lihat workflow CI). APK **debug**
sudah bisa dipasang untuk uji coba tanpa keystore.

---

## 4. Build otomatis (GitHub Actions)

Dua workflow tersedia di `.github/workflows/`:

| Workflow | File | Hasil |
|----------|------|-------|
| Desktop (macOS & Windows) | `desktop.yml` | `.dmg`, `.app`, `.msi`, `.exe` |
| Android | `android.yml` | `.apk` (debug), `.apk`/`.aab` (release bila keystore diisi) |

**Cara menjalankan:**
- **Otomatis** — push tag versi:
  ```bash
  git tag v1.5.0 && git push origin v1.5.0
  ```
  Desktop akan sekaligus membuat **GitHub Release (draft)** berisi installer.
- **Manual** — buka tab **Actions** di GitHub → pilih workflow → **Run workflow**.

**Mengunduh hasil:** buka run yang selesai → bagian **Artifacts** (`posmp-macos-latest`,
`posmp-windows-latest`, `posmp-android`). Untuk rilis dari tag, installer desktop juga
muncul di halaman **Releases**.

**Secret untuk rilis Android bertanda tangan** (opsional, Settings → Secrets → Actions):
`ANDROID_KEYSTORE_BASE64` (isi: `base64 -i posmp.keystore`), `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

---

## 5. Menaikkan versi

Selaraskan versi di tiga tempat sebelum rilis:
- `package.json` → `"version"`
- `src-tauri/tauri.conf.json` → `"version"`
- `src-tauri/Cargo.toml` → `version`

lalu buat tag `vX.Y.Z` yang sama.

---

## 6. Catatan arsitektur

- Aplikasi memuat **web bundle yang sama** (`dist/`) di dalam WebView native — tidak
  ada server. Database SQLite berjalan di dalam WebView (sql.js WASM di-bundle lokal,
  dipersist ke IndexedDB), jadi installer sepenuhnya offline.
- Relay LAN opsional (`npm run relay`) untuk sinkron antar-perangkat tetap berjalan
  terpisah dan tidak dibutuhkan installer.

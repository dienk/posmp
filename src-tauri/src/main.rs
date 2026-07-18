// POSMerahPutih desktop (Tauri v2). Membungkus aplikasi web local-first sebagai
// aplikasi desktop native. Database SQLite tetap berjalan di WebView (sql.js/OPFS).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("gagal menjalankan aplikasi POSMerahPutih");
}

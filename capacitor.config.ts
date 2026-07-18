import type { CapacitorConfig } from '@capacitor/cli'

// POSMerahPutih mobile (Capacitor). Membungkus build web sebagai aplikasi
// Android/iOS native. Untuk kasir mobile & self-order berbasis perangkat.
const config: CapacitorConfig = {
  appId: 'id.posmerahputih.pos',
  appName: 'POSMerahPutih',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config

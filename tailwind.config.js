/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palet visual POSMerahPutih (PRD v1.5)
        brand: {
          DEFAULT: '#CFC6D9', // ungu pucat keabu-abuan - CTA utama
          soft: '#E4DEEC',
          strong: '#B4A7C7',
        },
        background: '#F2E0D4', // krem terang - latar
        surface: '#F2C6A1', // persik - kartu produk & panel keranjang
        ink: {
          DEFAULT: '#717888', // abu-abu gelap - teks utama
          soft: '#D9ABA0', // merah muda kecoklatan - teks sekunder
        },
        status: {
          empty: '#4CAF50', // meja kosong (hijau)
          occupied: '#E53935', // meja terisi (merah)
          waiting: '#FBC02D', // menunggu tagihan (kuning)
        },
      },
      borderRadius: {
        card: '12px',
      },
      boxShadow: {
        panel: '-4px 0 16px -6px rgba(113, 120, 136, 0.25)',
        card: '0 2px 8px -2px rgba(113, 120, 136, 0.2)',
      },
    },
  },
  plugins: [],
}

import type { Database } from 'sql.js'
import { PRODUCT_PHOTOS } from './productPhotos'

/**
 * Data awal untuk demo Milestone 1: satu outlet, kategori F&B,
 * katalog produk beserta stok, satu layout meja, dan app_settings default.
 */
export function seedDatabase(db: Database): void {
  db.run('BEGIN')

  db.run(
    `INSERT INTO outlets (name, address, phone, is_active)
     VALUES ('POSMerahPutih Pusat', 'Jl. Merdeka No. 17, Jakarta', '021-5550100', 1)`,
  )

  // Dua titik kasir untuk outlet pusat.
  db.run(
    `INSERT INTO cashiers (outlet_id, name, code, location, is_active) VALUES
       (1, 'Kasir 1', 'KSR-01', 'Depan', 1),
       (1, 'Kasir 2', 'KSR-02', 'Drive-Thru', 1)`,
  )

  // Gudang utama (default) untuk outlet pusat — dipakai kasir untuk potong stok.
  db.run(
    `INSERT INTO warehouses (outlet_id, name, code, location, is_default, is_active)
     VALUES (1, 'Gudang Utama', 'GDG-01', 'Toko', 1, 1)`,
  )

  const categories: Array<[string, string]> = [
    ['Makanan', '#F2C6A1'],
    ['Minuman', '#CFC6D9'],
    ['Snack', '#D9ABA0'],
    ['Kopi', '#C4A484'],
    ['Dessert', '#F4C2D7'],
  ]
  for (const [name, color] of categories) {
    db.run('INSERT INTO categories (name, color_code) VALUES (?, ?)', [name, color])
  }

  // Meta gambar per kategori: [prefix SKU, warna gradien atas, warna gradien bawah].
  const catMeta: Record<number, [string, string, string]> = {
    1: ['MKN', '#FB923C', '#EA580C'],
    2: ['MNM', '#60A5FA', '#2563EB'],
    3: ['SNK', '#FBBF24', '#D97706'],
    4: ['KOP', '#A16207', '#78350F'],
    5: ['DST', '#F472B6', '#DB2777'],
  }

  // Gambar produk contoh: SVG data-URI mandiri (tanpa file/CDN, aman offline) —
  // kartu gradien + emoji + nama produk.
  function productImg(emoji: string, c1: string, c2: string, label: string): string {
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'>` +
      `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
      `<stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient></defs>` +
      `<rect width='400' height='400' fill='url(#g)'/>` +
      `<text x='200' y='196' font-size='170' text-anchor='middle' dominant-baseline='central'>${emoji}</text>` +
      `<text x='200' y='350' font-family='Nunito Sans,Segoe UI,sans-serif' font-size='30' ` +
      `font-weight='800' fill='#ffffff' text-anchor='middle' opacity='0.95'>${label}</text>` +
      `</svg>`
    return 'data:image/svg+xml,' + encodeURIComponent(svg)
  }

  // [nama, emoji, harga, modal, satuan, category_id, stok]
  const products: Array<[string, string, number, number, string, number, number]> = [
    // Makanan
    ['Nasi Goreng Spesial', '🍛', 25000, 15000, 'porsi', 1, 50],
    ['Mie Goreng', '🍜', 20000, 12000, 'porsi', 1, 40],
    ['Ayam Penyet', '🍗', 30000, 18000, 'porsi', 1, 35],
    ['Ayam Geprek', '🌶️', 28000, 16000, 'porsi', 1, 40],
    ['Soto Ayam', '🍲', 22000, 12000, 'porsi', 1, 30],
    ['Bakso Urat', '🍜', 25000, 14000, 'porsi', 1, 45],
    ['Mie Ayam', '🍜', 20000, 11000, 'porsi', 1, 40],
    ['Nasi Uduk', '🍚', 18000, 9000, 'porsi', 1, 35],
    ['Gado-Gado', '🥗', 20000, 10000, 'porsi', 1, 25],
    ['Nasi Rendang', '🍛', 32000, 20000, 'porsi', 1, 30],
    // Minuman
    ['Es Teh Manis', '🧊', 5000, 2000, 'gelas', 2, 100],
    ['Es Jeruk', '🍊', 10000, 4000, 'gelas', 2, 70],
    ['Air Mineral', '💧', 5000, 3000, 'botol', 2, 120],
    ['Teh Tarik', '🍵', 12000, 5000, 'gelas', 2, 60],
    ['Lemon Tea', '🍋', 13000, 6000, 'gelas', 2, 50],
    ['Es Coklat', '🍫', 15000, 7000, 'gelas', 2, 55],
    ['Jus Alpukat', '🥑', 18000, 9000, 'gelas', 2, 40],
    ['Jus Mangga', '🥭', 16000, 8000, 'gelas', 2, 45],
    ['Soda Gembira', '🥤', 14000, 6000, 'gelas', 2, 40],
    // Snack
    ['Tahu Walik', '🧈', 15000, 8000, 'porsi', 3, 60],
    ['Pisang Goreng', '🍌', 12000, 6000, 'porsi', 3, 45],
    ['Kentang Goreng', '🍟', 18000, 9000, 'porsi', 3, 50],
    ['Cireng Rujak', '🫓', 13000, 6000, 'porsi', 3, 40],
    ['Risoles Mayo', '🥟', 14000, 7000, 'porsi', 3, 35],
    ['Roti Bakar Coklat', '🍞', 15000, 7000, 'porsi', 3, 40],
    ['Onion Ring', '🧅', 16000, 8000, 'porsi', 3, 30],
    // Kopi
    ['Espresso', '☕', 15000, 6000, 'gelas', 4, 50],
    ['Cappuccino', '☕', 22000, 9000, 'gelas', 4, 45],
    ['Caffe Latte', '☕', 23000, 10000, 'gelas', 4, 45],
    ['Americano', '☕', 18000, 7000, 'gelas', 4, 40],
    ['Kopi Tubruk', '☕', 12000, 5000, 'gelas', 4, 60],
    ['Es Kopi Susu Aren', '🧋', 20000, 8000, 'gelas', 4, 70],
    ['Mochaccino', '☕', 25000, 11000, 'gelas', 4, 35],
    // Dessert
    ['Puding Coklat', '🍮', 12000, 5000, 'porsi', 5, 40],
    ['Es Krim Vanila', '🍨', 15000, 6000, 'porsi', 5, 45],
    ['Brownies', '🍫', 16000, 7000, 'porsi', 5, 35],
    ['Pancake Madu', '🥞', 20000, 9000, 'porsi', 5, 30],
    ['Choco Lava', '🍰', 22000, 10000, 'porsi', 5, 25],
  ]
  const seq: Record<number, number> = {}
  const pid: Record<string, number> = {} // nama produk -> id (untuk komponen bundling)
  let barcodeNo = 8991234000000
  for (const [name, emoji, price, cost, unit, categoryId, stock] of products) {
    const [prefix, c1, c2] = catMeta[categoryId]
    seq[categoryId] = (seq[categoryId] ?? 0) + 1
    const sku = `${prefix}-${String(seq[categoryId]).padStart(3, '0')}`
    barcodeNo += 1
    const label = name.length > 16 ? name.slice(0, 15) + '…' : name
    // Foto real (Wikimedia Commons, ditanam) bila tersedia; selain itu placeholder SVG.
    const img = PRODUCT_PHOTOS[name] ?? productImg(emoji, c1, c2, label)
    db.run(
      `INSERT INTO products (category_id, name, sku, barcode, price, cost_price, unit, min_stock, is_active, image_path, images)
       VALUES (?, ?, ?, ?, ?, ?, ?, 10, 1, ?, ?)`,
      [categoryId, name, sku, String(barcodeNo), price, cost, unit, img, JSON.stringify([img])],
    )
    const productId = db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0] as number
    pid[name] = productId
    db.run(
      `INSERT INTO outlet_stocks (outlet_id, warehouse_id, product_id, stock)
       VALUES (1, 1, ?, ?)`,
      [productId, stock],
    )
  }

  // Paket bundling contoh: produk is_bundle=1 (tanpa stok sendiri) + komponennya.
  // Stok saat dijual dipotong dari komponen (lihat bundlesRepository/CLAUDE.md).
  const bundles: Array<{ name: string; price: number; comps: Array<[string, number]> }> = [
    { name: 'Paket Hemat Ayam Geprek', price: 30000, comps: [['Ayam Geprek', 1], ['Es Teh Manis', 1]] },
    { name: 'Paket Nasi Goreng Komplit', price: 31000, comps: [['Nasi Goreng Spesial', 1], ['Es Jeruk', 1]] },
    { name: 'Paket Bakso Mantap', price: 27000, comps: [['Bakso Urat', 1], ['Es Teh Manis', 1]] },
    { name: 'Paket Sarapan Nusantara', price: 26000, comps: [['Nasi Uduk', 1], ['Teh Tarik', 1]] },
    { name: 'Paket Ngopi Santai', price: 33000, comps: [['Cappuccino', 1], ['Brownies', 1]] },
    { name: 'Paket Ngemil Berdua', price: 55000, comps: [['Kentang Goreng', 1], ['Onion Ring', 1], ['Es Coklat', 2]] },
  ]
  let bundleSeq = 0
  for (const b of bundles) {
    bundleSeq += 1
    barcodeNo += 1
    db.run(
      `INSERT INTO products (category_id, name, sku, barcode, price, cost_price, unit, min_stock, is_active, image_path, images, is_bundle)
       VALUES (NULL, ?, ?, ?, ?, 0, 'paket', 0, 1, NULL, NULL, 1)`,
      [b.name, `PKT-${String(bundleSeq).padStart(3, '0')}`, String(barcodeNo), b.price],
    )
    const bundleId = db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0] as number
    for (const [cname, qty] of b.comps) {
      if (!pid[cname]) continue
      db.run(
        `INSERT INTO product_bundle_items (bundle_product_id, component_product_id, quantity)
         VALUES (?, ?, ?)`,
        [bundleId, pid[cname], qty],
      )
    }
  }

  // Layout meja contoh (grid 4 kolom)
  for (let i = 1; i <= 8; i++) {
    db.run(
      `INSERT INTO dining_tables (outlet_id, table_number, section_name, grid_x, grid_y, capacity, max_capacity, status)
       VALUES (1, ?, 'INDOOR', ?, ?, 4, 6, 'EMPTY')`,
      [`T-${String(i).padStart(2, '0')}`, (i - 1) % 4, Math.floor((i - 1) / 4)],
    )
  }

  // Master satuan produk.
  for (const u of ['pcs', 'porsi', 'gelas', 'botol', 'box', 'pack', 'kg', 'gram', 'liter']) {
    db.run('INSERT INTO units (name, is_active) VALUES (?, 1)', [u])
  }

  // Master pajak (PPN 10% sebagai default aktif, selaras tax_rate 0.10).
  db.run(
    `INSERT INTO taxes (name, rate, description, is_default, is_active) VALUES
       ('PPN', 10, 'Pajak Pertambahan Nilai', 1, 1),
       ('Tanpa Pajak', 0, 'Transaksi bebas pajak', 0, 1)`,
  )

  const settings: Array<[string, string]> = [
    ['tax_rate', '0.10'],
    ['tax_enabled', '1'],
    ['currency', 'IDR'],
    ['active_outlet_id', '1'],
    ['module_table_layout', '1'],
    ['module_kds', '1'],
    ['module_self_order', '1'],
    ['module_marketplace', '1'],
    ['module_queue', '1'],
    ['points_per_amount', '1000'], // 1 poin per Rp1.000
    ['queue_call_text', 'Nomor antrian {no}, silakan diambil.'],
  ]
  for (const [key, value] of settings) {
    db.run('INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)', [key, value])
  }

  db.run('COMMIT')
}

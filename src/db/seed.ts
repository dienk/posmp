import type { Database } from 'sql.js'

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
  ]
  for (const [name, color] of categories) {
    db.run('INSERT INTO categories (name, color_code) VALUES (?, ?)', [name, color])
  }

  // [nama, sku, barcode, harga, modal, satuan, category_id, stok]
  const products: Array<[string, string, string, number, number, string, number, number]> = [
    ['Nasi Goreng Spesial', 'MKN-001', '8991234000011', 25000, 15000, 'porsi', 1, 50],
    ['Mie Goreng', 'MKN-002', '8991234000028', 20000, 12000, 'porsi', 1, 40],
    ['Ayam Penyet', 'MKN-003', '8991234000035', 30000, 18000, 'porsi', 1, 35],
    ['Tahu Walik', 'SNK-001', '8991234000042', 15000, 8000, 'porsi', 3, 60],
    ['Pisang Goreng', 'SNK-002', '8991234000059', 12000, 6000, 'porsi', 3, 45],
    ['Es Teh Manis', 'MNM-001', '8991234000066', 5000, 2000, 'gelas', 2, 100],
    ['Kopi Susu', 'MNM-002', '8991234000073', 15000, 7000, 'gelas', 2, 80],
    ['Es Jeruk', 'MNM-003', '8991234000080', 10000, 4000, 'gelas', 2, 70],
    ['Air Mineral', 'MNM-004', '8991234000097', 5000, 3000, 'botol', 2, 120],
  ]
  for (const [name, sku, barcode, price, cost, unit, categoryId, stock] of products) {
    db.run(
      `INSERT INTO products (category_id, name, sku, barcode, price, cost_price, unit, min_stock, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 10, 1)`,
      [categoryId, name, sku, barcode, price, cost, unit],
    )
    db.run(
      `INSERT INTO outlet_stocks (outlet_id, warehouse_id, product_id, stock)
       VALUES (1, 1, last_insert_rowid(), ?)`,
      [stock],
    )
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

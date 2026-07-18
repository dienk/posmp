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

  const categories: Array<[string, string]> = [
    ['Makanan', '#F2C6A1'],
    ['Minuman', '#CFC6D9'],
    ['Snack', '#D9ABA0'],
  ]
  for (const [name, color] of categories) {
    db.run('INSERT INTO categories (name, color_code) VALUES (?, ?)', [name, color])
  }

  // [nama, sku, harga, category_id, stok]
  const products: Array<[string, string, number, number, number]> = [
    ['Nasi Goreng Spesial', 'MKN-001', 25000, 1, 50],
    ['Mie Goreng', 'MKN-002', 20000, 1, 40],
    ['Ayam Penyet', 'MKN-003', 30000, 1, 35],
    ['Tahu Walik', 'SNK-001', 15000, 3, 60],
    ['Pisang Goreng', 'SNK-002', 12000, 3, 45],
    ['Es Teh Manis', 'MNM-001', 5000, 2, 100],
    ['Kopi Susu', 'MNM-002', 15000, 2, 80],
    ['Es Jeruk', 'MNM-003', 10000, 2, 70],
    ['Air Mineral', 'MNM-004', 5000, 2, 120],
  ]
  for (const [name, sku, price, categoryId, stock] of products) {
    db.run('INSERT INTO products (category_id, name, sku, price) VALUES (?, ?, ?, ?)', [
      categoryId,
      name,
      sku,
      price,
    ])
    db.run(
      `INSERT INTO outlet_stocks (outlet_id, product_id, stock)
       VALUES (1, last_insert_rowid(), ?)`,
      [stock],
    )
  }

  // Layout meja contoh (grid 4 kolom)
  for (let i = 1; i <= 8; i++) {
    db.run(
      `INSERT INTO dining_tables (outlet_id, table_number, section_name, grid_x, grid_y, capacity, status)
       VALUES (1, ?, 'INDOOR', ?, ?, 4, 'EMPTY')`,
      [`T-${String(i).padStart(2, '0')}`, (i - 1) % 4, Math.floor((i - 1) / 4)],
    )
  }

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
  ]
  for (const [key, value] of settings) {
    db.run('INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)', [key, value])
  }

  db.run('COMMIT')
}

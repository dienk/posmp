import { execute, getDb, persist, query } from '../../db/database'
import type { Category, Product } from '../../types'
import { defaultWarehouseId } from '../warehouses/warehousesRepository'

export function listCategories(): Category[] {
  return query<Category>('SELECT id, name, color_code FROM categories ORDER BY name')
}

export interface CategoryWithCount extends Category {
  product_count: number
}

export function listCategoriesWithCount(): CategoryWithCount[] {
  return query<CategoryWithCount>(
    `SELECT c.id, c.name, c.color_code, COUNT(p.id) AS product_count
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id
     GROUP BY c.id
     ORDER BY c.name`,
  )
}

export async function updateCategory(id: number, name: string, color: string | null): Promise<void> {
  await execute('UPDATE categories SET name = ?, color_code = ? WHERE id = ?', [
    name.trim(),
    color,
    id,
  ])
}

/** Hapus kategori; produk terkait dijadikan tanpa kategori (bukan dihapus). */
export async function deleteCategory(id: number): Promise<void> {
  const db = getDb()
  db.run('BEGIN')
  try {
    db.run('UPDATE products SET category_id = NULL WHERE category_id = ?', [id])
    db.run('DELETE FROM categories WHERE id = ?', [id])
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
  await persist()
}

const PRODUCT_COLS = `p.id, p.category_id, p.name, p.sku, p.barcode, p.price, p.cost_price,
            p.unit, p.min_stock, p.description, p.is_active, p.image_path`

// Stok total produk pada outlet = jumlah stok lintas gudang.
const STOCK_SUM = `COALESCE((SELECT SUM(os.stock) FROM outlet_stocks os
            WHERE os.product_id = p.id AND os.outlet_id = ?), 0) AS stock`

export function listProducts(outletId: number): Product[] {
  return query<Product>(
    `SELECT ${PRODUCT_COLS},
            c.name AS category_name,
            ${STOCK_SUM}
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     ORDER BY p.name`,
    [outletId],
  )
}

/**
 * Cari satu produk aktif berdasarkan barcode (atau SKU) persis — untuk mode
 * scan di kasir. Mengembalikan produk + stok pada outlet aktif, atau null.
 */
export function findByBarcode(code: string, outletId: number): Product | null {
  const c = code.trim()
  if (!c) return null
  return (
    query<Product>(
      `SELECT ${PRODUCT_COLS},
              c.name AS category_name,
              ${STOCK_SUM}
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.is_active = 1 AND (p.barcode = ? OR p.sku = ?)
       LIMIT 1`,
      [outletId, c, c],
    )[0] ?? null
  )
}

export interface ProductInput {
  categoryId: number | null
  name: string
  sku: string | null
  barcode: string | null
  price: number
  costPrice: number
  unit: string | null
  minStock: number
  description: string | null
  isActive: number
  imagePath: string | null
}

/** Buat produk baru + baris stok awal (0) pada outlet aktif, satu transaksi SQL. */
export async function createProduct(input: ProductInput, outletId: number): Promise<number> {
  const db = getDb()
  let id = 0
  db.run('BEGIN')
  try {
    db.run(
      `INSERT INTO products
         (category_id, name, sku, barcode, price, cost_price, unit, min_stock, description, is_active, image_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.categoryId,
        input.name.trim(),
        input.sku?.trim() || null,
        input.barcode?.trim() || null,
        input.price,
        input.costPrice,
        input.unit?.trim() || 'pcs',
        input.minStock,
        input.description?.trim() || null,
        input.isActive,
        input.imagePath || null,
      ],
    )
    id = query<{ id: number }>('SELECT last_insert_rowid() AS id')[0].id
    db.run('INSERT INTO outlet_stocks (outlet_id, warehouse_id, product_id, stock) VALUES (?, ?, ?, 0)', [
      outletId,
      defaultWarehouseId(outletId),
      id,
    ])
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
  await persist()
  return id
}

export async function updateProduct(id: number, input: ProductInput): Promise<void> {
  await execute(
    `UPDATE products
     SET category_id = ?, name = ?, sku = ?, barcode = ?, price = ?, cost_price = ?,
         unit = ?, min_stock = ?, description = ?, is_active = ?, image_path = ?
     WHERE id = ?`,
    [
      input.categoryId,
      input.name.trim(),
      input.sku?.trim() || null,
      input.barcode?.trim() || null,
      input.price,
      input.costPrice,
      input.unit?.trim() || 'pcs',
      input.minStock,
      input.description?.trim() || null,
      input.isActive,
      input.imagePath || null,
      id,
    ],
  )
}

/** Hapus produk. Menolak bila sudah dipakai transaksi/penerimaan stok. */
export async function deleteProduct(id: number): Promise<void> {
  const used =
    query<{ n: number }>('SELECT COUNT(*) AS n FROM transaction_details WHERE product_id = ?', [id])[0]
      .n +
    query<{ n: number }>('SELECT COUNT(*) AS n FROM stock_entry_details WHERE product_id = ?', [id])[0]
      .n
  if (used > 0) throw new Error('Produk sudah dipakai transaksi/stok — tidak bisa dihapus.')
  const db = getDb()
  db.run('BEGIN')
  try {
    db.run('DELETE FROM outlet_stocks WHERE product_id = ?', [id])
    db.run('DELETE FROM product_marketplace_mappings WHERE product_id = ?', [id])
    db.run('DELETE FROM products WHERE id = ?', [id])
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
  await persist()
}

export async function createCategory(name: string, color: string | null): Promise<number> {
  return execute('INSERT INTO categories (name, color_code) VALUES (?, ?)', [name.trim(), color])
}

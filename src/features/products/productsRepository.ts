import { execute, getDb, persist, query } from '../../db/database'
import type { Category, Product } from '../../types'

export function listCategories(): Category[] {
  return query<Category>('SELECT id, name, color_code FROM categories ORDER BY name')
}

export function listProducts(outletId: number): Product[] {
  return query<Product>(
    `SELECT p.id, p.category_id, p.name, p.sku, p.price, p.image_path,
            c.name AS category_name,
            COALESCE(os.stock, 0) AS stock
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN outlet_stocks os ON os.product_id = p.id AND os.outlet_id = ?
     ORDER BY p.name`,
    [outletId],
  )
}

export interface ProductInput {
  categoryId: number | null
  name: string
  sku: string | null
  price: number
}

/** Buat produk baru + baris stok awal (0) pada outlet aktif, satu transaksi SQL. */
export async function createProduct(input: ProductInput, outletId: number): Promise<number> {
  const db = getDb()
  let id = 0
  db.run('BEGIN')
  try {
    db.run('INSERT INTO products (category_id, name, sku, price) VALUES (?, ?, ?, ?)', [
      input.categoryId,
      input.name.trim(),
      input.sku?.trim() || null,
      input.price,
    ])
    id = query<{ id: number }>('SELECT last_insert_rowid() AS id')[0].id
    db.run('INSERT INTO outlet_stocks (outlet_id, product_id, stock) VALUES (?, ?, 0)', [
      outletId,
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
  await execute('UPDATE products SET category_id = ?, name = ?, sku = ?, price = ? WHERE id = ?', [
    input.categoryId,
    input.name.trim(),
    input.sku?.trim() || null,
    input.price,
    id,
  ])
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

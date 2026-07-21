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
            p.unit, p.min_stock, p.description, p.is_active, p.image_path, p.images, p.unit_conversions,
            p.is_bundle`

// Stok total produk pada outlet = jumlah stok lintas gudang.
const STOCK_SUM = `COALESCE((SELECT SUM(os.stock) FROM outlet_stocks os
            WHERE os.product_id = p.id AND os.outlet_id = ?), 0) AS stock`

/**
 * Daftar produk + stok pada outlet. Bila `warehouseId` diisi, kolom stok = stok
 * gudang tsb saja; tanpa itu = total lintas gudang.
 */
export function listProducts(outletId: number, warehouseId?: number): Product[] {
  const stockCol = warehouseId
    ? `COALESCE((SELECT SUM(os.stock) FROM outlet_stocks os
                 WHERE os.product_id = p.id AND os.outlet_id = ? AND os.warehouse_id = ?), 0) AS stock`
    : STOCK_SUM
  const params: number[] = warehouseId ? [outletId, warehouseId] : [outletId]
  return query<Product>(
    `SELECT ${PRODUCT_COLS},
            c.name AS category_name,
            ${stockCol}
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.is_bundle = 0
     ORDER BY p.name`,
    params,
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
  images: string[]
  unitConversions: UnitConversion[]
}

/** Satuan turunan: 1 `unit` = `conversion` satuan dasar; `price` = harga jual (0 = pakai harga dasar). */
export interface UnitConversion {
  unit: string
  conversion: number
  price: number
}

function cleanConversions(list: UnitConversion[]): string | null {
  const valid = list
    .filter((c) => c.unit.trim() && c.conversion > 0)
    .map((c) => ({ unit: c.unit.trim(), conversion: c.conversion, price: Math.max(0, c.price) }))
  return valid.length ? JSON.stringify(valid) : null
}

/** Opsi satuan siap pakai untuk item transaksi (kasir/stok). */
export interface UnitOption {
  unit: string
  factor: number // banyak satuan dasar per 1 satuan ini (dasar = 1)
  price: number // harga jual per 1 satuan ini (dasar = harga produk)
  isBase: boolean
}

/**
 * Bangun daftar opsi satuan sebuah produk: satuan dasar (`unit`) + seluruh
 * satuan turunan dari `unit_conversions`. Harga turunan = harga khusus bila
 * diisi (>0), selain itu harga dasar × faktor.
 */
export function buildUnitOptions(
  baseUnit: string | null,
  basePrice: number,
  conversionsJson: string | null,
): UnitOption[] {
  const base: UnitOption = { unit: baseUnit || 'pcs', factor: 1, price: basePrice, isBase: true }
  const derived = parseUnitConversions(conversionsJson).map((c) => ({
    unit: c.unit,
    factor: c.conversion,
    price: c.price > 0 ? c.price : basePrice * c.conversion,
    isBase: false,
  }))
  return [base, ...derived]
}

/** Parse kolom `unit_conversions` (JSON) → array. */
export function parseUnitConversions(json: string | null): UnitConversion[] {
  if (!json) return []
  try {
    const arr = JSON.parse(json)
    if (!Array.isArray(arr)) return []
    return arr
      .filter((c) => c && typeof c.unit === 'string' && Number(c.conversion) > 0)
      .map((c) => ({ unit: c.unit, conversion: Number(c.conversion), price: Number(c.price) || 0 }))
  } catch {
    return []
  }
}

/** Gambar utama = gambar pertama; JSON semua gambar disimpan di kolom images. */
function imageCols(images: string[]): { imagePath: string | null; imagesJson: string | null } {
  const list = images.filter((s) => !!s)
  return {
    imagePath: list[0] ?? null,
    imagesJson: list.length ? JSON.stringify(list) : null,
  }
}

/** Buat produk baru + baris stok awal (0) pada outlet aktif, satu transaksi SQL. */
export async function createProduct(input: ProductInput, outletId: number): Promise<number> {
  const db = getDb()
  let id = 0
  const { imagePath, imagesJson } = imageCols(input.images)
  db.run('BEGIN')
  try {
    db.run(
      `INSERT INTO products
         (category_id, name, sku, barcode, price, cost_price, unit, min_stock, description, is_active, image_path, images, unit_conversions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        imagePath,
        imagesJson,
        cleanConversions(input.unitConversions),
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
  const { imagePath, imagesJson } = imageCols(input.images)
  await execute(
    `UPDATE products
     SET category_id = ?, name = ?, sku = ?, barcode = ?, price = ?, cost_price = ?,
         unit = ?, min_stock = ?, description = ?, is_active = ?, image_path = ?, images = ?,
         unit_conversions = ?
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
      imagePath,
      imagesJson,
      cleanConversions(input.unitConversions),
      id,
    ],
  )
}

/** Parse kolom `images` (JSON) → array; fallback ke image_path lama bila perlu. */
export function parseImages(imagesJson: string | null, imagePath: string | null): string[] {
  if (imagesJson) {
    try {
      const arr = JSON.parse(imagesJson)
      if (Array.isArray(arr)) return arr.filter((s): s is string => typeof s === 'string')
    } catch {
      /* abaikan JSON rusak */
    }
  }
  return imagePath ? [imagePath] : []
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

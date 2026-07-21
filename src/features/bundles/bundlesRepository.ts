import { getDb, persist, query } from '../../db/database'

/** Satu komponen penyusun paket bundling (+ info tampilan bila di-join). */
export interface BundleComponent {
  component_product_id: number
  quantity: number // banyak komponen (satuan dasar) per 1 paket
  name?: string
  unit?: string | null
  price?: number // harga jual normal komponen (per satuan dasar)
  stock?: number // stok komponen pada outlet aktif
}

/** Produk paket (is_bundle=1) beserta komponen & hitungan turunannya. */
export interface Bundle {
  id: number
  name: string
  sku: string | null
  category_id: number | null
  category_name?: string | null
  price: number // harga jual paket
  description: string | null
  is_active: number
  image_path: string | null
  components: BundleComponent[]
  componentsTotal: number // Σ harga normal komponen (price × qty) — untuk hitung hemat
  available: number // stok paket yang bisa dijual = min(floor(stok komponen / qty))
}

export interface BundleInput {
  name: string
  sku: string | null
  categoryId: number | null
  price: number
  description: string | null
  isActive: number
  imagePath: string | null // 1 gambar (data URL) opsional
  components: { componentProductId: number; quantity: number }[]
}

/** Kandidat komponen: produk aktif NON-paket + stok pada outlet. */
export interface ComponentCandidate {
  id: number
  name: string
  price: number
  unit: string | null
  stock: number
}

const OUTLET_STOCK = `COALESCE((SELECT SUM(os.stock) FROM outlet_stocks os
            WHERE os.product_id = p.id AND os.outlet_id = ?), 0)`

export function listComponentCandidates(outletId: number): ComponentCandidate[] {
  return query<ComponentCandidate>(
    `SELECT p.id, p.name, p.price, p.unit, ${OUTLET_STOCK} AS stock
     FROM products p
     WHERE p.is_active = 1 AND p.is_bundle = 0
     ORDER BY p.name`,
    [outletId],
  )
}

/**
 * Daftar seluruh paket bundling + komponennya (harga & stok komponen). Bila
 * `warehouseId` diisi, stok komponen (→ ketersediaan paket) dihitung dari gudang
 * tsb saja; tanpa itu = total lintas gudang.
 */
export function listBundles(outletId: number, warehouseId?: number): Bundle[] {
  const bundles = query<Omit<Bundle, 'components' | 'componentsTotal' | 'available'>>(
    `SELECT p.id, p.category_id, p.name, p.sku, p.price, p.description, p.is_active, p.image_path,
            c.name AS category_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.is_bundle = 1
     ORDER BY p.name`,
  )
  if (!bundles.length) return []

  const stockExpr = warehouseId
    ? `COALESCE((SELECT SUM(os.stock) FROM outlet_stocks os
                 WHERE os.product_id = cp.id AND os.outlet_id = ? AND os.warehouse_id = ?), 0)`
    : `COALESCE((SELECT SUM(os.stock) FROM outlet_stocks os
                 WHERE os.product_id = cp.id AND os.outlet_id = ?), 0)`
  const params: number[] = warehouseId ? [outletId, warehouseId] : [outletId]
  const rows = query<BundleComponent & { bundle_product_id: number }>(
    `SELECT bi.bundle_product_id, bi.component_product_id, bi.quantity,
            cp.name AS name, cp.unit AS unit, cp.price AS price,
            ${stockExpr} AS stock
     FROM product_bundle_items bi
     JOIN products cp ON cp.id = bi.component_product_id
     ORDER BY bi.bundle_product_id, cp.name`,
    params,
  )
  const byBundle = new Map<number, BundleComponent[]>()
  for (const r of rows) {
    const list = byBundle.get(r.bundle_product_id) ?? []
    list.push({
      component_product_id: r.component_product_id,
      quantity: r.quantity,
      name: r.name,
      unit: r.unit,
      price: r.price,
      stock: r.stock,
    })
    byBundle.set(r.bundle_product_id, list)
  }

  return bundles.map((b) => {
    const components = byBundle.get(b.id) ?? []
    const componentsTotal = components.reduce((s, c) => s + (c.price ?? 0) * c.quantity, 0)
    const available = components.length
      ? Math.min(...components.map((c) => Math.floor((c.stock ?? 0) / c.quantity)))
      : 0
    return { ...b, components, componentsTotal, available }
  })
}

/**
 * Sasaran stok untuk 1 baris jual sebanyak `baseQty` (satuan dasar). Produk
 * paket → komponennya (qty komponen × baseQty); produk biasa → dirinya sendiri.
 * Dipakai saat potong stok (kasir, pelunasan pre-order) & kembalikan stok (refund).
 */
export function stockTargets(productId: number, baseQty: number): { productId: number; qty: number }[] {
  const parts = query<{ component_product_id: number; quantity: number }>(
    'SELECT component_product_id, quantity FROM product_bundle_items WHERE bundle_product_id = ?',
    [productId],
  )
  if (!parts.length) return [{ productId, qty: baseQty }]
  return parts.map((p) => ({ productId: p.component_product_id, qty: p.quantity * baseQty }))
}

/** Stok paket yang bisa dijual (min floor(stok komponen / qty)) per bundle id. */
export function bundleAvailability(outletId: number, bundleIds: number[]): Map<number, number> {
  const map = new Map<number, number>()
  if (!bundleIds.length) return map
  const ph = bundleIds.map(() => '?').join(',')
  const rows = query<{ bid: number; avail: number }>(
    `SELECT bi.bundle_product_id AS bid,
            MIN(COALESCE(s.stock, 0) / bi.quantity) AS avail
     FROM product_bundle_items bi
     LEFT JOIN (SELECT product_id, SUM(stock) AS stock FROM outlet_stocks
                WHERE outlet_id = ? GROUP BY product_id) s
       ON s.product_id = bi.component_product_id
     WHERE bi.bundle_product_id IN (${ph})
     GROUP BY bi.bundle_product_id`,
    [outletId, ...bundleIds],
  )
  for (const r of rows) map.set(r.bid, r.avail)
  return map
}

function replaceComponents(
  bundleId: number,
  components: { componentProductId: number; quantity: number }[],
): void {
  const db = getDb()
  db.run('DELETE FROM product_bundle_items WHERE bundle_product_id = ?', [bundleId])
  for (const c of components) {
    if (!c.componentProductId || c.quantity <= 0) continue
    db.run(
      `INSERT INTO product_bundle_items (bundle_product_id, component_product_id, quantity)
       VALUES (?, ?, ?)`,
      [bundleId, c.componentProductId, c.quantity],
    )
  }
}

/** Buat paket bundling baru (produk is_bundle=1, tanpa baris stok sendiri) + komponen. */
export async function createBundle(input: BundleInput): Promise<number> {
  const db = getDb()
  let id = 0
  db.run('BEGIN')
  try {
    db.run(
      `INSERT INTO products
         (category_id, name, sku, price, cost_price, unit, min_stock, description, is_active,
          image_path, images, unit_conversions, is_bundle)
       VALUES (?, ?, ?, ?, 0, 'paket', 0, ?, ?, ?, ?, NULL, 1)`,
      [
        input.categoryId,
        input.name.trim(),
        input.sku?.trim() || null,
        input.price,
        input.description?.trim() || null,
        input.isActive,
        input.imagePath || null,
        input.imagePath ? JSON.stringify([input.imagePath]) : null,
      ],
    )
    id = query<{ id: number }>('SELECT last_insert_rowid() AS id')[0].id
    replaceComponents(id, input.components)
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
  await persist()
  return id
}

export async function updateBundle(id: number, input: BundleInput): Promise<void> {
  const db = getDb()
  db.run('BEGIN')
  try {
    db.run(
      `UPDATE products
       SET category_id = ?, name = ?, sku = ?, price = ?, description = ?, is_active = ?,
           image_path = ?, images = ?
       WHERE id = ?`,
      [
        input.categoryId,
        input.name.trim(),
        input.sku?.trim() || null,
        input.price,
        input.description?.trim() || null,
        input.isActive,
        input.imagePath || null,
        input.imagePath ? JSON.stringify([input.imagePath]) : null,
        id,
      ],
    )
    replaceComponents(id, input.components)
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
  await persist()
}

/** Hapus paket. Menolak bila paket sudah pernah dipakai transaksi. */
export async function deleteBundle(id: number): Promise<void> {
  const used = query<{ n: number }>(
    'SELECT COUNT(*) AS n FROM transaction_details WHERE product_id = ?',
    [id],
  )[0].n
  if (used > 0) throw new Error('Paket sudah dipakai transaksi — tidak bisa dihapus (non-aktifkan saja).')
  const db = getDb()
  db.run('BEGIN')
  try {
    db.run('DELETE FROM product_bundle_items WHERE bundle_product_id = ?', [id])
    db.run('DELETE FROM outlet_stocks WHERE product_id = ?', [id])
    db.run('DELETE FROM products WHERE id = ?', [id])
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
  await persist()
}

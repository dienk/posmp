import { getDb, persist, query } from '../../db/database'
import { generateInvoiceNumber } from '../../lib/format'
import { publish } from '../../lib/realtime'
import type { CartItem, Category, FacilityType, Product } from '../../types'

export function fetchCategories(): Category[] {
  return query<Category>('SELECT id, name, color_code FROM categories ORDER BY id')
}

/** Ambil produk beserta stok pada outlet aktif. Bisa difilter kategori & keyword. */
export function fetchProducts(outletId: number, categoryId?: number, keyword?: string): Product[] {
  const where: string[] = []
  const params: (string | number)[] = [outletId]
  if (categoryId) {
    where.push('p.category_id = ?')
    params.push(categoryId)
  }
  if (keyword && keyword.trim()) {
    where.push('(p.name LIKE ? OR p.sku LIKE ?)')
    params.push(`%${keyword.trim()}%`, `%${keyword.trim()}%`)
  }
  const whereSql = where.length ? `AND ${where.join(' AND ')}` : ''
  return query<Product>(
    `SELECT p.id, p.category_id, p.name, p.sku, p.price, p.image_path,
            c.name AS category_name,
            COALESCE(os.stock, 0) AS stock
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN outlet_stocks os ON os.product_id = p.id AND os.outlet_id = ?
     WHERE 1=1 ${whereSql}
     ORDER BY p.name`,
    params,
  )
}

export interface SaveOrderInput {
  outletId: number
  items: CartItem[]
  facilityType: FacilityType
  orderSource?: string
  customerName?: string
  tableNumber?: string
  queueNumber?: string
  taxRate: number
  taxEnabled: boolean
  status: 'DRAFT' | 'COMPLETED'
  discountAmount?: number
  voucherId?: number
  /** Terbitkan tiket ke KDS (fire to kitchen). Default true untuk pesanan F&B. */
  sendToKitchen?: boolean
}

export interface SaveOrderResult {
  transactionId: number
  invoiceNumber: string
  subtotal: number
  discount: number
  tax: number
  total: number
}

/**
 * Simpan transaksi (header + detail) dalam satu transaksi SQL.
 * status='DRAFT' untuk "Simpan Bill", 'COMPLETED' untuk pembayaran langsung.
 */
export async function saveOrder(input: SaveOrderInput): Promise<SaveOrderResult> {
  const db = getDb()
  const subtotal = input.items.reduce((sum, it) => sum + it.product.price * it.quantity, 0)
  const discount = Math.min(input.discountAmount ?? 0, subtotal)
  const taxable = subtotal - discount
  const tax = input.taxEnabled ? Math.round(taxable * input.taxRate) : 0
  const total = taxable + tax
  const invoiceNumber = generateInvoiceNumber()
  const orderSource = input.orderSource ?? 'POS_OFFLINE'
  const sendToKitchen = input.sendToKitchen ?? true

  db.run('BEGIN')
  try {
    db.run(
      `INSERT INTO transactions
         (outlet_id, invoice_number, facility_type, order_source, table_number, queue_number,
          voucher_id, subtotal_amount, discount_amount, tax_amount, total_amount, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.outletId,
        invoiceNumber,
        input.facilityType,
        orderSource,
        input.tableNumber ?? null,
        input.queueNumber ?? null,
        input.voucherId ?? null,
        subtotal,
        discount,
        tax,
        total,
        input.status,
      ],
    )
    const transactionId = query<{ id: number }>('SELECT last_insert_rowid() AS id')[0].id

    // Pesanan yang dikirim ke dapur menandai item sebagai COOKING.
    const initialCookStatus = sendToKitchen ? 'COOKING' : 'PENDING'
    for (const it of input.items) {
      db.run(
        `INSERT INTO transaction_details
           (transaction_id, product_id, quantity, unit_price, subtotal, notes, cooking_status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          transactionId,
          it.product.id,
          it.quantity,
          it.product.price,
          it.product.price * it.quantity,
          it.notes ?? null,
          initialCookStatus,
        ],
      )
      // Kurangi stok fisik outlet saat transaksi diselesaikan.
      if (input.status === 'COMPLETED') {
        db.run(
          `UPDATE outlet_stocks SET stock = stock - ?
           WHERE outlet_id = ? AND product_id = ?`,
          [it.quantity, input.outletId, it.product.id],
        )
      }
    }

    // Fire to Kitchen: buat tiket KDS.
    if (sendToKitchen) {
      db.run(
        `INSERT INTO kds_tickets (transaction_id, outlet_id, table_number, status)
         VALUES (?, ?, ?, 'PREPARING')`,
        [transactionId, input.outletId, input.tableNumber ?? null],
      )
    }

    // Catat pemakaian voucher.
    if (input.voucherId) {
      db.run('UPDATE vouchers SET used_count = used_count + 1 WHERE id = ?', [input.voucherId])
    }

    // Integrasi Table Layout: DRAFT menempati meja, pembayaran melunasi & mengosongkan.
    if (input.tableNumber) {
      const tableStatus = input.status === 'DRAFT' ? 'OCCUPIED' : 'EMPTY'
      db.run('UPDATE dining_tables SET status = ? WHERE outlet_id = ? AND table_number = ?', [
        tableStatus,
        input.outletId,
        input.tableNumber,
      ])
    }
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }

  await persist()
  if (sendToKitchen) publish('kds:update')
  if (input.tableNumber) publish('tables:update')
  publish('order:update')

  const transactionId = query<{ id: number }>(
    'SELECT id FROM transactions WHERE invoice_number = ?',
    [invoiceNumber],
  )[0].id
  return { transactionId, invoiceNumber, subtotal, discount, tax, total }
}

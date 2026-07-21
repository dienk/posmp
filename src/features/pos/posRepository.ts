import { getDb, persist, query } from '../../db/database'
import { generateInvoiceNumber } from '../../lib/format'
import { publish } from '../../lib/realtime'
import { computePoints, type LoyaltyConfig } from '../../lib/loyalty'
import type { CartItem, Category, FacilityType, Product } from '../../types'
import { defaultWarehouseId } from '../warehouses/warehousesRepository'
import { bundleAvailability, stockTargets } from '../bundles/bundlesRepository'

// Metode bawaan; metode kustom (dari Pengaturan) memakai label sebagai nilai.
export type PaymentMethod =
  | 'CASH'
  | 'DEBIT_CARD'
  | 'CREDIT_CARD'
  | 'QRIS'
  | 'VOUCHER'
  | (string & {})

export interface PaymentInput {
  method: PaymentMethod
  amountPaid: number // nilai yang diakui sebagai pembayaran (maks. sisa tagihan)
  tenderedAmount: number // uang fisik/nominal diserahkan
  changeAmount?: number
  qrisReference?: string
  voucherId?: number
}

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
  const products = query<Product>(
    `SELECT p.id, p.category_id, p.name, p.sku, p.barcode, p.price, p.cost_price,
            p.unit, p.min_stock, p.description, p.is_active, p.image_path, p.unit_conversions,
            p.is_bundle,
            c.name AS category_name,
            COALESCE((SELECT SUM(os.stock) FROM outlet_stocks os
                      WHERE os.product_id = p.id AND os.outlet_id = ?), 0) AS stock
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.is_active = 1 ${whereSql}
     ORDER BY p.name`,
    params,
  )
  // Stok paket bundling tidak disimpan sendiri — turunkan dari stok komponen.
  const bundleIds = products.filter((p) => p.is_bundle).map((p) => p.id)
  if (bundleIds.length) {
    const avail = bundleAvailability(outletId, bundleIds)
    for (const p of products) if (p.is_bundle) p.stock = avail.get(p.id) ?? 0
  }
  return products
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
  /** Tarif biaya layanan (desimal, mis. 0.05 = 5%). */
  serviceRate?: number
  serviceEnabled?: boolean
  status: 'DRAFT' | 'COMPLETED' | 'PREPARING'
  discountAmount?: number
  voucherId?: number
  memberId?: number
  /** Rp per 1 poin (mis. 1000 = 1 poin per Rp1.000). 0/undefined = tanpa poin. (fallback lama) */
  pointsPerAmount?: number
  /** Konfigurasi loyalitas lengkap; bila ada, dipakai menggantikan pointsPerAmount. */
  loyalty?: LoyaltyConfig
  /** Rincian pembayaran berganda; dicatat ke transaction_payments (status COMPLETED). */
  payments?: PaymentInput[]
  /** Terbitkan tiket ke KDS (fire to kitchen). Default true untuk pesanan F&B. */
  sendToKitchen?: boolean
  /** Pre-Order: pesanan di muka dengan tenggat & uang muka. */
  isPreorder?: boolean
  preorderDeadline?: string | null
  downPaymentReceived?: number
  /** Split Bill: menautkan nota anak ke transaksi induk. */
  parentTransactionId?: number
  /** Catatan khusus tingkat transaksi (mis. permintaan pelanggan). */
  note?: string
  /** Nomor invoice yang disetel manual dari kasir; kosong = dibuat otomatis. */
  invoiceNumber?: string
  /** Bila diisi, draft ini (yang sedang dibuka) dihapus dalam transaksi yang sama. */
  replaceDraftId?: number
}

export interface SaveOrderResult {
  transactionId: number
  invoiceNumber: string
  subtotal: number
  discount: number
  serviceCharge: number
  tax: number
  total: number
  pointsEarned: number
}

/**
 * Simpan transaksi (header + detail) dalam satu transaksi SQL.
 * status='DRAFT' untuk "Simpan Bill", 'COMPLETED' untuk pembayaran langsung.
 */
export async function saveOrder(input: SaveOrderInput): Promise<SaveOrderResult> {
  const db = getDb()
  // Total baris = (harga efektif × qty) − diskon item (minimal 0).
  const lineTotal = (it: CartItem) =>
    Math.max(0, (it.unitPrice ?? it.product.price) * it.quantity - (it.discount ?? 0))
  const subtotal = input.items.reduce((sum, it) => sum + lineTotal(it), 0)
  const discount = Math.min(input.discountAmount ?? 0, subtotal)
  const taxable = subtotal - discount
  // Biaya layanan dihitung dari nilai setelah diskon; pajak dihitung di atas
  // (subtotal − diskon + service charge) sesuai praktik F&B (PB1 atas service).
  const serviceCharge = input.serviceEnabled ? Math.round(taxable * (input.serviceRate ?? 0)) : 0
  const tax = input.taxEnabled ? Math.round((taxable + serviceCharge) * input.taxRate) : 0
  const total = taxable + serviceCharge + tax
  // Nomor invoice bisa disetel dari kasir (bisa diedit); jika kosong, dibuat otomatis.
  const invoiceNumber = input.invoiceNumber?.trim() || generateInvoiceNumber()
  const orderSource = input.orderSource ?? 'POS_OFFLINE'
  const sendToKitchen = input.sendToKitchen ?? true
  // Poin hanya dihitung saat transaksi lunas & ada member terpasang.
  let pointsEarned = 0
  if (input.status === 'COMPLETED' && input.memberId) {
    if (input.loyalty) {
      const tier = query<{ tier: string }>('SELECT tier FROM members WHERE id = ?', [
        input.memberId,
      ])[0]?.tier
      pointsEarned = computePoints(input.loyalty, { total, subtotal }, tier)
    } else if (input.pointsPerAmount) {
      pointsEarned = Math.floor(total / input.pointsPerAmount)
    }
  }

  db.run('BEGIN')
  try {
    // Hapus draft yang sedang dibuka (bila ada) agar tak duplikat & invoice bebas bentrok.
    if (input.replaceDraftId) {
      const draftTable =
        query<{ table_number: string | null }>(
          "SELECT table_number FROM transactions WHERE id = ? AND status = 'DRAFT'",
          [input.replaceDraftId],
        )[0]?.table_number ?? null
      db.run('DELETE FROM transaction_details WHERE transaction_id = ?', [input.replaceDraftId])
      db.run('DELETE FROM kds_tickets WHERE transaction_id = ?', [input.replaceDraftId])
      db.run("DELETE FROM transactions WHERE id = ? AND status = 'DRAFT'", [input.replaceDraftId])
      // Kosongkan meja draft lama bila pesanan baru tak memakai meja yang sama.
      if (draftTable && draftTable !== (input.tableNumber ?? null)) {
        db.run("UPDATE dining_tables SET status = 'EMPTY' WHERE outlet_id = ? AND table_number = ?", [
          input.outletId,
          draftTable,
        ])
      }
    }
    db.run(
      `INSERT INTO transactions
         (outlet_id, invoice_number, facility_type, order_source, table_number, queue_number,
          voucher_id, member_id, parent_transaction_id, subtotal_amount, discount_amount,
          service_charge_amount, tax_amount, points_earned, total_amount, status, is_preorder,
          preorder_deadline, down_payment_received, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.outletId,
        invoiceNumber,
        input.facilityType,
        orderSource,
        input.tableNumber ?? null,
        input.queueNumber ?? null,
        input.voucherId ?? null,
        input.memberId ?? null,
        input.parentTransactionId ?? null,
        subtotal,
        discount,
        serviceCharge,
        tax,
        pointsEarned,
        total,
        input.status,
        input.isPreorder ? 1 : 0,
        input.preorderDeadline ?? null,
        input.downPaymentReceived ?? 0,
        input.note?.trim() || null,
      ],
    )
    const transactionId = query<{ id: number }>('SELECT last_insert_rowid() AS id')[0].id

    // Pesanan yang dikirim ke dapur menandai item sebagai COOKING.
    const initialCookStatus = sendToKitchen ? 'COOKING' : 'PENDING'
    for (const it of input.items) {
      // Satuan terpilih → simpan quantity dalam satuan DASAR (stok/laporan tetap konsisten).
      const factor = it.unitFactor && it.unitFactor > 0 ? it.unitFactor : 1
      const baseQty = it.quantity * factor
      const line = lineTotal(it)
      const basePrice = baseQty ? line / baseQty : it.unitPrice ?? it.product.price
      db.run(
        `INSERT INTO transaction_details
           (transaction_id, product_id, quantity, unit_price, subtotal, unit, unit_qty, notes, discount, cooking_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          transactionId,
          it.product.id,
          baseQty,
          basePrice,
          line,
          it.unit ?? null,
          it.unit ? it.quantity : null,
          it.notes ?? null,
          it.discount ?? 0,
          initialCookStatus,
        ],
      )
      // Kurangi stok fisik gudang default saat transaksi diselesaikan. Untuk
      // paket bundling, stok yang dipotong adalah stok komponen (bukan paket).
      if (input.status === 'COMPLETED') {
        const whId = defaultWarehouseId(input.outletId)
        for (const t of stockTargets(it.product.id, baseQty)) {
          db.run(
            `INSERT INTO outlet_stocks (outlet_id, warehouse_id, product_id, stock) VALUES (?, ?, ?, ?)
             ON CONFLICT(outlet_id, warehouse_id, product_id) DO UPDATE SET stock = stock - ?`,
            [input.outletId, whId, t.productId, -t.qty, t.qty],
          )
        }
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

    // Rincian pembayaran berganda (Cash/Debit/Credit/QRIS/Voucher-as-tender).
    for (const p of input.payments ?? []) {
      db.run(
        `INSERT INTO transaction_payments
           (transaction_id, payment_method, amount_paid, tendered_amount, change_amount,
            voucher_id, qris_reference_number)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          transactionId,
          p.method,
          p.amountPaid,
          p.tenderedAmount,
          p.changeAmount ?? 0,
          p.voucherId ?? null,
          p.qrisReference ?? null,
        ],
      )
      // Voucher yang dipakai sebagai alat bayar (gift card) ditandai terpakai.
      if (p.voucherId) {
        db.run('UPDATE vouchers SET used_count = used_count + 1 WHERE id = ?', [p.voucherId])
      }
    }

    // Akumulasi poin loyalitas member + audit di point_logs.
    if (input.memberId && pointsEarned > 0) {
      db.run('UPDATE members SET points = points + ? WHERE id = ?', [pointsEarned, input.memberId])
      db.run(
        `INSERT INTO point_logs (member_id, transaction_id, points_change, change_reason)
         VALUES (?, ?, ?, 'TRANSACTION_EARNED')`,
        [input.memberId, transactionId, pointsEarned],
      )
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
  return { transactionId, invoiceNumber, subtotal, discount, serviceCharge, tax, total, pointsEarned }
}

// ── Merge Bill (Gabung Tagihan) ──────────────────────────────────────────────

export interface OpenBill {
  id: number
  invoice_number: string
  table_number: string | null
  item_count: number
  total_amount: number
  note: string | null
  transaction_date: string
}

export interface DraftDetail {
  id: number
  invoice_number: string
  facility_type: FacilityType
  table_number: string | null
  note: string | null
  member_id: number | null
  items: CartItem[]
}

/** Muat satu draft lengkap (header + item sebagai CartItem) untuk dibuka di kasir. */
export function getDraftForEdit(id: number, outletId: number): DraftDetail | null {
  const header = query<{
    id: number
    invoice_number: string
    facility_type: FacilityType
    table_number: string | null
    note: string | null
    member_id: number | null
    status: string
  }>(
    `SELECT id, invoice_number, facility_type, table_number, note, member_id, status
     FROM transactions WHERE id = ?`,
    [id],
  )[0]
  if (!header || header.status !== 'DRAFT') return null

  const rows = query<
    Product & {
      quantity: number
      unit_sel: string | null
      unit_qty: number | null
      line_subtotal: number
      line_notes: string | null
      line_discount: number | null
    }
  >(
    `SELECT d.quantity, d.unit AS unit_sel, d.unit_qty, d.subtotal AS line_subtotal, d.notes AS line_notes,
            COALESCE(d.discount, 0) AS line_discount,
            p.id, p.category_id, p.name, p.sku, p.barcode, p.price, p.cost_price,
            p.unit, p.min_stock, p.description, p.is_active, p.image_path, p.unit_conversions,
            c.name AS category_name,
            COALESCE((SELECT SUM(os.stock) FROM outlet_stocks os
                      WHERE os.product_id = p.id AND os.outlet_id = ?), 0) AS stock
     FROM transaction_details d
     JOIN products p ON p.id = d.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE d.transaction_id = ?
     ORDER BY d.id`,
    [outletId, id],
  )

  const items: CartItem[] = rows.map((r) => {
    const { quantity, unit_sel, unit_qty, line_subtotal, line_notes, line_discount, ...product } = r
    const disc = line_discount && line_discount > 0 ? line_discount : undefined
    // Bila item disimpan dalam satuan turunan, diskon sudah terserap ke unitPrice
    // (subtotal disimpan bersih), jadi tak dipulihkan terpisah agar tak dobel.
    if (unit_sel && unit_qty && unit_qty > 0) {
      return {
        product: product as Product,
        quantity: unit_qty,
        notes: line_notes ?? undefined,
        unit: unit_sel,
        unitFactor: quantity / unit_qty,
        unitPrice: line_subtotal / unit_qty,
      }
    }
    // Satuan dasar memakai harga produk, jadi diskon dipulihkan eksplisit.
    return { product: product as Product, quantity, notes: line_notes ?? undefined, discount: disc }
  })

  return {
    id: header.id,
    invoice_number: header.invoice_number,
    facility_type: header.facility_type,
    table_number: header.table_number,
    note: header.note,
    member_id: header.member_id,
    items,
  }
}

/** Daftar bill terbuka (status DRAFT) pada outlet aktif — kandidat digabung. */
export function listOpenBills(outletId: number): OpenBill[] {
  return query<OpenBill>(
    `SELECT t.id, t.invoice_number, t.table_number, t.total_amount, t.note, t.transaction_date,
            (SELECT COUNT(*) FROM transaction_details d WHERE d.transaction_id = t.id) AS item_count
     FROM transactions t
     WHERE t.outlet_id = ? AND t.status = 'DRAFT'
     ORDER BY t.id ASC`,
    [outletId],
  )
}

export interface MergeBillInput {
  billIds: number[]
  outletId: number
  taxRate: number
  taxEnabled: boolean
  serviceRate?: number
  serviceEnabled?: boolean
}

/**
 * Gabungkan beberapa bill DRAFT menjadi satu (bill dengan id terkecil jadi target).
 * Seluruh item dipindah ke target, total & pajak dihitung ulang, catatan digabung,
 * meja bill lain dikosongkan, lalu header bill lain dihapus. Satu transaksi SQL.
 */
export async function mergeBills(
  input: MergeBillInput,
): Promise<{ targetId: number; invoiceNumber: string; total: number }> {
  const ids = [...new Set(input.billIds)].filter((n) => Number.isInteger(n)).sort((a, b) => a - b)
  if (ids.length < 2) throw new Error('Pilih minimal 2 bill untuk digabung.')
  const target = ids[0]
  const others = ids.slice(1)
  const othersList = others.join(',')
  const db = getDb()

  db.run('BEGIN')
  try {
    const rows = query<{
      id: number
      discount_amount: number
      note: string | null
      table_number: string | null
    }>(`SELECT id, discount_amount, note, table_number FROM transactions WHERE id IN (${ids.join(',')})`)

    // Pindahkan seluruh item ke bill target.
    db.run(`UPDATE transaction_details SET transaction_id = ? WHERE transaction_id IN (${othersList})`, [
      target,
    ])
    // Tiket dapur bill lain dihapus; item pindahan tampil di tiket target.
    db.run(`DELETE FROM kds_tickets WHERE transaction_id IN (${othersList})`)

    // Kosongkan meja bill yang digabung (selain meja target).
    const targetTable = rows.find((r) => r.id === target)?.table_number ?? null
    for (const r of rows) {
      if (r.id !== target && r.table_number && r.table_number !== targetTable) {
        db.run(`UPDATE dining_tables SET status = 'EMPTY' WHERE outlet_id = ? AND table_number = ?`, [
          input.outletId,
          r.table_number,
        ])
      }
    }

    // Hitung ulang total target dari item gabungan.
    const sub =
      query<{ s: number }>(
        `SELECT COALESCE(SUM(subtotal), 0) AS s FROM transaction_details WHERE transaction_id = ?`,
        [target],
      )[0]?.s ?? 0
    const discount = Math.min(
      rows.reduce((a, r) => a + (r.discount_amount || 0), 0),
      sub,
    )
    const service = input.serviceEnabled ? Math.round((sub - discount) * (input.serviceRate ?? 0)) : 0
    const tax = input.taxEnabled ? Math.round((sub - discount + service) * input.taxRate) : 0
    const total = sub - discount + service + tax

    // Gabungkan catatan (urut id).
    const notes = rows.map((r) => r.note).filter((n): n is string => !!n && n.trim().length > 0)
    const mergedNote = notes.length ? notes.join(' | ') : null

    db.run(
      `UPDATE transactions
       SET subtotal_amount = ?, discount_amount = ?, service_charge_amount = ?, tax_amount = ?,
           total_amount = ?, note = ?
       WHERE id = ?`,
      [sub, discount, service, tax, total, mergedNote, target],
    )
    db.run(`DELETE FROM transactions WHERE id IN (${othersList})`)
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }

  await persist()
  publish('order:update')
  publish('tables:update')
  publish('kds:update')

  const inv =
    query<{ invoice_number: string; total_amount: number }>(
      'SELECT invoice_number, total_amount FROM transactions WHERE id = ?',
      [target],
    )[0]
  return { targetId: target, invoiceNumber: inv.invoice_number, total: inv.total_amount }
}

/**
 * Batalkan/hapus satu bill DRAFT beserta detail & tiket dapurnya, lalu kosongkan
 * mejanya. Hanya berlaku untuk status DRAFT (transaksi lunas tidak terhapus).
 * Satu transaksi SQL + publish realtime.
 */
export async function deleteDraft(id: number, outletId: number): Promise<void> {
  const db = getDb()
  const row = query<{ table_number: string | null; status: string }>(
    'SELECT table_number, status FROM transactions WHERE id = ?',
    [id],
  )[0]
  if (!row || row.status !== 'DRAFT') throw new Error('Hanya transaksi draft yang bisa dibatalkan.')

  db.run('BEGIN')
  try {
    db.run('DELETE FROM transaction_details WHERE transaction_id = ?', [id])
    db.run('DELETE FROM kds_tickets WHERE transaction_id = ?', [id])
    db.run("DELETE FROM transactions WHERE id = ? AND status = 'DRAFT'", [id])
    if (row.table_number) {
      db.run("UPDATE dining_tables SET status = 'EMPTY' WHERE outlet_id = ? AND table_number = ?", [
        outletId,
        row.table_number,
      ])
    }
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
  await persist()
  publish('order:update')
  publish('tables:update')
  publish('kds:update')
}

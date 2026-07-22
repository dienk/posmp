import { execute, getDb, persist, query } from '../../db/database'
import { publish } from '../../lib/realtime'
import { applyOpname, type OpnameCount } from '../stockopname/stockOpnameRepository'
import { applyStockTransfer, type TransferLineInput } from '../stocktransfer/stockTransferRepository'

export type ApprovalType = 'OPNAME' | 'STOCK_TRANSFER'
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface Approval {
  id: number
  outlet_id: number
  type: ApprovalType
  title: string
  summary: string | null
  payload: string
  status: ApprovalStatus
  requested_by: string | null
  requested_at: string
  decided_by: string | null
  decided_at: string | null
  decision_note: string | null
  result_ref: string | null
}

/** Payload aksi opname yang ditunda (dieksekusi saat disetujui). */
export interface OpnamePayload {
  outletId: number
  warehouseId: number
  warehouseName?: string
  counts: OpnameCount[]
  note?: string
}

/** Payload aksi transfer stok yang ditunda. */
export interface TransferPayload {
  outletId: number
  fromWarehouseId: number
  toWarehouseId: number
  fromWarehouseName?: string
  toWarehouseName?: string
  lines: TransferLineInput[]
  note?: string
}

/** Buat permintaan persetujuan baru (status PENDING). */
export async function createApproval(input: {
  outletId: number
  type: ApprovalType
  title: string
  summary: string
  payload: unknown
  requestedBy?: string
}): Promise<number> {
  const id = await execute(
    `INSERT INTO approvals (outlet_id, type, title, summary, payload, status, requested_by)
     VALUES (?, ?, ?, ?, ?, 'PENDING', ?)`,
    [
      input.outletId,
      input.type,
      input.title,
      input.summary,
      JSON.stringify(input.payload),
      input.requestedBy ?? null,
    ],
  )
  publish('order:update')
  return id
}

/** Daftar permintaan persetujuan (opsional difilter status), terbaru dulu. */
export function listApprovals(outletId: number, status?: ApprovalStatus): Approval[] {
  const where = status ? 'AND status = ?' : ''
  const params = status ? [outletId, status] : [outletId]
  return query<Approval>(
    `SELECT * FROM approvals WHERE outlet_id = ? ${where} ORDER BY id DESC`,
    params,
  )
}

/** Jumlah permintaan yang masih menunggu keputusan. */
export function pendingApprovalCount(outletId: number): number {
  return (
    query<{ n: number }>(
      "SELECT COUNT(*) AS n FROM approvals WHERE outlet_id = ? AND status = 'PENDING'",
      [outletId],
    )[0]?.n ?? 0
  )
}

/** Jalankan payload sesuai tipe; kembalikan referensi hasil untuk dicatat. */
async function executeApproval(a: Approval): Promise<string> {
  if (a.type === 'OPNAME') {
    const p = JSON.parse(a.payload) as OpnamePayload
    const res = await applyOpname(p.outletId, p.warehouseId, p.counts, p.note)
    return `OPN#${res.id} · ${res.adjusted} item`
  }
  if (a.type === 'STOCK_TRANSFER') {
    const p = JSON.parse(a.payload) as TransferPayload
    const res = await applyStockTransfer(p.outletId, p.fromWarehouseId, p.toWarehouseId, p.lines, p.note)
    return res.reference
  }
  throw new Error('Tipe persetujuan tidak dikenal.')
}

/**
 * Setujui permintaan: jalankan aksi terkait lebih dulu (agar bila gagal—mis.
 * stok kurang—status tetap PENDING), lalu tandai APPROVED beserta referensi hasil.
 */
export async function approveApproval(
  id: number,
  decidedBy: string,
  note?: string,
): Promise<string> {
  const a = query<Approval>('SELECT * FROM approvals WHERE id = ?', [id])[0]
  if (!a) throw new Error('Permintaan tidak ditemukan.')
  if (a.status !== 'PENDING') throw new Error('Permintaan sudah diputuskan.')

  const resultRef = await executeApproval(a) // melempar bila gagal → status tetap PENDING

  const db = getDb()
  db.run(
    `UPDATE approvals SET status = 'APPROVED', decided_by = ?, decided_at = CURRENT_TIMESTAMP,
            decision_note = ?, result_ref = ? WHERE id = ?`,
    [decidedBy, note?.trim() || null, resultRef, id],
  )
  await persist()
  publish('order:update')
  return resultRef
}

/** Tolak permintaan (tidak menjalankan aksi apa pun). */
export async function rejectApproval(id: number, decidedBy: string, note?: string): Promise<void> {
  const a = query<Approval>('SELECT status FROM approvals WHERE id = ?', [id])[0]
  if (!a) throw new Error('Permintaan tidak ditemukan.')
  if (a.status !== 'PENDING') throw new Error('Permintaan sudah diputuskan.')
  await execute(
    `UPDATE approvals SET status = 'REJECTED', decided_by = ?, decided_at = CURRENT_TIMESTAMP,
            decision_note = ? WHERE id = ?`,
    [decidedBy, note?.trim() || null, id],
  )
  publish('order:update')
}

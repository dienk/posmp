import { execute, getDb, persist, query } from '../../db/database'
import { generateInvoiceNumber } from '../../lib/format'
import { publish } from '../../lib/realtime'

export type InstallmentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE'

export interface InstallmentPlan {
  id: number
  transaction_id: number
  invoice_number: string
  member_id: number
  member_name: string
  total_tenure: number
  interest_rate: number
  monthly_installment: number
  remaining_balance: number
  due_date: string
  status: InstallmentStatus
  total_payable: number
}

export interface CreatePlanInput {
  outletId: number
  memberId: number
  principal: number
  tenure: number
  interestRate: number // % per bulan (bunga flat)
}

/** Total yang harus dibayar dengan bunga flat: pokok × (1 + bunga% × tenor). */
export function computeTotalPayable(principal: number, tenure: number, interestRate: number): number {
  return Math.round(principal * (1 + (interestRate / 100) * tenure))
}

function addMonths(base: Date, months: number): string {
  const d = new Date(base)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

/**
 * Buat rencana cicilan internal untuk member.
 * Membuat transaksi penjualan kredit (COMPLETED) sebagai dasar, lalu jadwal
 * cicilan dengan sisa tagihan penuh & jatuh tempo bulan depan. Satu transaksi SQL.
 */
export async function createPlan(input: CreatePlanInput): Promise<number> {
  const monthly = Math.ceil(
    computeTotalPayable(input.principal, input.tenure, input.interestRate) / input.tenure,
  )
  // Sisa tagihan = jumlah seluruh angsuran (konsisten dengan monthly × tenor).
  const totalPayable = monthly * input.tenure
  const firstDue = addMonths(new Date(), 1)
  const invoice = generateInvoiceNumber()

  const db = getDb()
  db.run('BEGIN')
  try {
    db.run(
      `INSERT INTO transactions
         (outlet_id, invoice_number, facility_type, order_source, member_id,
          subtotal_amount, total_amount, status)
       VALUES (?, ?, 'TAKEAWAY', 'POS_OFFLINE', ?, ?, ?, 'COMPLETED')`,
      [input.outletId, invoice, input.memberId, input.principal, input.principal],
    )
    const transactionId = query<{ id: number }>('SELECT last_insert_rowid() AS id')[0].id
    db.run(
      `INSERT INTO transaction_installments
         (transaction_id, member_id, total_tenure, interest_rate, monthly_installment,
          remaining_balance, due_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'UNPAID')`,
      [
        transactionId,
        input.memberId,
        input.tenure,
        input.interestRate,
        monthly,
        totalPayable,
        firstDue,
      ],
    )
    const planId = query<{ id: number }>('SELECT last_insert_rowid() AS id')[0].id
    db.run('COMMIT')
    await persist()
    publish('order:update')
    return planId
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
}

export function listPlans(outletId: number): InstallmentPlan[] {
  return query<InstallmentPlan>(
    `SELECT i.id, i.transaction_id, t.invoice_number, i.member_id, m.name AS member_name,
            i.total_tenure, i.interest_rate, i.monthly_installment, i.remaining_balance,
            i.due_date, i.status,
            (i.monthly_installment * i.total_tenure) AS total_payable
     FROM transaction_installments i
     JOIN transactions t ON t.id = i.transaction_id
     JOIN members m ON m.id = i.member_id
     WHERE t.outlet_id = ?
     ORDER BY i.status = 'PAID', i.due_date ASC, i.id DESC`,
    [outletId],
  )
}

/**
 * Catat pembayaran satu angsuran. Mengurangi sisa tagihan, memajukan jatuh tempo,
 * dan memutakhirkan status (PARTIALLY_PAID / PAID).
 */
export async function payInstallment(planId: number, amount: number): Promise<void> {
  const plan = query<{ remaining_balance: number; due_date: string }>(
    'SELECT remaining_balance, due_date FROM transaction_installments WHERE id = ?',
    [planId],
  )[0]
  if (!plan) throw new Error('Rencana cicilan tidak ditemukan.')

  const newRemaining = Math.max(0, plan.remaining_balance - amount)
  const status: InstallmentStatus = newRemaining <= 0 ? 'PAID' : 'PARTIALLY_PAID'
  const nextDue = newRemaining <= 0 ? plan.due_date : addMonths(new Date(plan.due_date), 1)

  await execute(
    `UPDATE transaction_installments
     SET remaining_balance = ?, status = ?, due_date = ?
     WHERE id = ?`,
    [newRemaining, status, nextDue, planId],
  )
  publish('order:update')
}

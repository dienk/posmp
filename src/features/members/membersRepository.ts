import { execute, getDb, persist, query } from '../../db/database'

export type MemberTier = 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND'
export type MemberStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED' | 'SUSPENDED'

export interface Member {
  id: number
  name: string
  phone: string
  email: string | null
  points: number
  address: string | null
  birth_date: string | null
  gender: string | null // 'L' | 'P'
  occupation: string | null
  member_number: string | null
  tier: MemberTier
  expiry_date: string | null
  status: MemberStatus
  balance: number
  preferences: string | null
  created_at: string
}

export interface MemberInput {
  name: string
  phone: string
  email?: string | null
  address?: string | null
  birthDate?: string | null
  gender?: string | null
  occupation?: string | null
  memberNumber?: string | null
  tier?: MemberTier
  expiryDate?: string | null
  status?: MemberStatus
  balance?: number
  preferences?: string | null
}

export const TIERS: MemberTier[] = ['SILVER', 'GOLD', 'PLATINUM', 'DIAMOND']
export const STATUSES: { value: MemberStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Aktif' },
  { value: 'INACTIVE', label: 'Nonaktif' },
  { value: 'SUSPENDED', label: 'Ditangguhkan' },
  { value: 'BLOCKED', label: 'Diblokir' },
]

export function listMembers(keyword?: string): Member[] {
  if (keyword && keyword.trim()) {
    const like = `%${keyword.trim()}%`
    return query<Member>(
      `SELECT * FROM members
       WHERE name LIKE ? OR phone LIKE ? OR member_number LIKE ? OR email LIKE ?
       ORDER BY name`,
      [like, like, like, like],
    )
  }
  return query<Member>('SELECT * FROM members ORDER BY name')
}

export function getMember(id: number): Member | undefined {
  return query<Member>('SELECT * FROM members WHERE id = ?', [id])[0]
}

export function findMemberByPhone(phone: string): Member | undefined {
  return query<Member>('SELECT * FROM members WHERE phone = ?', [phone.trim()])[0]
}

/** Nomor kartu otomatis bila kosong: MP + 8 digit dari waktu. */
function generateMemberNumber(): string {
  return 'MP' + String(Date.now()).slice(-8)
}

function bind(input: MemberInput): (string | number | null)[] {
  return [
    input.name.trim(),
    input.phone.trim(),
    input.email?.trim() || null,
    input.address?.trim() || null,
    input.birthDate || null,
    input.gender || null,
    input.occupation?.trim() || null,
    input.memberNumber?.trim() || generateMemberNumber(),
    input.tier ?? 'SILVER',
    input.expiryDate || null,
    input.status ?? 'ACTIVE',
    input.balance ?? 0,
    input.preferences?.trim() || null,
  ]
}

export async function createMember(input: MemberInput): Promise<number> {
  return execute(
    `INSERT INTO members
       (name, phone, email, address, birth_date, gender, occupation, member_number,
        tier, expiry_date, status, balance, preferences, points)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    bind(input),
  )
}

export async function updateMember(id: number, input: MemberInput): Promise<void> {
  await execute(
    `UPDATE members SET
       name = ?, phone = ?, email = ?, address = ?, birth_date = ?, gender = ?,
       occupation = ?, member_number = ?, tier = ?, expiry_date = ?, status = ?,
       balance = ?, preferences = ?
     WHERE id = ?`,
    [...bind(input), id],
  )
}

/** Hapus member; ditolak bila punya riwayat transaksi/poin (ubah status saja). */
export async function deleteMember(id: number): Promise<void> {
  const refs =
    query<{ n: number }>('SELECT COUNT(*) AS n FROM transactions WHERE member_id = ?', [id])[0].n +
    query<{ n: number }>('SELECT COUNT(*) AS n FROM point_logs WHERE member_id = ?', [id])[0].n
  if (refs > 0)
    throw new Error('Member punya riwayat — ubah status jadi Nonaktif/Diblokir daripada dihapus.')
  await execute('DELETE FROM members WHERE id = ?', [id])
}

export interface MemberTx {
  invoice_number: string
  transaction_date: string
  total_amount: number
  status: string
  points_earned: number
}

export function memberTransactions(memberId: number, limit = 20): MemberTx[] {
  return query<MemberTx>(
    `SELECT invoice_number, transaction_date, total_amount, status, points_earned
     FROM transactions WHERE member_id = ? ORDER BY id DESC LIMIT ?`,
    [memberId, limit],
  )
}

export function memberPointHistory(memberId: number, limit = 20) {
  return query<{ points_change: number; change_reason: string; logged_at: string }>(
    `SELECT points_change, change_reason, logged_at FROM point_logs
     WHERE member_id = ? ORDER BY id DESC LIMIT ?`,
    [memberId, limit],
  )
}

/** Sesuaikan saldo/kredit deposit member. */
export async function adjustBalance(memberId: number, delta: number): Promise<void> {
  await execute('UPDATE members SET balance = balance + ? WHERE id = ?', [delta, memberId])
}

/** Tambah poin loyalitas + audit point_logs (satu transaksi SQL). */
export async function earnPoints(
  memberId: number,
  points: number,
  transactionId: number,
): Promise<void> {
  if (points <= 0) return
  const db = getDb()
  db.run('BEGIN')
  try {
    db.run('UPDATE members SET points = points + ? WHERE id = ?', [points, memberId])
    db.run(
      `INSERT INTO point_logs (member_id, transaction_id, points_change, change_reason)
       VALUES (?, ?, ?, 'TRANSACTION_EARNED')`,
      [memberId, transactionId, points],
    )
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
  await persist()
}

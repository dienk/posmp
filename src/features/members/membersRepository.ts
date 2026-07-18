import { execute, getDb, persist, query } from '../../db/database'

export interface Member {
  id: number
  name: string
  phone: string
  email: string | null
  points: number
  created_at: string
}

export function listMembers(keyword?: string): Member[] {
  if (keyword && keyword.trim()) {
    const like = `%${keyword.trim()}%`
    return query<Member>(
      `SELECT * FROM members WHERE name LIKE ? OR phone LIKE ? ORDER BY name`,
      [like, like],
    )
  }
  return query<Member>('SELECT * FROM members ORDER BY name')
}

export function findMemberByPhone(phone: string): Member | undefined {
  return query<Member>('SELECT * FROM members WHERE phone = ?', [phone.trim()])[0]
}

export async function createMember(
  name: string,
  phone: string,
  email: string | null,
): Promise<number> {
  return execute('INSERT INTO members (name, phone, email, points) VALUES (?, ?, ?, 0)', [
    name.trim(),
    phone.trim(),
    email?.trim() || null,
  ])
}

/**
 * Tambahkan poin loyalitas ke member sekaligus mencatat audit di point_logs.
 * Dipanggil saat transaksi diselesaikan (earn) — dalam satu transaksi SQL.
 */
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

export function memberPointHistory(memberId: number, limit = 20) {
  return query<{ points_change: number; change_reason: string; logged_at: string }>(
    `SELECT points_change, change_reason, logged_at FROM point_logs
     WHERE member_id = ? ORDER BY id DESC LIMIT ?`,
    [memberId, limit],
  )
}

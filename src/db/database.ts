import initSqlJs, { type Database, type SqlValue } from 'sql.js'
// Vite resolves the wasm binary to a local URL so the DB engine works 100% offline.
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import schemaSql from './schema.sql?raw'
import { seedDatabase } from './seed'

const IDB_NAME = 'posmerahputih'
const IDB_STORE = 'sqlite'
const IDB_KEY = 'main.db'

let dbInstance: Database | null = null
// Simpan factory sql.js agar snapshot bisa dimuat ulang dari IndexedDB (lintas-tab).
let sqlEngine: Awaited<ReturnType<typeof initSqlJs>> | null = null

/** Buka koneksi IndexedDB tempat file SQLite dipersist. */
function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      const idb = req.result
      if (!idb.objectStoreNames.contains(IDB_STORE)) {
        idb.createObjectStore(IDB_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function loadPersisted(): Promise<Uint8Array | null> {
  const idb = await openIndexedDb()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY)
    req.onsuccess = () => resolve((req.result as Uint8Array) ?? null)
    req.onerror = () => reject(req.error)
  })
}

async function writePersisted(bytes: Uint8Array): Promise<void> {
  const idb = await openIndexedDb()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(bytes, IDB_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/**
 * Inisialisasi database local-first.
 * Memuat file dari IndexedDB bila ada; jika belum, membangun 22 tabel dari
 * schema.sql lalu mengisi data awal (seed).
 */
export async function initDatabase(): Promise<Database> {
  if (dbInstance) return dbInstance

  const SQL = await initSqlJs({ locateFile: () => sqlWasmUrl })
  sqlEngine = SQL
  const persisted = await loadPersisted()

  if (persisted) {
    dbInstance = new SQL.Database(persisted)
  } else {
    dbInstance = new SQL.Database()
    dbInstance.run(schemaSql)
    seedDatabase(dbInstance)
    await persist()
  }

  const migrated = migrateSchema(dbInstance)
  dbInstance.run('PRAGMA foreign_keys = ON;')
  if (migrated) await persist()
  return dbInstance
}

/**
 * Muat ulang snapshot database dari IndexedDB ke memori, mengganti instance
 * saat ini. Karena tiap tab memegang salinan sql.js in-memory sendiri, tampilan
 * read-only lintas-tab (mis. Monitor TV, Self-Order) harus memanggil ini agar
 * melihat tulisan terbaru dari tab kasir. Aman & idempoten.
 */
export async function reloadDatabase(): Promise<Database> {
  if (!sqlEngine) return initDatabase()
  const persisted = await loadPersisted()
  if (!persisted) return dbInstance ?? initDatabase()
  dbInstance?.close()
  dbInstance = new sqlEngine.Database(persisted)
  dbInstance.run('PRAGMA foreign_keys = ON;')
  return dbInstance
}

/**
 * Migrasi ringan: menambah kolom baru pada tabel yang sudah ada di database lama
 * (SQLite tak punya "ADD COLUMN IF NOT EXISTS"). Idempoten & aman dipanggil ulang.
 * Mengembalikan true bila ada perubahan (perlu dipersist).
 */
function migrateSchema(db: Database): boolean {
  let changed = false
  const columnsOf = (table: string): Set<string> => {
    const res = db.exec(`PRAGMA table_info('${table}')`)
    return new Set(res[0] ? res[0].values.map((r) => String(r[1])) : [])
  }

  // Perluasan tabel members (data keanggotaan lengkap).
  const memberCols = columnsOf('members')
  const memberAdds: [string, string][] = [
    ['address', 'TEXT'],
    ['birth_date', 'DATE'],
    ['gender', 'TEXT'],
    ['occupation', 'TEXT'],
    ['member_number', 'TEXT'],
    ['tier', "TEXT DEFAULT 'SILVER'"],
    ['expiry_date', 'DATE'],
    ['status', "TEXT NOT NULL DEFAULT 'ACTIVE'"],
    ['balance', 'REAL NOT NULL DEFAULT 0'],
    ['preferences', 'TEXT'],
  ]
  for (const [name, def] of memberAdds) {
    if (!memberCols.has(name)) {
      db.run(`ALTER TABLE members ADD COLUMN ${name} ${def}`)
      changed = true
    }
  }

  // Tabel kasir (titik/mesin kasir per outlet) — dibuat untuk database lama.
  const hasCashiers = db.exec(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='cashiers'`,
  ).length > 0
  if (!hasCashiers) {
    db.run(`CREATE TABLE IF NOT EXISTS cashiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      outlet_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      code TEXT,
      location TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY(outlet_id) REFERENCES outlets(id)
    )`)
    // Beri satu kasir default untuk tiap outlet yang sudah ada.
    const outlets = db.exec('SELECT id FROM outlets ORDER BY id')
    if (outlets[0]) {
      for (const row of outlets[0].values) {
        db.run(
          `INSERT INTO cashiers (outlet_id, name, code, is_active) VALUES (?, 'Kasir 1', 'KSR-01', 1)`,
          [Number(row[0])],
        )
      }
    }
    changed = true
  }

  // Kolom kapasitas maksimum pada meja (default = kapasitas standar saat ini).
  const tableCols = columnsOf('dining_tables')
  if (!tableCols.has('max_capacity')) {
    db.run('ALTER TABLE dining_tables ADD COLUMN max_capacity INTEGER DEFAULT 4')
    db.run('UPDATE dining_tables SET max_capacity = capacity WHERE max_capacity IS NULL OR max_capacity < capacity')
    changed = true
  }

  // Kolom catatan khusus pada header transaksi.
  const txCols = columnsOf('transactions')
  if (!txCols.has('note')) {
    db.run('ALTER TABLE transactions ADD COLUMN note TEXT')
    changed = true
  }

  // Kolom detail tambahan pada master produk.
  const productCols = columnsOf('products')
  const productAdds: [string, string][] = [
    ['barcode', 'TEXT'],
    ['cost_price', 'REAL DEFAULT 0'],
    ['unit', "TEXT DEFAULT 'pcs'"],
    ['min_stock', 'INTEGER DEFAULT 0'],
    ['description', 'TEXT'],
    ['is_active', 'INTEGER NOT NULL DEFAULT 1'],
  ]
  for (const [name, def] of productAdds) {
    if (!productCols.has(name)) {
      db.run(`ALTER TABLE products ADD COLUMN ${name} ${def}`)
      changed = true
    }
  }

  const tableExists = (name: string): boolean =>
    db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${name}'`).length > 0

  // Master Satuan (Data Master) — dibuat + diisi default untuk database lama.
  if (!tableExists('units')) {
    db.run(`CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1
    )`)
    for (const u of ['pcs', 'porsi', 'gelas', 'botol', 'box', 'pack', 'kg', 'gram', 'liter']) {
      db.run('INSERT INTO units (name, is_active) VALUES (?, 1)', [u])
    }
    changed = true
  }

  // Master Pajak (Data Master) — dibuat + diisi dari tarif pajak setelan saat ini.
  if (!tableExists('taxes')) {
    db.run(`CREATE TABLE IF NOT EXISTS taxes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      rate REAL NOT NULL DEFAULT 0,
      description TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    )`)
    const rateRow = db.exec(`SELECT setting_value FROM app_settings WHERE setting_key = 'tax_rate'`)
    const rate = rateRow[0] ? Number(rateRow[0].values[0][0]) * 100 : 10
    db.run('INSERT INTO taxes (name, rate, description, is_default, is_active) VALUES (?, ?, ?, 1, 1)', [
      'PPN',
      Number.isFinite(rate) ? rate : 10,
      'Pajak Pertambahan Nilai',
    ])
    changed = true
  }

  // Tabel Stock Opname (header + detail) — dibuat untuk database lama.
  if (!tableExists('stock_opnames')) {
    db.run(`CREATE TABLE IF NOT EXISTS stock_opnames (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      outlet_id INTEGER NOT NULL,
      reference_number TEXT,
      opname_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      note TEXT,
      FOREIGN KEY(outlet_id) REFERENCES outlets(id)
    )`)
    db.run(`CREATE TABLE IF NOT EXISTS stock_opname_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      opname_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      system_qty INTEGER NOT NULL,
      physical_qty INTEGER NOT NULL,
      difference INTEGER NOT NULL,
      FOREIGN KEY(opname_id) REFERENCES stock_opnames(id),
      FOREIGN KEY(product_id) REFERENCES products(id)
    )`)
    changed = true
  }
  return changed
}

export function getDb(): Database {
  if (!dbInstance) throw new Error('Database belum diinisialisasi. Panggil initDatabase() dulu.')
  return dbInstance
}

/** Simpan snapshot database ke IndexedDB. Panggil setelah operasi tulis. */
export async function persist(): Promise<void> {
  if (!dbInstance) return
  await writePersisted(dbInstance.export())
}

/** Jalankan SELECT dan kembalikan array objek baris bertipe. */
export function query<T = Record<string, SqlValue>>(
  sql: string,
  params: SqlValue[] = [],
): T[] {
  const db = getDb()
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows: T[] = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T)
  }
  stmt.free()
  return rows
}

/** Jalankan satu statement tulis (INSERT/UPDATE/DELETE) lalu persist. */
export async function execute(sql: string, params: SqlValue[] = []): Promise<number> {
  const db = getDb()
  db.run(sql, params)
  const id = query<{ id: number }>('SELECT last_insert_rowid() AS id')[0]?.id ?? 0
  await persist()
  return id
}

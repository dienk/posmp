import initSqlJs, { type Database, type SqlValue } from 'sql.js'
// Vite resolves the wasm binary to a local URL so the DB engine works 100% offline.
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import schemaSql from './schema.sql?raw'
import { seedDatabase } from './seed'

const IDB_NAME = 'posmerahputih'
const IDB_STORE = 'sqlite'
const IDB_KEY = 'main.db'

let dbInstance: Database | null = null

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
  const persisted = await loadPersisted()

  if (persisted) {
    dbInstance = new SQL.Database(persisted)
  } else {
    dbInstance = new SQL.Database()
    dbInstance.run(schemaSql)
    seedDatabase(dbInstance)
    await persist()
  }

  dbInstance.run('PRAGMA foreign_keys = ON;')
  return dbInstance
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

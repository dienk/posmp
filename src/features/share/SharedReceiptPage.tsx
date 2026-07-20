import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import type { ReceiptData } from '../history/historyRepository'
import { buildReceiptHtml, ReceiptView } from '../receipt/ReceiptModal'
import { getReceiptConfig } from '../receipt/receiptConfig'
import { decodePayload } from './shareLink'

/** Cetak struk lewat jendela baru (dipakai pada tautan publik). */
function printHtml(html: string) {
  const w = window.open('', '_blank', 'width=380,height=640')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  w.print()
}

export default function SharedReceiptPage() {
  const { payload } = useParams<{ payload: string }>()
  const data = useMemo<ReceiptData | null>(() => {
    try {
      return decodePayload<ReceiptData>(payload ?? '')
    } catch {
      return null
    }
  }, [payload])

  // Struk publik memakai gaya bawaan (tanpa akses pengaturan merchant).
  const config = useMemo(() => getReceiptConfig({}), [])

  if (!data) return <InvalidLink />

  return (
    <div className="flex min-h-screen flex-col items-center bg-background p-4">
      <div className="w-full max-w-sm rounded-2xl bg-panel p-5 shadow-card">
        <ReceiptView data={data} config={config} />
      </div>
      <button
        onClick={() => printHtml(buildReceiptHtml(data, config))}
        className="mt-4 rounded-xl bg-status-occupied px-6 py-2.5 text-sm font-bold text-white hover:brightness-95"
      >
        🖨️ Cetak / Simpan PDF
      </button>
      <p className="mt-3 text-xs text-ink-soft">Struk digital · POSMerahPutih</p>
    </div>
  )
}

function InvalidLink() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background p-6 text-center">
      <p className="text-4xl">🔗</p>
      <p className="text-sm font-semibold text-ink">Tautan struk tidak valid atau rusak.</p>
      <p className="text-xs text-ink-soft">Minta pengirim untuk membagikan ulang tautannya.</p>
    </div>
  )
}

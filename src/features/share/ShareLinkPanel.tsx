import { useState } from 'react'
import { mailtoLink, waLink } from './shareLink'

interface Props {
  /** URL self-contained yang dibagikan. */
  url: string
  /** Pesan pengiring (tanpa URL — URL ditambahkan otomatis). */
  message: string
  /** Subjek untuk email. */
  subject?: string
  /** Nomor telepon awal (mis. telepon member/pelanggan). */
  initialPhone?: string
}

/** Panel aksi "kirim link": WhatsApp, Email, Salin, Bagikan (native). */
export default function ShareLinkPanel({ url, message, subject, initialPhone }: Props) {
  const [phone, setPhone] = useState(initialPhone ?? '')
  const [copied, setCopied] = useState(false)

  const fullText = `${message}\n${url}`
  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard mungkin diblokir */
    }
  }

  const nativeShare = async () => {
    try {
      await navigator.share({ title: subject ?? 'POSMerahPutih', text: message, url })
    } catch {
      /* dibatalkan */
    }
  }

  return (
    <div className="rounded-xl border border-black/10 bg-background p-3">
      <label className="mb-1 block text-[11px] font-medium text-ink-soft">
        No. WhatsApp tujuan (opsional)
      </label>
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        inputMode="tel"
        placeholder="mis. 0812xxxxxxx"
        className="mb-2 w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-brand-strong"
      />
      <div className="flex flex-wrap gap-2">
        <a
          href={waLink(phone, fullText)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-[#25D366] px-3 py-2 text-sm font-semibold text-white hover:brightness-95"
        >
          📲 WhatsApp
        </a>
        <a
          href={mailtoLink(subject ?? 'POSMerahPutih', fullText)}
          className="rounded-lg border border-black/10 bg-panel px-3 py-2 text-sm font-semibold text-ink hover:bg-background"
        >
          ✉️ Email
        </a>
        <button
          type="button"
          onClick={copy}
          className="rounded-lg border border-black/10 bg-panel px-3 py-2 text-sm font-semibold text-ink hover:bg-background"
        >
          {copied ? '✓ Tersalin' : '🔗 Salin Link'}
        </button>
        {canNativeShare && (
          <button
            type="button"
            onClick={nativeShare}
            className="rounded-lg border border-black/10 bg-panel px-3 py-2 text-sm font-semibold text-ink hover:bg-background"
          >
            📤 Bagikan
          </button>
        )}
      </div>
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="mt-2 w-full truncate rounded-lg border border-dashed border-black/15 bg-panel px-2 py-1.5 text-[11px] text-ink-soft outline-none"
      />
      <p className="mt-1.5 text-[11px] text-ink-soft">
        Tautan bersifat mandiri (data tersimpan di dalam tautan) — penerima cukup membukanya di
        peramban.
      </p>
    </div>
  )
}

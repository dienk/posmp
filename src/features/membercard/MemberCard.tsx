import { useEffect, useState } from 'react'
import type { CardConfig } from './cardConfig'
import {
  cardSvg,
  downloadCardPng,
  getLogoDataUrl,
  printCard,
  svgToDataUrl,
  type CardMember,
} from './cardRender'

export function useLogoDataUrl(): string {
  const [logo, setLogo] = useState('')
  useEffect(() => {
    let ok = true
    getLogoDataUrl().then((d) => ok && setLogo(d))
    return () => {
      ok = false
    }
  }, [])
  return logo
}

/** Tampilan kartu (SVG di-render sebagai gambar) — dipakai preview & modal. */
export function MemberCard({ member, config }: { member: CardMember; config: CardConfig }) {
  const logo = useLogoDataUrl()
  const svg = cardSvg(member, config, logo)
  return (
    <img
      src={svgToDataUrl(svg)}
      alt="ID Card"
      className="w-full max-w-[400px] rounded-2xl shadow-lg"
      style={{ aspectRatio: '640 / 400' }}
    />
  )
}

export function MemberCardModal({
  member,
  config,
  onClose,
}: {
  member: CardMember
  config: CardConfig
  onClose: () => void
}) {
  const logo = useLogoDataUrl()
  const svg = cardSvg(member, config, logo)
  const filename = `kartu-${(member.member_number ?? member.name).replace(/\s+/g, '-')}.png`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-bold text-ink">Kartu ID Member</p>
          <button onClick={onClose} className="text-xl leading-none text-ink-soft hover:text-ink">
            ×
          </button>
        </div>
        <img
          src={svgToDataUrl(svg)}
          alt="ID Card"
          className="w-full rounded-2xl shadow-lg"
          style={{ aspectRatio: '640 / 400' }}
        />
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => printCard(svg)}
            className="rounded-xl bg-status-occupied py-2.5 text-sm font-bold text-white hover:brightness-95"
          >
            🖨️ Cetak
          </button>
          <button
            onClick={() => downloadCardPng(svg, filename)}
            className="rounded-xl border border-black/10 py-2.5 text-sm font-semibold text-ink hover:bg-background"
          >
            ⬇ Unduh PNG
          </button>
        </div>
      </div>
    </div>
  )
}

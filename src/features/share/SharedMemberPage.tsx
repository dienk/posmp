import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { MemberCard } from '../membercard/MemberCard'
import { getCardConfig } from '../membercard/cardConfig'
import type { CardMember } from '../membercard/cardRender'
import { decodePayload } from './shareLink'

interface MemberPayload extends CardMember {
  outlet?: string
}

export default function SharedMemberPage() {
  const { payload } = useParams<{ payload: string }>()
  const data = useMemo<MemberPayload | null>(() => {
    try {
      return decodePayload<MemberPayload>(payload ?? '')
    } catch {
      return null
    }
  }, [payload])

  const config = useMemo(() => getCardConfig({}), [])

  if (!data) return <InvalidLink />

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4">
      <div className="w-full max-w-[400px]">
        <MemberCard member={data} config={config} />
      </div>
      <div className="w-full max-w-[400px] rounded-2xl bg-white p-4 text-center shadow-card">
        <p className="text-lg font-bold text-ink">{data.name}</p>
        <p className="text-xs text-ink-soft">
          {data.member_number ?? '—'} · {data.tier}
        </p>
        <p className="mt-2 text-2xl font-extrabold text-status-occupied">
          {data.points.toLocaleString('id-ID')} <span className="text-sm font-semibold">poin</span>
        </p>
        {data.expiry_date && (
          <p className="mt-1 text-xs text-ink-soft">Berlaku s/d {data.expiry_date}</p>
        )}
        {data.outlet && <p className="mt-2 text-xs text-ink-soft">{data.outlet}</p>}
      </div>
      <p className="text-xs text-ink-soft">Kartu member digital · POSMerahPutih</p>
    </div>
  )
}

function InvalidLink() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background p-6 text-center">
      <p className="text-4xl">🔗</p>
      <p className="text-sm font-semibold text-ink">Tautan kartu member tidak valid atau rusak.</p>
      <p className="text-xs text-ink-soft">Minta pengirim untuk membagikan ulang tautannya.</p>
    </div>
  )
}

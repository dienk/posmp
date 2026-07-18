import type { CardConfig } from './cardConfig'

export interface CardMember {
  name: string
  member_number: string | null
  tier: string
  expiry_date: string | null
  points: number
}

export const CARD_W = 640
export const CARD_H = 400

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Barcode dekoratif dari nomor kartu (visual, tidak untuk dipindai). */
function barcode(seed: string, x: number, y: number, h: number, fill: string): string {
  let str = ''
  let cx = x
  const codes = (seed || 'MEMBER').split('').map((c) => c.charCodeAt(0))
  for (let i = 0; i < 34; i++) {
    const w = 1.5 + (codes[i % codes.length] % 4)
    if (i % 2 === 0) str += `<rect x="${cx.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${h}" fill="${fill}"/>`
    cx += w + 1.4
  }
  return str
}

/** Bangun SVG ID Card (640x400). Logo di-embed sebagai data URL bila ada. */
export function cardSvg(m: CardMember, c: CardConfig, logoDataUrl: string): string {
  const fg = c.textLight ? '#ffffff' : '#1e293b'
  const soft = c.textLight ? 'rgba(255,255,255,0.75)' : 'rgba(30,41,59,0.7)'
  const chip = c.textLight ? 'rgba(255,255,255,0.18)' : 'rgba(30,41,59,0.12)'
  const hasLogo = c.showLogo && logoDataUrl
  const titleX = hasLogo ? 116 : 40
  const number = (m.member_number ?? '—').replace(/(.{4})/g, '$1 ').trim()

  const logo = hasLogo
    ? `<rect x="40" y="32" width="60" height="60" rx="12" fill="#ffffff"/>
       <image x="45" y="37" width="50" height="50" href="${logoDataUrl}" preserveAspectRatio="xMidYMid meet"/>`
    : ''

  const tier = c.showTier
    ? `<rect x="40" y="330" width="${28 + m.tier.length * 10}" height="30" rx="15" fill="${chip}"/>
       <text x="54" y="350" font-size="15" font-weight="700" fill="${fg}">${esc(m.tier)}</text>`
    : ''
  const expiry =
    c.showExpiry && m.expiry_date
      ? `<text x="40" y="386" font-size="13" fill="${soft}">Berlaku s/d ${esc(m.expiry_date)}</text>`
      : ''
  const points = c.showPoints
    ? `<text x="600" y="352" text-anchor="end" font-size="26" font-weight="800" fill="${fg}">${m.points}</text>
       <text x="600" y="372" text-anchor="end" font-size="12" fill="${soft}">POIN</text>`
    : ''
  const bars = c.showBarcode
    ? barcode(m.member_number ?? m.name, 380, 40, 44, c.textLight ? 'rgba(255,255,255,0.85)' : 'rgba(30,41,59,0.7)')
    : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_W} ${CARD_H}" width="${CARD_W}" height="${CARD_H}" font-family="Inter, Arial, sans-serif">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c.bgStart}"/><stop offset="1" stop-color="${c.bgEnd}"/>
    </linearGradient></defs>
    <rect x="0" y="0" width="${CARD_W}" height="${CARD_H}" rx="28" fill="url(#bg)"/>
    ${logo}
    <text x="${titleX}" y="58" font-size="20" font-weight="800" letter-spacing="1" fill="${fg}">${esc(c.title)}</text>
    <text x="${titleX}" y="80" font-size="14" fill="${soft}">${esc(c.subtitle)}</text>
    ${bars}
    <text x="40" y="205" font-size="12" letter-spacing="2" fill="${soft}">NAMA MEMBER</text>
    <text x="40" y="240" font-size="34" font-weight="800" fill="${fg}">${esc(m.name)}</text>
    <text x="40" y="288" font-size="22" letter-spacing="4" fill="${fg}" font-family="'Courier New', monospace">${esc(number)}</text>
    ${tier}
    ${expiry}
    ${points}
  </svg>`
}

export function svgToDataUrl(svg: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

let logoCache: string | null = null
/** Ambil logo aplikasi sebagai data URL (di-cache) untuk di-embed ke SVG. */
export async function getLogoDataUrl(): Promise<string> {
  if (logoCache !== null) return logoCache
  try {
    const resp = await fetch('/logo-mark.png')
    const blob = await resp.blob()
    logoCache = await new Promise<string>((res, rej) => {
      const fr = new FileReader()
      fr.onload = () => res(fr.result as string)
      fr.onerror = () => rej(fr.error)
      fr.readAsDataURL(blob)
    })
  } catch {
    logoCache = ''
  }
  return logoCache
}

export function printCard(svg: string): void {
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(iframe)
  const doc = iframe.contentWindow?.document
  if (!doc) return
  doc.open()
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><style>@page{margin:10mm}body{margin:0;display:flex;justify-content:center;padding:20px}svg{width:320px;height:auto}</style></head><body>${svg}</body></html>`,
  )
  doc.close()
  iframe.contentWindow?.focus()
  iframe.contentWindow?.print()
  window.setTimeout(() => iframe.remove(), 1000)
}

export async function downloadCardPng(svg: string, filename: string): Promise<void> {
  const img = new Image()
  await new Promise<void>((res, rej) => {
    img.onload = () => res()
    img.onerror = () => rej(new Error('render gagal'))
    img.src = svgToDataUrl(svg)
  })
  const canvas = document.createElement('canvas')
  canvas.width = CARD_W * 2
  canvas.height = CARD_H * 2
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.drawImage(img, 0, 0, CARD_W * 2, CARD_H * 2)
  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

// Utilitas "kirim link" self-contained (local-first): data ditaruh di fragment
// URL (#…) sehingga tidak butuh server — penerima cukup membuka tautan pada
// alamat aplikasi yang sama. Aman untuk offline setelah aplikasi termuat.

/** Encode objek → base64url (UTF-8 aman) untuk ditaruh di fragmen URL. */
export function encodePayload(obj: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(obj))
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Decode base64url → objek. Melempar bila tak valid. */
export function decodePayload<T = unknown>(s: string): T {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return JSON.parse(new TextDecoder().decode(bytes)) as T
}

/** Normalkan nomor telepon Indonesia untuk wa.me (08xx → 628xx). */
export function normalizePhone(phone?: string): string {
  if (!phone) return ''
  let p = phone.replace(/[^\d+]/g, '')
  if (p.startsWith('+')) p = p.slice(1)
  if (p.startsWith('0')) p = '62' + p.slice(1)
  return p
}

/** Tautan WhatsApp (wa.me). Tanpa nomor → pemilih kontak WhatsApp. */
export function waLink(phone: string | undefined, text: string): string {
  const p = normalizePhone(phone)
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`
}

/** Tautan mailto dengan subjek & isi. */
export function mailtoLink(subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

/** Bangun URL berbagi self-contained untuk jenis 'receipt' | 'member'. */
export function buildShareUrl(kind: 'receipt' | 'member', payload: unknown): string {
  const base = location.origin + location.pathname
  return `${base}#/share/${kind}/${encodePayload(payload)}`
}

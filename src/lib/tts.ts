/** Kalimat panggilan antrean bawaan. `{no}` = nomor antrean (dieja per karakter). */
export const DEFAULT_QUEUE_CALL_TEXT = 'Nomor antrian {no}, silakan diambil.'

/**
 * Panggilan suara antrean via Web Speech API (Text-to-Speech lokal browser).
 * `template` boleh diatur di Pengaturan; placeholder `{no}` diganti nomor antrean
 * yang dieja per karakter (mis. "A-01" → "A 0 1"). Bila template tanpa `{no}`,
 * nomor tetap disebut di akhir.
 */
export function callQueueNumber(queueNumber: string, template?: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  const spoken = queueNumber.split('').join(' ')
  const tpl = template && template.trim() ? template.trim() : DEFAULT_QUEUE_CALL_TEXT
  const replaced = tpl.replace(/\{no(mor)?\}/gi, spoken)
  const text = replaced === tpl ? `${tpl} ${spoken}` : replaced
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = 'id-ID'
  utter.rate = 0.95
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utter)
}

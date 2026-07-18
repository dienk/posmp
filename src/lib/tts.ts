/** Panggilan suara antrean via Web Speech API (Text-to-Speech lokal browser). */
export function callQueueNumber(queueNumber: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  // Eja per karakter agar "A-01" terbaca jelas: "Nomor antrian A 0 1".
  const spoken = queueNumber.split('').join(' ')
  const utter = new SpeechSynthesisUtterance(`Nomor antrian ${spoken}, silakan diambil.`)
  utter.lang = 'id-ID'
  utter.rate = 0.95
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utter)
}

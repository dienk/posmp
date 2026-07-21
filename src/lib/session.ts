// Sesi login (per tab). Menyimpan id persona yang login di sessionStorage —
// tetap saat reload, tapi minta login lagi bila tab ditutup/dibuka baru.
const KEY = 'posmp_logged_in'

export function isLoggedIn(): boolean {
  try {
    return !!sessionStorage.getItem(KEY)
  } catch {
    return false
  }
}

export function loggedInPersonaId(): string | null {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function login(personaId: string): void {
  try {
    sessionStorage.setItem(KEY, personaId)
  } catch {
    /* abaikan */
  }
}

export function logout(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* abaikan */
  }
}

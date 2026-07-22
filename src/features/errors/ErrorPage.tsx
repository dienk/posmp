import { isRouteErrorResponse, useRouteError } from 'react-router-dom'

/**
 * Halaman error/404 dengan branding aplikasi. Dipakai sebagai `errorElement`
 * router (menangkap error render/loader) sekaligus rute catch-all `*` (404).
 * Konsisten dengan tema (token warna) & logo POSMerahPutih.
 */
export default function ErrorPage({ notFound = false }: { notFound?: boolean }) {
  const error = useRouteError()

  let code = notFound ? '404' : 'Ups'
  let title = notFound ? 'Halaman tidak ditemukan' : 'Terjadi kesalahan'
  let message = notFound
    ? 'Alamat yang Anda tuju tidak tersedia atau sudah dipindahkan.'
    : 'Aplikasi mengalami kendala saat menampilkan halaman ini.'

  if (!notFound && error) {
    if (isRouteErrorResponse(error)) {
      code = String(error.status)
      title = error.status === 404 ? 'Halaman tidak ditemukan' : error.statusText || title
      message = error.data?.message ?? message
    } else if (error instanceof Error) {
      message = error.message
    }
  }

  return (
    <div className="flex h-full min-h-screen flex-col items-center justify-center gap-5 bg-background p-6 text-center">
      <img
        src="/logo-mark.png"
        alt="POS Merah Putih"
        className="h-20 w-20 rounded-2xl object-contain shadow-card"
      />
      <div className="flex items-baseline gap-3">
        <span className="text-5xl font-extrabold text-brand-strong">{code}</span>
        <span className="text-xl font-bold text-ink">{title}</span>
      </div>
      <p className="max-w-md text-sm text-ink-soft">{message}</p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <a
          href="#/"
          className="rounded-xl bg-brand-strong px-5 py-2.5 text-sm font-bold text-white shadow transition hover:brightness-95"
        >
          ← Kembali ke Kasir
        </a>
        <button
          onClick={() => window.location.reload()}
          className="rounded-xl border border-line/10 bg-panel px-5 py-2.5 text-sm font-semibold text-ink hover:bg-brand-soft"
        >
          Muat Ulang
        </button>
      </div>
      <p className="mt-4 text-xs text-ink-soft">POSMerahPutih · Kasir UMKM Indonesia</p>
    </div>
  )
}

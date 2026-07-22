import { formatRupiah } from '../../lib/format'
import type { Product } from '../../types'

export type ItemMode = 'grid' | 'list'

interface Props {
  product: Product
  onSelect: (product: Product) => void
  mode?: ItemMode
}

/** Inisial produk sebagai placeholder gambar (belum ada foto katalog). */
function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export default function ProductCard({ product, onSelect, mode = 'grid' }: Props) {
  const soldOut = (product.stock ?? 0) <= 0

  // Mode daftar: baris ringkas (gambar kecil + nama + harga) untuk katalog padat.
  if (mode === 'list') {
    return (
      <button
        type="button"
        disabled={soldOut}
        onClick={() => onSelect(product)}
        className="flex w-full items-center gap-3 rounded-xl bg-panel px-3 py-2 text-left shadow-card
                   transition hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface/60">
          {product.image_path ? (
            <img src={product.image_path} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm font-bold text-white/90">{initials(product.name)}</span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{product.name}</span>
          <span className="block text-xs text-ink-soft">
            {soldOut ? 'Stok habis' : `Stok: ${product.stock}`}
          </span>
        </span>
        <span className="shrink-0 text-sm font-bold text-brand-strong">
          {formatRupiah(product.price)}
        </span>
      </button>
    )
  }

  return (
    <button
      type="button"
      disabled={soldOut}
      onClick={() => onSelect(product)}
      className="group flex flex-col overflow-hidden rounded-card bg-panel text-left shadow-card
                 transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed
                 disabled:opacity-50 disabled:hover:translate-y-0"
    >
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-surface/60">
        {product.image_path ? (
          <img
            src={product.image_path}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-3xl font-bold text-white/90">{initials(product.name)}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-sm font-semibold text-ink">{product.name}</p>
        <p className="mt-auto text-base font-bold text-brand-strong">
          {formatRupiah(product.price)}
        </p>
        <p className="text-xs text-ink-soft">
          {soldOut ? 'Stok habis' : `Stok: ${product.stock}`}
        </p>
      </div>
    </button>
  )
}

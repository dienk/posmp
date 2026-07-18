import { formatRupiah } from '../../lib/format'
import type { Product } from '../../types'

interface Props {
  product: Product
  onSelect: (product: Product) => void
}

/** Inisial produk sebagai placeholder gambar (belum ada foto katalog). */
function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export default function ProductCard({ product, onSelect }: Props) {
  const soldOut = (product.stock ?? 0) <= 0
  return (
    <button
      type="button"
      disabled={soldOut}
      onClick={() => onSelect(product)}
      className="group flex flex-col overflow-hidden rounded-card bg-white text-left shadow-card
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
        <p className="mt-auto text-base font-bold text-status-occupied">
          {formatRupiah(product.price)}
        </p>
        <p className="text-xs text-ink-soft">
          {soldOut ? 'Stok habis' : `Stok: ${product.stock}`}
        </p>
      </div>
    </button>
  )
}

import { useCallback, useMemo, useState } from 'react'
import type { CartItem, Product } from '../../types'
import type { UnitOption } from '../products/productsRepository'

/** Harga efektif per 1 satuan terpilih (fallback ke harga dasar produk). */
export const itemUnitPrice = (it: CartItem): number => it.unitPrice ?? it.product.price

/** Total 1 baris = (harga satuan × qty) − diskon item, minimal 0. */
export const lineTotal = (it: CartItem): number =>
  Math.max(0, itemUnitPrice(it) * it.quantity - (it.discount ?? 0))

/** State keranjang dengan penggabungan item otomatis (In-Cart Item Merging). */
export function useCart() {
  const [items, setItems] = useState<CartItem[]>([])

  const addProduct = useCallback((product: Product) => {
    setItems((prev) => {
      const existing = prev.find((it) => it.product.id === product.id)
      if (existing) {
        return prev.map((it) =>
          it.product.id === product.id ? { ...it, quantity: it.quantity + 1 } : it,
        )
      }
      return [...prev, { product, quantity: 1 }]
    })
  }, [])

  const setQuantity = useCallback((productId: number, quantity: number) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((it) => it.product.id !== productId)
        : prev.map((it) => (it.product.id === productId ? { ...it, quantity } : it)),
    )
  }, [])

  /** Ganti satuan sebuah item (mis. dari 'botol' ke 'dus'); harga ikut satuan. */
  const setUnit = useCallback((productId: number, opt: UnitOption) => {
    setItems((prev) =>
      prev.map((it) =>
        it.product.id === productId
          ? {
              ...it,
              unit: opt.isBase ? undefined : opt.unit,
              unitFactor: opt.isBase ? undefined : opt.factor,
              unitPrice: opt.isBase ? undefined : opt.price,
            }
          : it,
      ),
    )
  }, [])

  const setNotes = useCallback((productId: number, notes: string) => {
    setItems((prev) =>
      prev.map((it) =>
        it.product.id === productId ? { ...it, notes: notes || undefined } : it,
      ),
    )
  }, [])

  /** Diskon item (Rp) untuk 1 baris; 0/negatif = tanpa diskon. */
  const setItemDiscount = useCallback((productId: number, discount: number) => {
    setItems((prev) =>
      prev.map((it) =>
        it.product.id === productId
          ? { ...it, discount: discount > 0 ? discount : undefined }
          : it,
      ),
    )
  }, [])

  const removeProduct = useCallback((productId: number) => {
    setItems((prev) => prev.filter((it) => it.product.id !== productId))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  /** Ganti seluruh isi keranjang (mis. saat membuka draft tersimpan). */
  const replace = useCallback((next: CartItem[]) => setItems(next), [])

  // Subtotal = jumlah total baris (sudah dikurangi diskon per item).
  const subtotal = useMemo(() => items.reduce((sum, it) => sum + lineTotal(it), 0), [items])

  return {
    items,
    addProduct,
    setQuantity,
    setUnit,
    setNotes,
    setItemDiscount,
    removeProduct,
    clear,
    replace,
    subtotal,
  }
}

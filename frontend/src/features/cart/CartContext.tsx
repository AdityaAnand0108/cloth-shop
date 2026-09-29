import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react'

/**
 * One line of the bill being built at the counter.
 *
 * Only the identity, the count and the agreed price are kept. Names, stock and the
 * shelf price are deliberately NOT stored: this survives a refresh and a closed
 * browser, and a stale price shown to a customer is worse than a slow one. The cart
 * screen re-asks the server for all of that.
 */
export type CartLine = {
  variantId: number
  qty: number
  /**
   * What the counter agreed, once someone has typed it. Null means "whatever it sells
   * for" — so an untouched line follows a price change instead of freezing yesterday's.
   */
  price: number | null
}

const STORAGE_KEY = 'bflex.cart.v1'

/**
 * A customer at the counter is one interrupted moment. An accidental refresh, a laptop
 * lid, a browser crash — none of them should mean asking someone to hand over their
 * armful of clothes again, so the cart is written to the browser on every change.
 */
function load(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((l): l is CartLine =>
      typeof l === 'object' && l !== null
      && typeof (l as CartLine).variantId === 'number'
      && typeof (l as CartLine).qty === 'number')
  } catch {
    // A private window, a full disk, hand-edited junk — an empty cart beats a crash.
    return []
  }
}

type CartApi = {
  lines: CartLine[]
  /** Pieces, not lines: three of one shirt reads as three on the badge. */
  count: number
  add: (variantId: number, qty?: number) => void
  setQty: (variantId: number, qty: number) => void
  /** Null puts the line back on the shelf price. */
  setPrice: (variantId: number, price: number | null) => void
  remove: (variantId: number) => void
  clear: () => void
  qtyOf: (variantId: number) => number
  /**
   * One key per cart. Reused across retries so a double-tapped "Complete sale" returns
   * the bill already written; rotated only once a cart has actually been billed.
   */
  idempotencyKey: string
}

const CartContext = createContext<CartApi | null>(null)

const newKey = () =>
  crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(load)
  const [idempotencyKey, setIdempotencyKey] = useState(newKey)
  const first = useRef(true)

  useEffect(() => {
    // Skip the mount write, so an unreadable localStorage is not immediately
    // overwritten with an empty cart the user never asked for.
    if (first.current) { first.current = false; return }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
    } catch { /* out of quota or blocked — the cart still works for this session */ }
  }, [lines])

  const add = useCallback((variantId: number, qty = 1) => {
    setLines(current => {
      const found = current.find(l => l.variantId === variantId)
      // The same article scanned twice is one line of two, not two lines of one.
      return found
        ? current.map(l => l.variantId === variantId ? { ...l, qty: l.qty + qty } : l)
        : [...current, { variantId, qty, price: null }]
    })
  }, [])

  const setQty = useCallback((variantId: number, qty: number) => {
    setLines(current => qty <= 0
      ? current.filter(l => l.variantId !== variantId)
      : current.map(l => l.variantId === variantId ? { ...l, qty } : l))
  }, [])

  const setPrice = useCallback((variantId: number, price: number | null) => {
    setLines(current =>
      current.map(l => l.variantId === variantId ? { ...l, price } : l))
  }, [])

  const remove = useCallback((variantId: number) => {
    setLines(current => current.filter(l => l.variantId !== variantId))
  }, [])

  const clear = useCallback(() => {
    setLines([])
    setIdempotencyKey(newKey())
  }, [])

  const value = useMemo<CartApi>(() => ({
    lines,
    count: lines.reduce((sum, l) => sum + l.qty, 0),
    add,
    setQty,
    setPrice,
    remove,
    clear,
    qtyOf: (variantId: number) => lines.find(l => l.variantId === variantId)?.qty ?? 0,
    idempotencyKey,
  }), [lines, add, setQty, setPrice, remove, clear, idempotencyKey])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartApi {
  const cart = useContext(CartContext)
  if (!cart) throw new Error('useCart must be used inside <CartProvider>')
  return cart
}

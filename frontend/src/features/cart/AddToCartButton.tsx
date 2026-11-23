import { useEffect, useRef, useState } from 'react'
import { useCart } from './CartContext'

/**
 * The one control that turns browsing into selling.
 *
 * It sits next to "View" in the list and on the article itself, and it says what is
 * already in the cart rather than resetting to a blank "Add" each time — at a counter
 * you add the same shirt three times in a row and need to see the count climb.
 *
 * Out of stock, it refuses. Promising a garment the shop does not have is the one
 * mistake this screen exists to prevent.
 */
export function AddToCartButton({ variantId, qtyOnHand, size = 'small', iconOnly = false }: {
  variantId: number
  qtyOnHand: number
  size?: 'small' | 'full'
  iconOnly?: boolean
}) {
  const cart = useCart()
  const inCart = cart.qtyOf(variantId)
  const soldOut = qtyOnHand <= 0
  const atLimit = inCart >= qtyOnHand

  // A moment of feedback, because the cart bar is at the bottom of the screen and the
  // tap happened at the top of it.
  const [justAdded, setJustAdded] = useState(false)
  const timer = useRef<number>()
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const onClick = () => {
    cart.add(variantId)
    setJustAdded(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setJustAdded(false), 1200)
  }

  const label = soldOut ? 'Out of stock'
    : atLimit ? `All ${inCart} in cart`
      : justAdded ? 'Added ✓'
        : inCart > 0 ? `In cart ×${inCart}` : 'Add to cart'

  return (
    <button
      type="button"
      className={[
        size === 'full' ? 'primary' : 'small-btn',
        iconOnly ? 'icon-action' : '',
        'add-to-cart',
        inCart > 0 ? 'has-some' : '',
        justAdded ? 'flash' : '',
      ].filter(Boolean).join(' ')}
      disabled={soldOut || atLimit}
      onClick={onClick}
      title={soldOut ? 'Out of stock'
        : atLimit ? `Only ${qtyOnHand} on the shelf, and they are all in the cart`
          : justAdded ? 'Added to cart'
            : inCart > 0 ? `In cart: ${inCart}. Add another`
              : 'Add to cart'}
      aria-label={soldOut ? 'Out of stock'
        : atLimit ? 'All available stock is in the cart'
          : 'Add to cart'}
    >
      {iconOnly
        ? <CartIcon unavailable={soldOut} />
        : label}
    </button>
  )
}

function CartIcon({ unavailable }: { unavailable: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 4h2l2.2 10.1a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H6" />
      <circle cx="10" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
      {unavailable && <path d="m9 9 7 6m0-6-7 6" />}
      {!unavailable && <path d="M13 5v6m-3-3h6" />}
    </svg>
  )
}

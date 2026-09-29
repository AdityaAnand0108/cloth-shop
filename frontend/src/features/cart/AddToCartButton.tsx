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
export function AddToCartButton({ variantId, qtyOnHand, size = 'small' }: {
  variantId: number
  qtyOnHand: number
  size?: 'small' | 'full'
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
        'add-to-cart',
        inCart > 0 ? 'has-some' : '',
        justAdded ? 'flash' : '',
      ].filter(Boolean).join(' ')}
      disabled={soldOut || atLimit}
      onClick={onClick}
      title={atLimit && !soldOut
        ? `Only ${qtyOnHand} on the shelf, and they are all in the cart`
        : undefined}
    >
      {label}
    </button>
  )
}

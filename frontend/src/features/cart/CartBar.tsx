import { useCart } from './CartContext'

/**
 * A running reminder that someone is standing at the counter waiting.
 *
 * It shows the count and nothing else on purpose: the money is worked out on the cart
 * screen, from prices re-read from the server, and a total quoted here from a cart
 * that has been sitting in localStorage since this morning could be wrong.
 */
export function CartBar({ onOpenCart }: { onOpenCart: () => void }) {
  const cart = useCart()
  if (cart.count === 0) return null

  return (
    <div className="cart-bar" role="status">
      <div className="cart-bar-inner">
        <span className="cart-bar-count">{cart.count}</span>
        <span className="cart-bar-text">
          {cart.count === 1 ? 'item in the cart' : 'items in the cart'}
        </span>
        <button type="button" className="primary" onClick={onOpenCart}>
          Review &amp; bill
        </button>
      </div>
    </div>
  )
}

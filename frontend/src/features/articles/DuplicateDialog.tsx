import { useState } from 'react'
import type { ExistingArticle } from '../../api/types'

const rupees = (n: number) =>
  `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const marginPct = (cost: number, sell: number) =>
  sell > 0 ? ((sell - cost) / sell) * 100 : 0

/**
 * Shown when the generated code already exists.
 *
 * The cost of the new lot is stated, not asked about — you paid what you paid, and it
 * gets averaged into the cost basis either way. The only genuine decision is whether
 * the shelf price moves, so that is the only control here.
 */
export function DuplicateDialog({
  existing,
  incomingBuyingPrice,
  quantity,
  markup,
  busy,
  onCancel,
  onConfirm,
}: {
  existing: ExistingArticle
  incomingBuyingPrice: number
  quantity: number
  markup: number
  busy: boolean
  onCancel: () => void
  /** The new shelf price, or null to keep the existing one. */
  onConfirm: (sellingPrice: number | null) => void
}) {
  const heldQty = Number(existing.qtyOnHand)
  const newQty = heldQty + quantity

  // Mirrors Costing.weightedAverage on the server: sold-out stock resets rather than blends.
  const newAvgCost = heldQty > 0
    ? (heldQty * existing.avgCost + quantity * incomingBuyingPrice) / newQty
    : incomingBuyingPrice

  const costChanged = Math.abs(incomingBuyingPrice - existing.avgCost) >= 0.005
  const suggestedPrice = Math.ceil(newAvgCost * markup)

  const [newSellingPrice, setNewSellingPrice] = useState<number | null>(null)

  const keepMargin = marginPct(newAvgCost, existing.sellingPrice)
  const raiseMargin = marginPct(newAvgCost, newSellingPrice ?? suggestedPrice)

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="dup-title">
      <div className="modal">
        <h2 id="dup-title">This article already exists</h2>

        <dl className="dup-facts">
          <dt>Code</dt><dd><code>{existing.articleCode}</code></dd>
          <dt>Article</dt><dd>{existing.displayName}</dd>
          <dt>Colour / size</dt><dd>{existing.colourName} · {existing.sizeName}</dd>
        </dl>

        {/* The arithmetic, shown rather than hidden. */}
        <table className="costing">
          <tbody>
            <tr>
              <th>In stock</th>
              <td className="num">{heldQty}</td>
              <td className="num">{rupees(existing.avgCost)}</td>
            </tr>
            <tr>
              <th>Adding</th>
              <td className="num">{quantity}</td>
              <td className="num">{rupees(incomingBuyingPrice)}</td>
            </tr>
            <tr className="total">
              <th>New stock</th>
              <td className="num">{newQty}</td>
              <td className="num">{rupees(newAvgCost)}</td>
            </tr>
          </tbody>
        </table>
        <p className="muted small costing-note">
          {costChanged
            ? 'Average cost, because neither rate alone is true of all the pieces on the shelf.'
            : 'Same rate as before, so the cost basis does not move.'}
        </p>

        <fieldset className="price-choice">
          <legend>Selling price</legend>

          <label className="radio">
            <input
              type="radio"
              name="selling"
              checked={newSellingPrice === null}
              onChange={() => setNewSellingPrice(null)}
            />
            <span>
              Keep {rupees(existing.sellingPrice)}
              <em className={keepMargin < 40 ? 'warn' : ''}>margin {keepMargin.toFixed(1)}%</em>
            </span>
          </label>

          <label className="radio">
            <input
              type="radio"
              name="selling"
              checked={newSellingPrice !== null}
              onChange={() => setNewSellingPrice(suggestedPrice)}
            />
            <span>
              Change to{' '}
              <input
                type="number" min="0" step="1" className="inline-price"
                value={newSellingPrice ?? suggestedPrice}
                onFocus={() => setNewSellingPrice(v => v ?? suggestedPrice)}
                onChange={e => setNewSellingPrice(Number(e.target.value))}
              />
              <em>margin {raiseMargin.toFixed(1)}%</em>
            </span>
          </label>
        </fieldset>

        <div className="actions">
          <button
            className="primary"
            onClick={() => onConfirm(newSellingPrice)}
            disabled={busy}
          >
            {busy ? 'Saving…' : `Add ${quantity} to stock`}
          </button>
          <button className="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import type { ExistingArticle } from '../../api/types'

const rupees = (n: number) =>
  `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * Shown when the generated code already exists. The point is to never create a
 * duplicate silently, and to catch a changed buying price at the moment it happens
 * rather than three months later when the margin report looks wrong.
 */
export function DuplicateDialog({
  existing,
  incomingBuyingPrice,
  incomingSellingPrice,
  quantity,
  busy,
  onCancel,
  onConfirm,
}: {
  existing: ExistingArticle
  incomingBuyingPrice: number
  incomingSellingPrice: number
  quantity: number
  busy: boolean
  onCancel: () => void
  onConfirm: (updatePrices: boolean) => void
}) {
  const priceChanged = incomingBuyingPrice !== existing.buyingPrice
  const [updatePrices, setUpdatePrices] = useState(false)

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="dup-title">
      <div className="modal">
        <h2 id="dup-title">This article already exists</h2>

        <dl className="dup-facts">
          <dt>Code</dt><dd><code>{existing.articleCode}</code></dd>
          <dt>Article</dt><dd>{existing.displayName}</dd>
          <dt>Colour / size</dt><dd>{existing.colourName} · {existing.sizeName}</dd>
          <dt>In stock now</dt><dd className="num">{existing.qtyOnHand}</dd>
        </dl>

        <p className="modal-lead">
          Add <strong>{quantity}</strong> more, taking stock to{' '}
          <strong>{Number(existing.qtyOnHand) + quantity}</strong>?
        </p>

        {priceChanged && (
          <div className="price-change">
            <p>
              You paid {rupees(existing.buyingPrice)} before, now {rupees(incomingBuyingPrice)}.
            </p>
            <label className="check">
              <input
                type="checkbox"
                checked={updatePrices}
                onChange={e => setUpdatePrices(e.target.checked)}
              />
              <span>
                Update this article to {rupees(incomingBuyingPrice)} buying
                / {rupees(incomingSellingPrice)} selling
              </span>
            </label>
            <p className="muted small">
              Leave unticked to keep the old prices and just add the stock.
            </p>
          </div>
        )}

        <div className="actions">
          <button className="primary" onClick={() => onConfirm(updatePrices)} disabled={busy}>
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

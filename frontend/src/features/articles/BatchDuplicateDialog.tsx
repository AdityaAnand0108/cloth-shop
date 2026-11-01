import { useState } from 'react'
import type { ExistingArticle } from '../../api/types'

export type DuplicateSize = {
  existing: ExistingArticle
  quantity: number
}

const rupees = (n: number) =>
  `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function BatchDuplicateDialog({
  sizes,
  sellingPrice,
  busy,
  onCancel,
  onConfirm,
}: {
  sizes: DuplicateSize[]
  sellingPrice: number
  busy: boolean
  onCancel: () => void
  onConfirm: (updateSellingPrice: boolean) => void
}) {
  const [updateSellingPrice, setUpdateSellingPrice] = useState(false)

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="batch-dup-title">
      <div className="modal batch-duplicate-modal">
        <h2 id="batch-dup-title">Some sizes are already in inventory</h2>
        <p className="muted">
          Their new quantities will be added to the current stock. New sizes will be created.
          All selected sizes are saved together.
        </p>

        <div className="table-scroll">
          <table className="batch-size-table">
            <thead>
              <tr><th>Size</th><th>In stock</th><th>Adding</th><th>Current price</th></tr>
            </thead>
            <tbody>
              {sizes.map(({ existing, quantity }) => (
                <tr key={existing.variantId}>
                  <td>{existing.sizeName}</td>
                  <td>{existing.qtyOnHand}</td>
                  <td>{quantity}</td>
                  <td>{rupees(existing.sellingPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <label className="batch-price-choice">
          <input
            type="checkbox"
            checked={updateSellingPrice}
            onChange={e => setUpdateSellingPrice(e.target.checked)}
          />
          <span>Set existing sizes to {rupees(sellingPrice)} selling price</span>
        </label>

        <div className="actions">
          <button
            className="primary"
            onClick={() => onConfirm(updateSellingPrice)}
            disabled={busy}
          >
            {busy ? 'Saving…' : 'Add all selected sizes'}
          </button>
          <button className="ghost" onClick={onCancel} disabled={busy}>Back to form</button>
        </div>
      </div>
    </div>
  )
}

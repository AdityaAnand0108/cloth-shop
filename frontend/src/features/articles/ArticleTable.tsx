import type { ArticleListItem } from '../../api/types'
import { AddToCartButton } from '../cart/AddToCartButton'
import { amount as rupees } from '../../money'

export function ArticleTable({ items, onSelect, onEdit }: {
  items: ArticleListItem[]
  onSelect: (variantId: number) => void
  onEdit: (variantId: number) => void
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Article</th>
            <th>Colour</th>
            <th>Size</th>
            <th className="r">Avg cost</th>
            <th className="r">Selling</th>
            <th className="r">Stock</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map(a => (
            <tr key={a.variantId}>
              <td>
                <button type="button" className="code-link" onClick={() => onSelect(a.variantId)}>
                  {a.articleCode}
                </button>
              </td>
              <td>{a.brand} {a.material} {a.articleType}</td>
              <td>
                <span className="swatch sm" style={{ background: a.colourHex ?? 'transparent' }} />
                {a.colour}
              </td>
              <td>{a.size}</td>
              <td className="r num">{rupees(a.avgCost)}</td>
              <td className="r num">{rupees(a.sellingPrice)}</td>
              <td className={`r num ${Number(a.qtyOnHand) <= 0 ? 'out' : ''}`}>{a.qtyOnHand}</td>
              <td className="r">
                <div className="row-actions">
                  <button type="button" className="ghost icon-action" onClick={() => onSelect(a.variantId)} title="View article" aria-label={`View article ${a.articleCode}`}>
                    <ViewIcon />
                  </button>
                  <AddToCartButton variantId={a.variantId} qtyOnHand={Number(a.qtyOnHand)} iconOnly />
                  <button type="button" className="ghost icon-action" onClick={() => onEdit(a.variantId)} title="Edit article" aria-label={`Edit article ${a.articleCode}`}>
                    <EditIcon />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ViewIcon() {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.7" /></svg>
}

function EditIcon() {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></svg>
}

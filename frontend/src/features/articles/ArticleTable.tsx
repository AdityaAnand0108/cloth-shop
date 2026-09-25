import type { ArticleListItem } from '../../api/types'

const rupees = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function ArticleTable({ items, onSelect }: {
  items: ArticleListItem[]
  onSelect: (variantId: number) => void
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
                <button type="button" className="ghost small-btn" onClick={() => onSelect(a.variantId)}>
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

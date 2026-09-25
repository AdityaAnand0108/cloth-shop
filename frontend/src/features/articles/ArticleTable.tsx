import type { ArticleListItem } from '../../api/types'

const rupees = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function ArticleTable({ items }: { items: ArticleListItem[] }) {
  if (items.length === 0) {
    return (
      <section className="card">
        <h2 className="section-title">Inventory</h2>
        <p className="muted">
          Nothing added yet. The first article you add will appear here.
        </p>
      </section>
    )
  }

  return (
    <section className="card">
      <h2 className="section-title">Inventory <span className="count">{items.length}</span></h2>
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
            </tr>
          </thead>
          <tbody>
            {items.map(a => (
              <tr key={a.variantId}>
                <td><code>{a.articleCode}</code></td>
                <td>{a.brand} {a.material} {a.articleType}</td>
                <td>
                  <span className="swatch sm" style={{ background: a.colourHex ?? 'transparent' }} />
                  {a.colour}
                </td>
                <td>{a.size}</td>
                <td className="r num">{rupees(a.avgCost)}</td>
                <td className="r num">{rupees(a.sellingPrice)}</td>
                <td className={`r num ${Number(a.qtyOnHand) <= 0 ? 'out' : ''}`}>{a.qtyOnHand}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

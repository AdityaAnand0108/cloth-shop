import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import type { ArticleListItem, DaySummary } from '../../api/types'
import { useCart } from '../cart/CartContext'
import { qty, rupees, time } from '../../money'

type Props = {
  onAdd: () => void
  onViewArticles: () => void
  onOpenCart: () => void
  onOpenBill: (billId: number) => void
  onImportInventory: () => void
  onImportSales: () => void
}

/**
 * The screen the shop looks at between customers.
 *
 * It answers the two questions actually asked at a counter — where do I start, and how
 * is today going — and nothing else. Selling comes first because that is what happens
 * most; the day's numbers sit under it because they are worth a glance, not a study.
 */
export function DashboardPage({ onAdd, onViewArticles, onOpenCart, onOpenBill, onImportInventory, onImportSales }: Props) {
  const cart = useCart()
  const [day, setDay] = useState<DaySummary | null>(null)
  const [articles, setArticles] = useState<ArticleListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10))

  useEffect(() => {
    Promise.all([api.day(reportDate), api.listArticles()])
      .then(([sales, stock]) => { setDay(sales); setArticles(stock.content) })
      .catch((e: Error) => setError(e.message))
  }, [reportDate])

  const stockUnits = articles?.reduce((sum, article) => sum + article.qtyOnHand, 0) ?? 0
  const stockCost = articles?.reduce((sum, article) => sum + article.qtyOnHand * article.avgCost, 0) ?? 0
  const outOfStock = articles?.filter(article => article.qtyOnHand <= 0).length ?? 0

  return (
    <div className="page">
      <header className="page-head">
        <h1>BFlex</h1>
        <div className="dashboard-date"><p className="muted">Store performance and stock health</p><label className="field"><span>Report date</span><input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} /></label></div>
      </header>

      <div className="card">
        <div className="actions">
          <button type="button" className="primary big" onClick={onViewArticles}>
            Sell &mdash; find an article
          </button>
          {cart.count > 0 && (
            <button type="button" onClick={onOpenCart}>
              Cart ({cart.count})
            </button>
          )}
          <button type="button" onClick={onAdd}>+ Add inventory</button>
          <button type="button" onClick={onImportInventory}>Import inventory</button>
          <button type="button" onClick={onImportSales}>Import sales</button>
          <button type="button" className="ghost" onClick={onViewArticles}>
            All articles
          </button>
        </div>
      </div>

      {error && <div className="banner err">Could not load the selected report: {error}</div>}

      <section className="card dashboard-section">
        <div className="list-head">
          <h2 className="section-title">Store overview</h2>
          {day && day.billCount > 0 && (
            <span className="muted small">
              {day.billCount} {day.billCount === 1 ? 'bill' : 'bills'}
            </span>
          )}
        </div>

        {error
          ? <p className="muted">Refresh the page and sign in again if prompted.</p>
          : !day || !articles
          ? <p className="muted">Loading&hellip;</p>
          : (
              <>
                <h3 className="section-title">Sales performance</h3>
                <div className="stats dashboard-stats">
                  <Stat label="Sales selected day" value={rupees(day.takings)} strong />
                  <Stat label="Profit selected day" value={rupees(day.profit)}
                    tone={day.profit >= 0 ? 'ok' : 'bad'}
                    hint={day.takings > 0 ? `${((day.profit / day.takings) * 100).toFixed(1)}% margin` : 'No sales yet'} />
                  <Stat label="Bills selected day" value={qty(day.billCount)} />
                  <Stat label="Pieces sold" value={qty(day.itemCount)} />
                  <Stat label="Average bill" value={rupees(day.billCount ? day.takings / day.billCount : 0)} />
                </div>

                <h3 className="section-title">Inventory health</h3>
                <div className="stats dashboard-stats">
                  <Stat label="Articles stocked" value={qty(articles.length)} />
                  <Stat label="Units on hand" value={qty(stockUnits)} />
                  <Stat label="Stock at cost" value={rupees(stockCost)} hint="Estimated from current average cost" />
                  <Stat label="Out of stock" value={qty(outOfStock)} tone={outOfStock ? 'bad' : 'ok'} />
                </div>

                {day.billCount === 0 && <p className="muted">No sales recorded today yet.</p>}

                {day.bills.length > 0 && (
                <div className="table-scroll">
                  <h3 className="section-title">Recent bills for selected day</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>Bill</th>
                        <th>Time</th>
                        <th>Customer</th>
                        <th>By</th>
                        <th className="r">Pcs</th>
                        <th className="r">Total</th>
                        <th className="r">Profit</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {day.bills.map(b => (
                        <tr key={b.id}>
                          <td>
                            <button type="button" className="code-link"
                              onClick={() => onOpenBill(b.id)}>
                              {b.billNo}
                            </button>
                          </td>
                          <td>{time(b.createdAt)}</td>
                          <td>{b.customerName ?? <span className="muted">Walk-in</span>}</td>
                          <td className="muted">{b.staffName ?? '—'}</td>
                          <td className="r num">{qty(b.itemCount)}</td>
                          <td className="r num">{rupees(b.total)}</td>
                          <td className={`r num ${b.profit < 0 ? 'out' : ''}`}>
                            {rupees(b.profit)}
                          </td>
                          <td className="r">
                            <button type="button" className="ghost small-btn"
                              onClick={() => onOpenBill(b.id)}>
                              Open
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                )}
              </>
            )}
      </section>
    </div>
  )
}

function Stat({ label, value, hint, strong, tone }: {
  label: string
  value: string
  hint?: string
  strong?: boolean
  tone?: 'ok' | 'bad'
}) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className={`stat-value ${strong ? 'strong' : ''} ${tone ?? ''}`}>{value}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  )
}

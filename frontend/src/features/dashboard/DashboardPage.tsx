import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { api } from '../../api/client'
import type { DashboardReport, DaySummary } from '../../api/types'
import { useCart } from '../cart/CartContext'
import { qty, rupees, time } from '../../money'

type Props = {
  onAdd: () => void
  onViewArticles: () => void
  onOpenCart: () => void
  onOpenBill: (billId: number) => void
  onImportInventory: () => void
  onImportSales: () => void
  onReceiveStock: () => void
  onCustomers: () => void
  onOpenArticle: (variantId: number) => void
}

function shopToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function daysBefore(date: string, days: number) {
  const parsed = new Date(`${date}T12:00:00+05:30`)
  parsed.setDate(parsed.getDate() - days)
  return parsed.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

export function DashboardPage({ onAdd, onViewArticles, onOpenCart, onOpenBill,
  onImportInventory, onImportSales, onReceiveStock, onCustomers, onOpenArticle }: Props) {
  const cart = useCart()
  const [report, setReport] = useState<DashboardReport | null>(null)
  const [day, setDay] = useState<DaySummary | null>(null)
  const [today] = useState(shopToday)
  const [from, setFrom] = useState(shopToday)
  const [to, setTo] = useState(shopToday)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([api.dashboardReport(from, to), api.day(to)])
      .then(([analytics, bills]) => {
        if (cancelled) return
        setReport(analytics); setDay(bills); setError(null)
      })
      .catch((e: Error) => {
        if (!cancelled) {
          const message = e.message.includes('PreparedStatementCallback') || e.message.includes('bad SQL grammar')
            ? 'The dashboard could not read its report data. Refresh the page; if this continues, contact support.'
            : e.message
          setError(message)
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [from, to])

  const range = (days: number) => { setFrom(daysBefore(today, days - 1)); setTo(today) }
  const maxPayment = Math.max(1, ...(report?.paymentBreakdown.map(x => x.total) ?? [1]))
  const topQuantity = Math.max(1, ...(report?.topSellers.map(x => x.quantity) ?? [1]))

  async function exportWorkbook() {
    if (!report) return
    setExporting(true); setError(null)
    try {
      const inventory = []
      let page = 0
      let total = 0
      do {
        const result = await api.listArticles({}, undefined, page++, 200)
        inventory.push(...result.content.map(item => ({
          'Article code': item.articleCode, Type: item.articleType, Brand: item.brand,
          Material: item.material, Colour: item.colour, Size: item.size,
          'Quantity on hand': item.qtyOnHand, 'Average cost': item.avgCost,
          'Last buying price': item.lastBuyingPrice, 'Selling price': item.sellingPrice,
        })))
        total = result.totalElements
      } while (inventory.length < total)

      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
        ['Store report', 'BFlex'], ['From', report.from], ['To', report.to],
        ['Bills', report.sales.billCount], ['Returns', report.sales.returnCount],
        ['Net sales', report.sales.takings], ['Profit', report.sales.profit],
        ['Pieces sold', report.sales.itemCount], ['Discounts', report.sales.discountGiven],
        ['Inventory variants', report.inventory.variantCount], ['Units on hand', report.inventory.unitsOnHand],
        ['Stock at cost', report.inventory.stockAtCost], ['Low stock', report.inventory.lowStockCount],
      ]), 'Overview')
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(inventory), 'Inventory')
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.lowStock), 'Low stock')
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.topSellers), 'Top sellers')
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.slowMovers), 'Slow movers')
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.paymentBreakdown), 'Payments')
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(day?.bills ?? []), `Bills ${to}`)
      XLSX.writeFile(workbook, `bflex-shop-report-${to}.xlsx`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not prepare the report workbook.') }
    finally { setExporting(false) }
  }

  return (
    <div className="page dashboard-page">
      <header className="page-head dashboard-head">
        <div><h1>BFlex</h1><p className="muted">Shop performance and today’s next actions</p></div>
        <div className="dashboard-range">
          <div className="segmented" aria-label="Report range">
            <button type="button" className={`seg ${from === today && to === today ? 'on' : ''}`} onClick={() => { setFrom(today); setTo(today) }}>Today</button>
            <button type="button" className={`seg ${from === daysBefore(today, 6) && to === today ? 'on' : ''}`} onClick={() => range(7)}>7 days</button>
            <button type="button" className={`seg ${from === daysBefore(today, 29) && to === today ? 'on' : ''}`} onClick={() => range(30)}>30 days</button>
          </div>
          <label className="field"><span>From</span><input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} /></label>
          <label className="field"><span>To</span><input type="date" value={to} min={from} max={today} onChange={e => setTo(e.target.value)} /></label>
        </div>
      </header>

      <section className="card">
        <div className="actions dashboard-actions">
          <button type="button" className="primary big" onClick={onViewArticles}>Sell — find an article</button>
          {cart.count > 0 && <button type="button" onClick={onOpenCart}>Cart ({cart.count})</button>}
          <button type="button" onClick={onReceiveStock}>Receive stock</button>
          <button type="button" onClick={onAdd}>Add article</button>
          <button type="button" onClick={onCustomers}>Customers</button>
          <button type="button" onClick={() => void exportWorkbook()} disabled={exporting || !report}>{exporting ? 'Preparing export…' : 'Export report'}</button>
          <button type="button" onClick={onImportInventory}>Import inventory</button>
          <button type="button" onClick={onImportSales}>Import sales</button>
        </div>
      </section>

      {error && <div className="banner err">Could not load this report: {error}</div>}
      {loading && !report && <section className="card"><p className="muted">Loading shop overview…</p></section>}
      {report && (
        <>
          <section className="card dashboard-section">
            <div className="list-head"><div><h2 className="section-title">Sales overview</h2><p className="muted small">{report.from === report.to ? report.to : `${report.from} to ${report.to}`}</p></div><span className="muted small">{qty(report.sales.billCount)} bills · {qty(report.sales.returnCount)} returns</span></div>
            <div className="stats dashboard-stats">
              <Stat label="Net sales" value={rupees(report.sales.takings)} strong />
              <Stat label="Estimated profit" value={rupees(report.sales.profit)} tone={report.sales.profit >= 0 ? 'ok' : 'bad'} hint={report.sales.estimatedProfitBills ? `${report.sales.estimatedProfitBills} bill(s) use estimated cost` : 'Cost recorded at sale'} />
              <Stat label="Bills" value={qty(report.sales.billCount)} />
              <Stat label="Pieces sold" value={qty(report.sales.itemCount)} />
              <Stat label="Average bill" value={rupees(report.sales.billCount ? report.sales.takings / report.sales.billCount : 0)} />
              <Stat label="Discounts given" value={rupees(report.sales.discountGiven)} />
            </div>
            <div className="dashboard-two-col">
              <div>
                <h3 className="section-title">Payment mix</h3>
                {report.paymentBreakdown.length === 0 ? <p className="muted small">No payments in this period.</p> : report.paymentBreakdown.map(item => (
                  <div className="metric-bar-row" key={item.paymentMode}><span>{item.paymentMode}</span><div className="metric-track"><i style={{ width: `${Math.max(3, item.total / maxPayment * 100)}%` }} /></div><strong>{rupees(item.total)}</strong></div>
                ))}
              </div>
              <div>
                <h3 className="section-title">Inventory position</h3>
                <div className="stats dashboard-stats">
                  <Stat label="Variants" value={qty(report.inventory.variantCount)} />
                  <Stat label="Pieces on hand" value={qty(report.inventory.unitsOnHand)} />
                  <Stat label="Stock at cost" value={rupees(report.inventory.stockAtCost)} hint="Current average cost" />
                  <Stat label="Need attention" value={qty(report.inventory.lowStockCount)} tone={report.inventory.lowStockCount ? 'bad' : 'ok'} hint={`${report.inventory.outOfStockCount} out of stock`} />
                </div>
              </div>
            </div>
          </section>

          <div className="dashboard-two-col">
            <section className="card dashboard-section">
              <div className="list-head"><h2 className="section-title">Restock soon</h2><span className="count">{report.inventory.lowStockCount}</span></div>
              {report.lowStock.length === 0 ? <p className="muted">No low-stock alerts. Set reorder levels on article details to get alerts here.</p> : (
                <div className="table-scroll"><table><thead><tr><th>Article</th><th>Colour / size</th><th className="r">On hand</th><th className="r">Alert at</th><th></th></tr></thead><tbody>{report.lowStock.map(item => <tr key={item.variantId}><td><button className="code-link" type="button" onClick={() => onOpenArticle(item.variantId)}>{item.articleCode}</button><div className="muted small">{item.description}</div></td><td>{item.colour} · {item.size}</td><td className="r num">{qty(item.quantity)}</td><td className="r num">{qty(item.reorderLevel)}</td><td><button type="button" className="ghost small-btn" onClick={() => onOpenArticle(item.variantId)}>Restock</button></td></tr>)}</tbody></table></div>
              )}
            </section>

            <section className="card dashboard-section">
              <div className="list-head"><h2 className="section-title">Best sellers</h2><span className="muted small">Selected period</span></div>
              {report.topSellers.length === 0 ? <p className="muted">Sales will appear here as bills are recorded.</p> : report.topSellers.map(item => (
                <button type="button" className="rank-row" key={item.variantId} onClick={() => onOpenArticle(item.variantId)}><span><strong>{item.articleCode}</strong><small>{item.description} · {item.colour} · {item.size}</small></span><span className="rank-bar"><i style={{ width: `${Math.max(4, item.quantity / topQuantity * 100)}%` }} /></span><b>{qty(item.quantity)} pcs</b></button>
              ))}
            </section>
          </div>

          <div className="dashboard-two-col">
            <section className="card dashboard-section">
              <div className="list-head"><h2 className="section-title">Stock sitting on the shelf</h2><span className="muted small">Oldest sale first</span></div>
              {report.slowMovers.length === 0 ? <p className="muted">No stock on hand.</p> : <div className="table-scroll"><table><thead><tr><th>Article</th><th>Last sold</th><th className="r">Qty</th><th className="r">Value at cost</th></tr></thead><tbody>{report.slowMovers.map(item => <tr key={item.variantId}><td><button type="button" className="code-link" onClick={() => onOpenArticle(item.variantId)}>{item.articleCode}</button><div className="muted small">{item.colour} · {item.size}</div></td><td>{item.daysSinceSale === null ? 'Never sold' : `${qty(item.daysSinceSale)} days ago`}</td><td className="r num">{qty(item.quantity)}</td><td className="r num">{rupees(item.stockAtCost)}</td></tr>)}</tbody></table></div>}
            </section>
            <section className="card dashboard-section">
              <div className="list-head"><h2 className="section-title">Bills on {to}</h2><span className="muted small">{day?.billCount ?? 0} bills</span></div>
              {!day?.bills.length ? <p className="muted">No sales recorded on this date.</p> : <div className="table-scroll"><table><thead><tr><th>Bill</th><th>Time</th><th>Customer</th><th className="r">Total</th><th></th></tr></thead><tbody>{day.bills.map(b => <tr key={b.id}><td><button type="button" className="code-link" onClick={() => onOpenBill(b.id)}>{b.billNo}</button></td><td>{time(b.createdAt)}</td><td>{b.customerName ?? <span className="muted">Walk-in</span>}</td><td className="r num">{rupees(b.total)}{b.profitEstimated && <small className="warn block">Estimated cost</small>}</td><td className="r"><button type="button" className="ghost small-btn" onClick={() => onOpenBill(b.id)}>Open</button></td></tr>)}</tbody></table></div>}
            </section>
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, hint, strong, tone }: {
  label: string; value: string; hint?: string; strong?: boolean; tone?: 'ok' | 'bad'
}) {
  return <div className="stat"><span className="stat-label">{label}</span><span className={`stat-value ${strong ? 'strong' : ''} ${tone ?? ''}`}>{value}</span>{hint && <span className="stat-hint">{hint}</span>}</div>
}

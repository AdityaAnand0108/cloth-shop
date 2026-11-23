import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import type { BillSummary } from '../../api/types'
import { qty, rupees, dateTime } from '../../money'

const PAGE_SIZE = 50

export function BillsPage({ onBack, onOpenBill }: { onBack: () => void; onOpenBill: (billId: number) => void }) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [bills, setBills] = useState<BillSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      setLoading(true)
      api.allBills(query.trim(), page, PAGE_SIZE).then(result => {
        if (!cancelled) { setBills(result.content); setTotal(result.totalElements); setError(null) }
      }).catch((e: Error) => { if (!cancelled) setError(e.message) })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, 180)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [query, page])

  return (
    <div className="page bills-page">
      <header className="page-head">
        <button type="button" className="link" onClick={onBack}>← Dashboard</button>
        <h1>All bills <span className="count">{total}</span></h1>
        <p className="muted">Search past sales by bill number or customer name.</p>
      </header>
      {error && <div className="banner err">Could not load bills: {error}</div>}
      <section className="card">
        <label className="field bills-search"><span>Search bills</span><input value={query} onChange={event => { setPage(0); setQuery(event.target.value) }} placeholder="Bill number or customer name" /></label>
        {loading && bills.length === 0 ? <p className="muted">Loading bills…</p> : bills.length === 0 ? <p className="muted">{query ? 'No bills match this search.' : 'No completed bills yet.'}</p> : (
          <div className="table-scroll"><table>
            <thead><tr><th>Bill</th><th>Date and time</th><th>Customer</th><th>Staff</th><th className="r">Items</th><th>Payment</th><th>WhatsApp</th><th className="r">Total</th><th></th></tr></thead>
            <tbody>{bills.map(bill => <tr key={bill.id}>
              <td><button type="button" className="code-link" onClick={() => onOpenBill(bill.id)}>{bill.billNo}</button></td>
              <td>{dateTime(bill.createdAt)}</td>
              <td>{bill.customerName || <span className="muted">Walk-in</span>}</td>
              <td>{bill.staffName || '—'}</td>
              <td className="r num">{qty(bill.itemCount)}</td>
              <td>{bill.paymentMode}</td>
              <td>{bill.whatsappStatus === 'SENT' ? <span className="tag ok">Sent</span> : <span className="tag muted-tag">Not sent</span>}</td>
              <td className="r num">{rupees(bill.total)}{bill.profitEstimated && <small className="warn block">Estimated cost</small>}</td>
              <td className="r"><button type="button" className="ghost small-btn" onClick={() => onOpenBill(bill.id)}>Open</button></td>
            </tr>)}</tbody>
          </table></div>
        )}
        <div className="article-pagination">
          <span className="muted small">{total ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total}` : '0 bills'}</span>
          <div className="row-actions"><button type="button" className="ghost small-btn" disabled={page === 0 || loading} onClick={() => setPage(p => p - 1)}>Previous</button><span className="small">Page {page + 1} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}</span><button type="button" className="ghost small-btn" disabled={(page + 1) * PAGE_SIZE >= total || loading} onClick={() => setPage(p => p + 1)}>Next</button></div>
        </div>
      </section>
    </div>
  )
}

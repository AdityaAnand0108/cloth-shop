import { Fragment, useEffect, useState } from 'react'
import { api } from '../../api/client'
import type { BillSummary, CustomerSummary } from '../../api/types'
import { rupees, time, qty } from '../../money'

export function CustomerPage({ onBack, onOpenBill }: { onBack: () => void; onOpenBill: (billId: number) => void }) {
  const [query, setQuery] = useState('')
  const [customers, setCustomers] = useState<CustomerSummary[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [bills, setBills] = useState<Record<number, BillSummary[]>>({})
  const [historyBusy, setHistoryBusy] = useState<number | null>(null)

  async function toggleHistory(customer: CustomerSummary) {
    if (expanded === customer.id) { setExpanded(null); return }
    setExpanded(customer.id)
    if (bills[customer.id]) return
    setHistoryBusy(customer.id)
    try { setBills(current => ({ ...current, [customer.id]: await api.customerBills(customer.id) })) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load bill history.') }
    finally { setHistoryBusy(null) }
  }

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) { setCustomers([]); return }
    let cancelled = false
    const timer = setTimeout(() => {
      setBusy(true)
      api.searchCustomers(term).then(found => { if (!cancelled) { setCustomers(found); setError(null) } })
        .catch((e: Error) => { if (!cancelled) setError(e.message) })
        .finally(() => { if (!cancelled) setBusy(false) })
    }, 220)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query])

  return <div className="page">
    <header className="page-head"><button type="button" className="link" onClick={onBack}>&larr; Dashboard</button><h1>Customers</h1><p className="muted">Find returning customers by name or phone and see their purchase summary.</p></header>
    {error && <div className="banner err">Could not load customers: {error}</div>}
    <section className="card">
      <label className="field"><span>Search customers</span><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Name or phone number" /></label>
      {busy && <p className="muted">Searching…</p>}
      {query.trim().length < 2 ? <p className="muted">Enter at least two characters to search saved customer history.</p>
        : customers.length === 0 && !busy ? <p className="muted">No saved customers match this search. A customer is saved when a bill is recorded with a valid phone number.</p>
          : <div className="table-scroll"><table><thead><tr><th>Customer</th><th>Phone</th><th className="r">Visits</th><th className="r">Lifetime spend</th><th>Last visit</th><th>WhatsApp opt-in</th><th></th></tr></thead><tbody>{customers.map(c => <Fragment key={c.id}><tr><td><strong>{c.name}</strong></td><td>{c.phone}</td><td className="r num">{c.visitCount}</td><td className="r num">{rupees(c.lifetimeSpend)}</td><td>{c.lastVisit ? new Date(c.lastVisit).toLocaleDateString() : '—'}</td><td>{c.whatsappOptIn ? 'Yes' : 'No'}</td><td><button type="button" className="ghost small-btn" onClick={() => void toggleHistory(c)}>{expanded === c.id ? 'Hide bills' : 'Bill history'}</button></td></tr>{expanded === c.id && <tr><td colSpan={7}>{historyBusy === c.id ? <span className="muted">Loading bills…</span> : (bills[c.id]?.length ? <table className="customer-bills"><thead><tr><th>Bill</th><th>When</th><th className="r">Pieces</th><th className="r">Total</th><th></th></tr></thead><tbody>{bills[c.id].map(b => <tr key={b.id}><td>{b.billNo}</td><td>{time(b.createdAt)}</td><td className="r">{qty(b.itemCount)}</td><td className="r">{rupees(b.total)}</td><td className="r"><button type="button" className="ghost small-btn" onClick={() => onOpenBill(b.id)}>Open bill</button></td></tr>)}</tbody></table> : <span className="muted">No completed bills found.</span>)}</td></tr>}</Fragment>)}</tbody></table></div>}
    </section>
  </div>
}

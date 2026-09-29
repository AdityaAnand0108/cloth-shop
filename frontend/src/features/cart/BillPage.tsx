import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import type { Bill } from '../../api/types'
import { amount, dateTime, qty, rupees } from '../../money'

type Props = {
  /** A bill just rung up, handed straight over so the receipt needs no round trip. */
  bill?: Bill
  /** Or an older one, looked up from the day's list. */
  billId?: number
  onNewSale: () => void
  onBack: () => void
}

/**
 * The receipt. Printable as it stands — the print stylesheet drops everything on the
 * page except the paper itself, so Ctrl+P produces a bill and not a screenshot of an
 * app.
 *
 * What the shop sees and what the customer sees are separated deliberately: the margin
 * block carries `no-print`, so handing over the printout never hands over the cost
 * price with it.
 */
export function BillPage({ bill: given, billId, onNewSale, onBack }: Props) {
  const [bill, setBill] = useState<Bill | null>(given ?? null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (given || billId === undefined) return
    api.bill(billId).then(setBill).catch((e: Error) => setError(e.message))
  }, [given, billId])

  if (error) {
    return (
      <div className="page">
        <button type="button" className="link self-start" onClick={onBack}>&larr; Back</button>
        <div className="banner err">{error}</div>
      </div>
    )
  }
  if (!bill) {
    return (
      <div className="page">
        <button type="button" className="link self-start" onClick={onBack}>&larr; Back</button>
        <p className="muted">Loading&hellip;</p>
      </div>
    )
  }

  const b = bill
  const savedByCustomer =
    b.lines.reduce((sum, l) => sum + (l.listPrice - l.unitPrice) * l.qty, 0) + b.discount
  const marginPct = b.total > 0 ? (b.profit / b.total) * 100 : 0

  return (
    <div className="page">
      <div className="no-print bill-toolbar">
        <button type="button" className="link" onClick={onBack}>&larr; Dashboard</button>
        <div className="actions">
          <button type="button" onClick={() => window.print()}>Print bill</button>
          <button type="button" className="primary" onClick={onNewSale}>Next customer</button>
        </div>
      </div>

      {given && (
        <div className="banner ok no-print">
          Sold. {qty(b.itemCount)} {Number(b.itemCount) === 1 ? 'piece' : 'pieces'} off
          the shelf, {rupees(b.total)} taken, bill {b.billNo}.
        </div>
      )}

      <section className="card bill-paper">
        <header className="bill-paper-head">
          <div>
            <h1>BFlex</h1>
            <p className="muted small">Tax invoice</p>
          </div>
          <div className="bill-meta">
            <code>{b.billNo}</code>
            <span className="muted small">{dateTime(b.createdAt)}</span>
            {b.staffName && <span className="muted small">Billed by {b.staffName}</span>}
          </div>
        </header>

        {(b.customerName || b.customerPhone) && (
          <p className="bill-customer">
            <strong>{b.customerName ?? 'Walk-in'}</strong>
            {b.customerPhone && <span className="muted"> &middot; {b.customerPhone}</span>}
          </p>
        )}

        <div className="table-scroll">
          <table className="bill-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Article</th>
                <th className="r">Qty</th>
                <th className="r">Rate</th>
                <th className="r">Amount</th>
              </tr>
            </thead>
            <tbody>
              {b.lines.map((l, i) => (
                <tr key={`${l.variantId}-${i}`}>
                  <td className="muted">{i + 1}</td>
                  <td>
                    <span className="bill-line-name">{l.description}</span>
                    <span className="bill-line-sub">
                      <code>{l.articleCode}</code> {l.colour} &middot; size {l.size}
                    </span>
                  </td>
                  <td className="r num">{qty(l.qty)}</td>
                  <td className="r num">
                    {amount(l.unitPrice)}
                    {l.unitPrice < l.listPrice && (
                      <span className="bill-struck">{amount(l.listPrice)}</span>
                    )}
                  </td>
                  <td className="r num">{amount(l.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <table className="costing bill-totals">
          <tbody>
            <tr>
              <th>Subtotal</th>
              <td className="num">{rupees(b.subtotal)}</td>
            </tr>
            {b.discount > 0 && (
              <tr>
                <th>Discount on the bill</th>
                <td className="num">&minus; {rupees(b.discount)}</td>
              </tr>
            )}
            <tr className="total">
              <th>Total &mdash; paid by {b.paymentMode.toLowerCase()}</th>
              <td className="num">{rupees(b.total)}</td>
            </tr>
          </tbody>
        </table>

        {savedByCustomer > 0 && (
          <p className="bill-saved">
            You saved {rupees(savedByCustomer)} on this bill.
          </p>
        )}

        {b.note && <p className="bill-note">{b.note}</p>}

        <p className="bill-foot muted small">
          Exchange within 7 days with this bill. No exchange on altered garments.
        </p>
      </section>

      {/* Never printed. The customer's copy must not carry the cost price. */}
      <section className="card no-print">
        <h2 className="section-title">What the shop made</h2>
        <div className="stats">
          <Stat label="Taken" value={rupees(b.total)} strong />
          <Stat label="Goods cost" value={rupees(b.costTotal)} />
          <Stat
            label="Profit"
            value={rupees(b.profit)}
            tone={b.profit >= 0 ? 'ok' : 'bad'}
            hint={`${marginPct.toFixed(1)}% margin`}
          />
          <Stat label="Given away" value={rupees(savedByCustomer)}
            hint="Line discounts plus the bill discount" />
        </div>
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

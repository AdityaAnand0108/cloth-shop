import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import type { Bill } from '../../api/types'
import { amount, dateTime, qty, rupees } from '../../money'
import { whatsappBillText, whatsappBillUrl, whatsappNumber } from './whatsapp'

type Props = {
  /** A bill just rung up, handed straight over so the receipt needs no round trip. */
  bill?: Bill
  /** Or an older one, looked up from the day's list. */
  billId?: number
  onNewSale: () => void
  onBack: () => void
  onReturn: () => void
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
export function BillPage({ bill: given, billId, onNewSale, onBack, onReturn }: Props) {
  const [bill, setBill] = useState<Bill | null>(given ?? null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmingWhatsApp, setConfirmingWhatsApp] = useState(false)
  const [editingPrices, setEditingPrices] = useState(false)
  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>({})
  const [savingPrices, setSavingPrices] = useState(false)

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
  const whatsappUrl = whatsappBillUrl(b)
  const hasPhone = Boolean(b.customerPhone)
  const savedByCustomer =
    b.lines.reduce((sum, l) => sum + Math.max(0, l.listPrice - l.unitPrice) * l.qty, 0) + b.discount
  const marginPct = b.total > 0 ? (b.profit / b.total) * 100 : 0

  return (
    <div className="page">
      <div className="no-print bill-toolbar">
        <button type="button" className="link" onClick={onBack}>&larr; Dashboard</button>
        <div className="actions">
          <button type="button" onClick={() => window.print()}>Print bill</button>
          {b.status === 'COMPLETED' && <button type="button" onClick={() => {
            setPriceDrafts(Object.fromEntries(b.lines.map(line => [line.id, String(line.unitPrice)])))
            setEditingPrices(true); setActionError(null)
          }}>Correct sold prices</button>}
          {b.status === 'COMPLETED' && <button type="button" onClick={onReturn}>Return / exchange</button>}
          {whatsappUrl && b.whatsappOptIn && (
            <>
              <button type="button" onClick={async () => {
                try {
                  await navigator.clipboard.writeText(whatsappBillText(b))
                } catch {
                  const field = document.createElement('textarea')
                  field.value = whatsappBillText(b); field.style.position = 'fixed'; field.style.opacity = '0'
                  document.body.appendChild(field); field.select(); document.execCommand('copy'); field.remove()
                }
                setCopied(true); window.setTimeout(() => setCopied(false), 2600)
              }}>{copied ? 'Message copied' : 'Copy bill message'}</button>
              <button type="button" className="primary" onClick={() => window.open(whatsappUrl, '_blank', 'noopener,noreferrer')}>
                {b.whatsappStatus === 'SENT' ? 'Resend bill on WhatsApp' : 'Open WhatsApp to send'}
              </button>
              <button type="button" disabled={confirmingWhatsApp} onClick={async () => {
                setConfirmingWhatsApp(true)
                try { setBill(await api.confirmWhatsAppSent(b.id)) }
                catch (e) { setActionError(e instanceof Error ? e.message : 'Could not record the confirmation.') }
                finally { setConfirmingWhatsApp(false) }
              }}>{confirmingWhatsApp ? 'Saving…' : b.whatsappStatus === 'SENT' ? 'I resent it' : 'I sent it'}</button>
            </>
          )}
          <button type="button" className="primary" onClick={onNewSale}>Next customer</button>
        </div>
      </div>

      {given && hasPhone && !whatsappNumber(b.customerPhone) && (
        <div className="banner err no-print">
          Bill saved, but this phone number does not look valid for WhatsApp. Update the
          customer number on the next sale to share bills.
        </div>
      )}
      {given && whatsappUrl && b.whatsappOptIn && (
        <div className="banner ok no-print">
          Bill saved. Copy the message or open WhatsApp, review the receipt and tap Send.
        </div>
      )}
      {given && hasPhone && whatsappUrl && !b.whatsappOptIn && (
        <div className="banner no-print">
          WhatsApp receipt controls are hidden because the customer did not opt in at checkout.
        </div>
      )}
      {actionError && <div className="banner err no-print">{actionError}</div>}
      {b.whatsappStatus === 'SENT' && <div className="banner ok no-print">WhatsApp bill marked sent by staff.</div>}

      {editingPrices && <section className="card no-print">
        <h2 className="section-title">Correct sold prices</h2>
        <p className="muted small">Update the unit price charged on each line. Quantities and stock stay unchanged; bill totals update when saved.</p>
        <div className="table-scroll"><table><thead><tr><th>Article</th><th className="r">Qty</th><th className="r">Sold price</th></tr></thead>
          <tbody>{b.lines.map(line => <tr key={line.id}><td>{line.description}<span className="bill-line-sub"><code>{line.articleCode}</code> {line.colour} · size {line.size}</span></td>
            <td className="r num">{qty(line.qty)}</td><td className="r"><input aria-label={`Sold price for ${line.articleCode}`} type="number" min="0" step="0.01" value={priceDrafts[line.id] ?? ''} onChange={event => setPriceDrafts(current => ({ ...current, [line.id]: event.target.value }))} /></td>
          </tr>)}</tbody></table></div>
        <div className="actions"><button type="button" className="primary" disabled={savingPrices || b.lines.some(line => priceDrafts[line.id] === '' || !Number.isFinite(Number(priceDrafts[line.id])) || Number(priceDrafts[line.id]) < 0)} onClick={async () => {
          setSavingPrices(true); setActionError(null)
          try {
            const updated = await api.updateBillPrices(b.id, b.lines.map(line => ({ lineId: line.id, unitPrice: Number(priceDrafts[line.id]) })))
            setBill(updated); setEditingPrices(false)
          } catch (e) { setActionError(e instanceof Error ? e.message : 'Could not update bill prices.') }
          finally { setSavingPrices(false) }
        }}>{savingPrices ? 'Saving…' : 'Save corrected prices'}</button>
          <button type="button" onClick={() => setEditingPrices(false)} disabled={savingPrices}>Cancel</button></div>
      </section>}

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

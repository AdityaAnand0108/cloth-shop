import { useEffect, useMemo, useState } from 'react'
import { api, HttpError } from '../../api/client'
import type { Bill, CartArticle, CustomerSummary, Lookups, PaymentMode } from '../../api/types'
import { amount, rupees } from '../../money'
import { useCart } from './CartContext'

const PAYMENT_MODES: PaymentMode[] = ['CASH', 'UPI', 'CARD']

/** What a bill is rounded down to. Nobody hands back four rupees. */
const ROUND_TO = 10
const STAFF_STORAGE_KEY = 'bflex.staff.v1'
const PAYMENT_STORAGE_KEY = 'bflex.payment.v1'

type Props = {
  onBack: () => void
  onBrowse: () => void
  onBilled: (bill: Bill) => void
  onOpenArticle: (variantId: number) => void
}

/**
 * The counter. One customer, one armful of clothes, one bill.
 *
 * Two things make this screen different from a web shop's checkout. Prices are
 * negotiable — every line can be typed over, because that is what actually happens
 * across a counter — and the person doing the negotiating is shown the floor: what
 * each garment cost, and what is left on the bill after the haggling. A shop assistant
 * who can see the margin can say yes to a discount without asking the owner.
 */
export function CartPage({ onBack, onBrowse, onBilled, onOpenArticle }: Props) {
  const cart = useCart()

  const [articles, setArticles] = useState<CartArticle[] | null>(null)
  const [lookups, setLookups] = useState<Lookups | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [discountInput, setDiscountInput] = useState('')
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(() => (localStorage.getItem(PAYMENT_STORAGE_KEY) as PaymentMode | null) ?? 'CASH')
  const [staffId, setStaffId] = useState(() => localStorage.getItem(STAFF_STORAGE_KEY) ?? '')
  const [customerMatches, setCustomerMatches] = useState<CustomerSummary[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSummary | null>(null)
  const [whatsappOptIn, setWhatsappOptIn] = useState(false)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Only the SET of articles matters here. Changing a quantity must not cost a round
  // trip, but adding a garment must.
  const idKey = cart.lines.map(l => l.variantId).sort((a, b) => a - b).join(',')

  useEffect(() => {
    api.lookups().then(setLookups).catch((e: Error) => setError(e.message))
  }, [])

  useEffect(() => {
    const digits = customerPhone.replace(/\D/g, '')
    if (digits.length < 10) { setCustomerMatches([]); return }
    let cancelled = false
    const timer = setTimeout(() => api.searchCustomers(customerPhone)
      .then(matches => { if (!cancelled) setCustomerMatches(matches) })
      .catch(() => { if (!cancelled) setCustomerMatches([]) }), 240)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [customerPhone])

  useEffect(() => {
    if (cart.lines.length === 0) { setArticles([]); return }
    let cancelled = false
    api.priceCheck(cart.lines.map(l => l.variantId))
      .then(found => { if (!cancelled) { setArticles(found); setError(null) } })
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [idKey])

  const byId = useMemo(
    () => new Map((articles ?? []).map(a => [a.variantId, a])),
    [articles],
  )

  // An article deleted from the catalogue since it went in the cart comes back from
  // the price check as nothing at all. Say so rather than quietly dropping it.
  const orphans = articles === null ? [] : cart.lines.filter(l => !byId.has(l.variantId))

  const rows = cart.lines
    .map(line => {
      const article = byId.get(line.variantId)
      if (!article) return null
      const unitPrice = line.price ?? article.sellingPrice
      return {
        line,
        article,
        unitPrice,
        lineTotal: unitPrice * line.qty,
        lineCost: article.avgCost * line.qty,
        short: line.qty > article.qtyOnHand,
        belowCost: unitPrice < article.avgCost,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  const subtotal = rows.reduce((sum, r) => sum + r.lineTotal, 0)
  const costTotal = rows.reduce((sum, r) => sum + r.lineCost, 0)

  const typedDiscount = Number(discountInput)
  const discount = discountInput === '' || Number.isNaN(typedDiscount) || typedDiscount < 0
    ? 0
    : typedDiscount
  const total = subtotal - discount
  const profit = total - costTotal
  const marginPct = total > 0 ? (profit / total) * 100 : 0

  const roundOff = total - Math.floor(total / ROUND_TO) * ROUND_TO
  const anyShort = rows.some(r => r.short)
  const discountTooBig = discount > subtotal

  const blocker =
    rows.length === 0 ? 'Add something to the cart first.'
      : anyShort ? 'One line is asking for more than is on the shelf. Fix the quantity first.'
        : discountTooBig ? 'The discount is larger than the bill.'
          : !staffId ? 'Choose who is billing this.'
            : null

  async function completeSale() {
    if (blocker || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const bill = await api.checkout({
        lines: rows.map(r => ({
          variantId: r.article.variantId,
          qty: r.line.qty,
          unitPrice: Number(r.unitPrice.toFixed(2)),
        })),
        staffId: Number(staffId),
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        whatsappOptIn,
        discount,
        paymentMode,
        note: note.trim() || undefined,
      }, cart.idempotencyKey)

      cart.clear()
      onBilled(bill)
    } catch (e) {
      const message = e instanceof HttpError ? e.message : (e as Error).message
      setError(message)
      // Whatever went wrong, the shelf is the thing most likely to have moved.
      api.priceCheck(cart.lines.map(l => l.variantId)).then(setArticles).catch(() => {})
      setSubmitting(false)
    }
  }

  return (
    <div className="page">
      <header className="page-head cart-head">
        <button type="button" className="link self-start" onClick={onBack}>
          &larr; Dashboard
        </button>
        <div className="list-head">
          <h1>Cart</h1>
          {cart.count > 0 && (
            <button type="button" className="ghost" onClick={cart.clear}>
              Empty the cart
            </button>
          )}
        </div>
        <p className="muted">
          Every price here can be typed over. What each piece cost you is shown
          alongside, so you know how far down you can go.
        </p>
      </header>

      {error && <div className="banner err">{error}</div>}

      {orphans.length > 0 && (
        <div className="banner err">
          {orphans.length === 1 ? 'One article is' : `${orphans.length} articles are`} no
          longer in the catalogue and cannot be billed.{' '}
          <button
            type="button"
            className="link"
            onClick={() => orphans.forEach(o => cart.remove(o.variantId))}
          >
            Remove {orphans.length === 1 ? 'it' : 'them'}
          </button>
        </div>
      )}

      {articles === null
        ? <div className="card"><p className="muted">Checking prices&hellip;</p></div>
        : rows.length === 0
          ? (
            <div className="card empty-cart">
              <p className="muted">
                Nothing in the cart yet. Find what the customer is holding and add it.
              </p>
              <button type="button" className="primary" onClick={onBrowse}>
                Search articles
              </button>
            </div>
          )
          : (
            <>
              <section className="card">
                <div className="list-head">
                  <h2 className="section-title">
                    Items <span className="count">{cart.count}</span>
                  </h2>
                  <button type="button" className="ghost small-btn" onClick={onBrowse}>
                    + Add more
                  </button>
                </div>

                <div className="cart-lines">
                  {rows.map(r => (
                    <article
                      key={r.article.variantId}
                      className={`cart-line ${r.short ? 'short' : ''}`}
                    >
                      <div className="cart-line-what">
                        <button
                          type="button"
                          className="code-link"
                          onClick={() => onOpenArticle(r.article.variantId)}
                        >
                          {r.article.articleCode}
                        </button>
                        <span className="cart-line-name">{r.article.displayName}</span>
                        <span className="cart-line-attrs">
                          <span
                            className="swatch sm"
                            style={{ background: r.article.colourHex ?? 'transparent' }}
                          />
                          {r.article.colour} &middot; size {r.article.size}
                          <em className={r.article.qtyOnHand <= 0 ? 'warn' : ''}>
                            {r.article.qtyOnHand} on the shelf
                          </em>
                        </span>
                      </div>

                      <div className="cart-line-qty">
                        <span className="mini-label">Qty</span>
                        <div className="stepper">
                          <button
                            type="button"
                            aria-label="One fewer"
                            onClick={() => cart.setQty(r.article.variantId, r.line.qty - 1)}
                          >
                            &minus;
                          </button>
                          <input
                            type="number" min="1" step="1" inputMode="numeric"
                            value={r.line.qty}
                            onChange={e => cart.setQty(
                              r.article.variantId, Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                          />
                          <button
                            type="button"
                            aria-label="One more"
                            disabled={r.line.qty >= r.article.qtyOnHand}
                            onClick={() => cart.setQty(r.article.variantId, r.line.qty + 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="cart-line-price">
                        <span className="mini-label">Price each</span>
                        <input
                          className="num"
                          type="number" min="0" step="1" inputMode="decimal"
                          value={r.line.price === null ? '' : r.line.price}
                          placeholder={amount(r.article.sellingPrice)}
                          onChange={e => cart.setPrice(
                            r.article.variantId,
                            e.target.value === '' ? null : Number(e.target.value))}
                        />
                        <PriceNote
                          unitPrice={r.unitPrice}
                          listPrice={r.article.sellingPrice}
                          cost={r.article.avgCost}
                        />
                      </div>

                      <div className="cart-line-total">
                        <span className="mini-label">Line total</span>
                        <strong className="num">{rupees(r.lineTotal)}</strong>
                        <span className="cart-line-margin">
                          you make {rupees(r.lineTotal - r.lineCost)}
                        </span>
                      </div>

                      <button
                        type="button"
                        className="ghost icon-btn"
                        aria-label={`Remove ${r.article.articleCode}`}
                        onClick={() => cart.remove(r.article.variantId)}
                      >
                        &times;
                      </button>

                      {r.short && (
                        <p className="cart-line-alert">
                          Only {r.article.qtyOnHand} left on the shelf — this line asks
                          for {r.line.qty}.
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </section>

              <section className="card">
                <h2 className="section-title">Customer</h2>
                <p className="muted small">
                  Optional, and worth the ten seconds: it is what lets you find this bill
                  again when they come back to exchange something.
                </p>
                <div className="grid">
                  <label className="field">
                    <span>Name</span>
                    <input
                      type="text" value={customerName}
                      onChange={e => { setCustomerName(e.target.value); setSelectedCustomer(null) }}
                      placeholder="Walk-in"
                    />
                  </label>
                  <label className="field">
                    <span>Phone</span>
                    <input
                      type="text" inputMode="tel" value={customerPhone}
                      onChange={e => { setCustomerPhone(e.target.value); setSelectedCustomer(null) }}
                      placeholder="For exchanges and reminders"
                    />
                  </label>
                </div>
                {customerMatches.length > 0 && !selectedCustomer && <div className="customer-suggestions" role="listbox" aria-label="Saved customers">{customerMatches.map(customer => <button type="button" key={customer.id} onClick={() => { setSelectedCustomer(customer); setCustomerName(customer.name); setCustomerPhone(customer.phone); setWhatsappOptIn(customer.whatsappOptIn); setCustomerMatches([]) }}><span><strong>{customer.name}</strong><small>{customer.phone} · {customer.visitCount} visits · {rupees(customer.lifetimeSpend)} lifetime</small></span><span className="muted">Use customer</span></button>)}</div>}
                {selectedCustomer && <p className="muted small customer-match-note">Returning customer · {selectedCustomer.visitCount} visits · lifetime spend {rupees(selectedCustomer.lifetimeSpend)}</p>}
                <label className="inline-check whatsapp-consent"><input type="checkbox" checked={whatsappOptIn} onChange={e => setWhatsappOptIn(e.target.checked)} /> Customer agrees to receive bill copies on WhatsApp</label>
              </section>

              <section className="card bill-card">
                <h2 className="section-title">The bill</h2>

                <table className="costing">
                  <tbody>
                    <tr>
                      <th>Subtotal <em className="muted">{cart.count} pcs</em></th>
                      <td className="num">{rupees(subtotal)}</td>
                    </tr>
                    <tr>
                      <th>
                        Discount on the bill
                        {roundOff > 0 && (
                          <button
                            type="button"
                            className="link round-off"
                            onClick={() => setDiscountInput(String(
                              Number((discount + roundOff).toFixed(2))))}
                          >
                            round off {rupees(roundOff)}
                          </button>
                        )}
                      </th>
                      <td>
                        <input
                          className="inline-price num"
                          type="number" min="0" step="1" inputMode="decimal"
                          value={discountInput}
                          onChange={e => setDiscountInput(e.target.value)}
                          placeholder="0"
                        />
                      </td>
                    </tr>
                    <tr className="total">
                      <th>To pay</th>
                      <td className="num">{rupees(total)}</td>
                    </tr>
                  </tbody>
                </table>

                <div className={`margin-strip ${profit >= 0 ? 'ok' : 'bad'}`}>
                  {profit >= 0
                    ? <>You make <strong>{rupees(profit)}</strong> on this bill
                      <em> {marginPct.toFixed(1)}% margin &middot; goods cost {rupees(costTotal)}</em></>
                    : <>This bill loses <strong>{rupees(-profit)}</strong>
                      <em> the goods cost {rupees(costTotal)}</em></>}
                </div>

                <fieldset className="price-choice">
                  <legend>Paid by</legend>
                  <div className="segmented">
                    {PAYMENT_MODES.map(mode => (
                      <button
                        key={mode}
                        type="button"
                        className={paymentMode === mode ? 'seg on' : 'seg'}
                        onClick={() => { setPaymentMode(mode); localStorage.setItem(PAYMENT_STORAGE_KEY, mode) }}
                      >
                        {mode === 'CASH' ? 'Cash' : mode === 'UPI' ? 'UPI' : 'Card'}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="grid">
                  <label className="field">
                    <span>Billed by</span>
                    <select value={staffId} onChange={e => { setStaffId(e.target.value); localStorage.setItem(STAFF_STORAGE_KEY, e.target.value) }}>
                      <option value="">Choose&hellip;</option>
                      {lookups?.staff.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Note <span className="hint">optional</span></span>
                    <input
                      type="text" value={note}
                      onChange={e => setNote(e.target.value)}
                      placeholder="Alteration promised, delivery, anything to remember"
                    />
                  </label>
                </div>

                <div className="actions checkout-actions">
                  <button
                    type="button"
                    className="primary big"
                    disabled={blocker !== null || submitting}
                    onClick={completeSale}
                  >
                    {submitting ? 'Completing…' : `Complete sale — ${rupees(total)}`}
                  </button>
                  {blocker && <span className="muted small">{blocker}</span>}
                </div>
              </section>
            </>
          )}
    </div>
  )
}

/**
 * The line under a price box. It answers the only two questions worth asking mid-haggle:
 * how much has been given away, and is there anything left in it.
 */
function PriceNote({ unitPrice, listPrice, cost }: {
  unitPrice: number
  listPrice: number
  cost: number
}) {
  if (unitPrice < cost) {
    return (
      <span className="price-note bad">
        below your {rupees(cost)} cost
      </span>
    )
  }
  if (unitPrice < listPrice && listPrice > 0) {
    const off = ((listPrice - unitPrice) / listPrice) * 100
    return (
      <span className="price-note warn">
        {off.toFixed(0)}% off {rupees(listPrice)}
      </span>
    )
  }
  if (unitPrice > listPrice) {
    return <span className="price-note warn">above the {rupees(listPrice)} sticker</span>
  }
  return <span className="price-note">sticker price</span>
}

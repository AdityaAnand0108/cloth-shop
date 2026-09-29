import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import type { ArticleDetail } from '../../api/types'
import { AddToCartButton } from '../cart/AddToCartButton'

const rupees = (n: number) =>
  `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const qty = (n: number) => String(Number(n))

const DAY_MS = 86_400_000
const daysSince = (iso: string | null) =>
  iso === null ? null : Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS)

const onDate = (iso: string | null) =>
  iso === null ? '—' : new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

const ago = (iso: string | null) => {
  const days = daysSince(iso)
  if (days === null) return '—'
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

/** Discounts a shopkeeper actually offers, plus the point where the profit runs out. */
const DISCOUNTS = [0, 5, 10, 15, 20, 25]

type Note = { tone: 'ok' | 'warn' | 'info'; text: string }

export function ArticleDetailPage({ variantId, onBack, onOpenArticle }: {
  variantId: number
  onBack: () => void
  onOpenArticle: (variantId: number) => void
}) {
  const [detail, setDetail] = useState<ArticleDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDetail(null)
    setError(null)
    api.article(variantId).then(setDetail).catch((e: Error) => setError(e.message))
  }, [variantId])

  // What the customer is really asking when they ask for a discount.
  const [askingPrice, setAskingPrice] = useState('')

  const notes = useMemo<Note[]>(() => detail ? adviseOn(detail) : [], [detail])

  if (error) return <Shell onBack={onBack}><div className="banner err">{error}</div></Shell>
  if (!detail) return <Shell onBack={onBack}><p className="muted">Loading…</p></Shell>

  const d = detail
  const profit = d.sellingPrice - d.avgCost
  const marginPct = d.sellingPrice > 0 ? (profit / d.sellingPrice) * 100 : 0
  const stockAtCost = d.qtyOnHand * d.avgCost
  const stockAtRetail = d.qtyOnHand * d.sellingPrice

  const asking = Number(askingPrice)
  const askingValid = askingPrice !== '' && !Number.isNaN(asking) && asking > 0
  const askingProfit = asking - d.avgCost

  return (
    <Shell onBack={onBack}>
      <header className="detail-head">
        <div className="detail-code">
          <code>{d.articleCode}</code>
          {d.status !== 'ACTIVE' && <span className="tag warn">{d.status}</span>}
        </div>
        <h1>{d.displayName}</h1>
        <div className="chips">
          <span className="chip">
            <span className="swatch sm" style={{ background: d.colourHex ?? 'transparent' }} />
            {d.colour}
          </span>
          <span className="chip">Size {d.size}</span>
          <span className="chip">{d.articleType}</span>
          <span className="chip">{d.material}</span>
          <span className="chip">{d.brand}</span>
          {d.hsnCode && <span className="chip">HSN {d.hsnCode}</span>}
        </div>
      </header>

      <div className="sell-strip">
        <div className="sell-strip-price">
          <span className="stat-label">Selling price</span>
          <strong>{rupees(d.sellingPrice)}</strong>
        </div>
        <span className={`sell-strip-stock ${d.qtyOnHand <= 0 ? 'out' : ''}`}>
          {d.qtyOnHand <= 0
            ? 'Nothing on the shelf'
            : `${qty(d.qtyOnHand)} on the shelf`}
        </span>
        <AddToCartButton variantId={d.variantId} qtyOnHand={Number(d.qtyOnHand)} size="full" />
      </div>

      {notes.length > 0 && (
        <div className="notes">
          {notes.map((n, i) => <p key={i} className={`note ${n.tone}`}>{n.text}</p>)}
        </div>
      )}

      <section className="card">
        <h2 className="section-title">What you make on it</h2>
        <div className="stats">
          <Stat label="Selling price" value={rupees(d.sellingPrice)} strong />
          <Stat label="Cost (avg)" value={rupees(d.avgCost)}
            hint="Weighted average of the stock on hand" />
          <Stat label="Profit per piece" value={rupees(profit)} tone={profit > 0 ? 'ok' : 'bad'} />
          <Stat label="Margin" value={`${marginPct.toFixed(1)}%`} tone={profit > 0 ? 'ok' : 'bad'} />
          <Stat label="Never sell below" value={rupees(d.avgCost)} tone="bad"
            hint="Your cost. Anything under this loses money" />
          <Stat label="Last lot cost" value={rupees(d.lastBuyingPrice)}
            hint="Rate you paid most recently" />
          {d.mrp !== null && <Stat label="MRP" value={rupees(d.mrp)} />}
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">How low can you go</h2>
        <p className="muted small">
          What each discount leaves you, per piece. The customer sees the price; you see
          the rest.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Discount</th>
                <th className="r">Customer pays</th>
                <th className="r">You make</th>
                <th className="r">Margin</th>
              </tr>
            </thead>
            <tbody>
              {DISCOUNTS.map(pct => {
                const price = d.sellingPrice * (1 - pct / 100)
                const made = price - d.avgCost
                return (
                  <tr key={pct} className={made < 0 ? 'below-cost' : ''}>
                    <td>{pct === 0 ? 'Sticker price' : `${pct}% off`}</td>
                    <td className="r num">{rupees(price)}</td>
                    <td className="r num">{rupees(made)}</td>
                    <td className="r num">{price > 0 ? `${((made / price) * 100).toFixed(1)}%` : '—'}</td>
                  </tr>
                )
              })}
              <tr className="break-even">
                <td>Break-even</td>
                <td className="r num">{rupees(d.avgCost)}</td>
                <td className="r num">{rupees(0)}</td>
                <td className="r num">0.0%</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="asking">
          <label className="field">
            <span>Customer is offering</span>
            <input
              type="number" min="0" step="1" inputMode="decimal"
              value={askingPrice}
              onChange={e => setAskingPrice(e.target.value)}
              placeholder="Type a price…"
            />
          </label>
          <output className={`asking-verdict ${!askingValid ? 'idle' : askingProfit >= 0 ? 'ok' : 'bad'}`}>
            {!askingValid
              ? 'Enter what they are asking for and see what is left in it.'
              : askingProfit >= 0
                ? `Take it — you still make ${rupees(askingProfit)} (${((askingProfit / asking) * 100).toFixed(1)}%).`
                : `Refuse — that is ${rupees(-askingProfit)} below what it cost you.`}
          </output>
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">On the shelf</h2>
        <div className="stats">
          <Stat label="In stock" value={`${qty(d.qtyOnHand)} pcs`} strong
            tone={d.qtyOnHand <= 0 ? 'bad' : undefined} />
          <Stat label="Money tied up" value={rupees(stockAtCost)}
            hint="What this stock cost you" />
          <Stat label="Worth at sticker" value={rupees(stockAtRetail)} />
          <Stat label="Profit if it all sells" value={rupees(stockAtRetail - stockAtCost)} tone="ok" />
          {d.reorderLevel > 0 && <Stat label="Reorder level" value={`${qty(d.reorderLevel)} pcs`} />}
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">How it moves</h2>
        <div className="stats">
          <Stat label="Ever received" value={`${qty(d.totalIn)} pcs`} />
          <Stat label="Ever sold" value={`${qty(d.totalOut)} pcs`} />
          <Stat
            label="Sell-through"
            value={d.totalIn > 0 ? `${((d.totalOut / d.totalIn) * 100).toFixed(0)}%` : '—'}
            hint="Share of everything received that has sold"
          />
          <Stat label="First received" value={onDate(d.firstMovementAt)} hint={ago(d.firstMovementAt)} />
          <Stat label="Last sale" value={d.lastSaleAt ? onDate(d.lastSaleAt) : 'No sales yet'}
            hint={d.lastSaleAt ? ago(d.lastSaleAt) : undefined}
            tone={d.lastSaleAt ? undefined : 'bad'} />
          <Stat label="Last movement" value={onDate(d.lastMovementAt)} hint={ago(d.lastMovementAt)} />
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">
          History <span className="count">{d.ledger.length}</span>
        </h2>
        <p className="muted small">
          Every movement ever recorded, newest first. The rate column is what that
          particular lot cost — which is how the average above was arrived at.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>What happened</th>
                <th className="r">Qty</th>
                <th className="r">Balance</th>
                <th className="r">Cost rate</th>
                <th className="r">Sold at</th>
                <th>From / bill</th>
                <th>Note</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {d.ledger.map(row => (
                <tr key={row.id}>
                  <td>{onDate(row.createdAt)}</td>
                  <td>{row.movementType.replaceAll('_', ' ').toLowerCase()}</td>
                  <td className={`r num ${row.qtyDelta < 0 ? 'out' : ''}`}>
                    {row.qtyDelta > 0 ? '+' : ''}{qty(row.qtyDelta)}
                  </td>
                  <td className="r num">{qty(row.balanceAfter)}</td>
                  <td className="r num">{row.unitCost === null ? '—' : rupees(row.unitCost)}</td>
                  <td className="r num">{row.unitPrice === null ? '—' : rupees(row.unitPrice)}</td>
                  <td>{row.wholesaler ?? row.reference ?? '—'}</td>
                  <td>{row.note ?? '—'}</td>
                  <td className="muted">{row.createdBy ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">
          Other sizes &amp; colours <span className="count">{d.siblings.length}</span>
        </h2>
        {d.siblings.length === 0
          ? <p className="muted">This is the only colour and size of {d.displayName} you stock.</p>
          : (
            <>
              <p className="muted small">
                If this one does not fit, these are the same style — offer them before the
                customer walks out.
              </p>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Colour</th>
                      <th>Size</th>
                      <th className="r">Selling</th>
                      <th className="r">Stock</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.siblings.map(s => (
                      <tr key={s.variantId}>
                        <td>
                          <button type="button" className="code-link"
                            onClick={() => onOpenArticle(s.variantId)}>
                            {s.articleCode}
                          </button>
                        </td>
                        <td>
                          <span className="swatch sm" style={{ background: s.colourHex ?? 'transparent' }} />
                          {s.colour}
                        </td>
                        <td>{s.size}</td>
                        <td className="r num">{rupees(s.sellingPrice)}</td>
                        <td className={`r num ${s.qtyOnHand <= 0 ? 'out' : ''}`}>
                          {s.qtyOnHand <= 0 ? 'out of stock' : qty(s.qtyOnHand)}
                        </td>
                        <td className="r">
                          <AddToCartButton variantId={s.variantId} qtyOnHand={Number(s.qtyOnHand)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
      </section>
    </Shell>
  )
}

function Shell({ onBack, children }: { onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="page">
      <button type="button" className="link self-start" onClick={onBack}>&larr; All articles</button>
      {children}
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

/**
 * The read on this article, in the words someone would actually use. Every line is
 * drawn from the ledger — when there is no history to judge by, it says so rather
 * than dressing up a zero as a finding.
 */
function adviseOn(d: ArticleDetail): Note[] {
  const notes: Note[] = []

  if (d.mrp !== null && d.sellingPrice > d.mrp) {
    notes.push({
      tone: 'warn',
      text: `The sticker price is above the printed MRP of ${rupees(d.mrp)}. Fix this — it cannot be sold over MRP.`,
    })
  }

  if (d.sellingPrice <= d.avgCost) {
    notes.push({
      tone: 'warn',
      text: `The selling price does not cover the ${rupees(d.avgCost)} this stock cost you. Every piece sold loses money.`,
    })
  }

  if (d.qtyOnHand <= 0) {
    notes.push({ tone: 'warn', text: 'Nothing on the shelf. Restock before promising it to anyone.' })
  } else if (d.reorderLevel > 0 && d.qtyOnHand <= d.reorderLevel) {
    notes.push({
      tone: 'warn',
      text: `Down to ${qty(d.qtyOnHand)} pcs, at or below the reorder level of ${qty(d.reorderLevel)}.`,
    })
  }

  // Demand, but only where there is enough history to mean anything.
  const ageDays = daysSince(d.firstMovementAt)
  if (d.totalOut <= 0) {
    notes.push({
      tone: 'info',
      text: ageDays !== null && ageDays >= 30
        ? `Received ${ageDays} days ago and not one has sold yet. Worth moving it to the front, or discounting.`
        : 'No sales recorded yet, so there is nothing to judge demand by.',
    })
  } else if (ageDays !== null && ageDays >= 14 && d.qtyOnHand > 0) {
    const perMonth = d.totalOut / (ageDays / 30)
    const coverMonths = d.qtyOnHand / perMonth
    if (coverMonths >= 6) {
      notes.push({
        tone: 'warn',
        text: `Slow mover — about ${perMonth.toFixed(1)} a month, so the ${qty(d.qtyOnHand)} left is roughly ${Math.round(coverMonths)} months of stock. A discount now beats holding it.`,
      })
    } else if (coverMonths <= 1) {
      notes.push({
        tone: 'ok',
        text: `Fast mover — about ${perMonth.toFixed(1)} a month, under a month of stock left. Hold the price and reorder.`,
      })
    } else {
      notes.push({
        tone: 'ok',
        text: `Steady — about ${perMonth.toFixed(1)} a month, roughly ${coverMonths.toFixed(1)} months of stock left.`,
      })
    }
  }

  // A rising buying rate quietly eats the margin on the next lot.
  if (d.lastBuyingPrice > d.avgCost * 1.02) {
    notes.push({
      tone: 'info',
      text: `Your last lot cost ${rupees(d.lastBuyingPrice)} against an average of ${rupees(d.avgCost)}. Restocking is getting dearer, so discount with that in mind.`,
    })
  }

  return notes
}

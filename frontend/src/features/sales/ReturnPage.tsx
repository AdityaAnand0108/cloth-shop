import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import type { ArticleListItem, Lookups, PaymentMode, ReturnResult, ReturnableBill } from '../../api/types'
import { qty, rupees } from '../../money'

type ExchangeItem = { article: ArticleListItem; quantity: string; price: string }
const STAFF_KEY = 'bflex.staff.v1'
const KEY = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
const PAYMENT_MODES: PaymentMode[] = ['CASH', 'UPI', 'CARD']

export function ReturnPage({ saleId, onBack }: { saleId: number; onBack: () => void }) {
  const [source, setSource] = useState<ReturnableBill | null>(null)
  const [lookups, setLookups] = useState<Lookups | null>(null)
  const [staffId, setStaffId] = useState(() => localStorage.getItem(STAFF_KEY) ?? '')
  const [returnType, setReturnType] = useState<'REFUND' | 'EXCHANGE'>('REFUND')
  const [quantities, setQuantities] = useState<Record<number, string>>({})
  const [restock, setRestock] = useState<Record<number, boolean>>({})
  const [reason, setReason] = useState('')
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH')
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<ArticleListItem[]>([])
  const [exchangeItems, setExchangeItems] = useState<ExchangeItem[]>([])
  const [result, setResult] = useState<ReturnResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    Promise.all([api.returnableBill(saleId), api.lookups()])
      .then(([bill, data]) => { setSource(bill); setLookups(data) })
      .catch((e: Error) => setError(e.message))
  }, [saleId])

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) { setMatches([]); return }
    let cancelled = false
    const timer = setTimeout(() => api.listArticles({ q: term })
      .then(page => { if (!cancelled) setMatches(page.content) })
      .catch((e: Error) => { if (!cancelled) setError(e.message) }), 200)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query])

  const selectedReturnLines = useMemo(() => source?.lines.filter(line => Number(quantities[line.saleLineId] ?? 0) > 0) ?? [], [source, quantities])
  const selectedPieces = selectedReturnLines.reduce((sum, line) => sum + Number(quantities[line.saleLineId]), 0)
  const exchangeTotal = exchangeItems.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.price || 0), 0)
  const exchangeValid = returnType !== 'EXCHANGE' || exchangeItems.some(line =>
    Number.isInteger(Number(line.quantity)) && Number(line.quantity) > 0
      && Number(line.quantity) <= line.article.qtyOnHand && Number(line.price) >= 0)

  function addExchange(article: ArticleListItem) {
    if (article.qtyOnHand <= 0) return
    setExchangeItems(current => current.some(line => line.article.variantId === article.variantId) ? current : [...current, {
      article, quantity: '1', price: String(article.sellingPrice),
    }])
    setQuery(''); setMatches([])
  }

  async function submit() {
    if (!source || !staffId || selectedReturnLines.length === 0 || !exchangeValid || busy) return
    setBusy(true); setError(null)
    try {
      const saved = await api.returnSale(saleId, {
        staffId: Number(staffId), returnType, reason: reason.trim() || undefined,
        refundPaymentMode: paymentMode,
        lines: selectedReturnLines.map(line => ({ saleLineId: line.saleLineId,
          quantity: Number(quantities[line.saleLineId]), restock: restock[line.saleLineId] ?? true,
        })),
        exchangeLines: returnType === 'EXCHANGE' ? exchangeItems.filter(x => Number(x.quantity) > 0).map(x => ({
          variantId: x.article.variantId, qty: Number(x.quantity), unitPrice: Number(x.price),
        })) : undefined,
      }, KEY())
      setResult(saved); setSource(await api.returnableBill(saleId))
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save this return.') }
    finally { setBusy(false) }
  }

  if (error && !source) return <div className="page"><button className="link" type="button" onClick={onBack}>← Bill</button><div className="banner err">{error}</div></div>
  if (!source || !lookups) return <div className="page"><button className="link" type="button" onClick={onBack}>← Bill</button><p className="muted">Loading bill…</p></div>

  return <div className="page">
    <header className="page-head"><button type="button" className="link" onClick={onBack}>← Bill {source.bill.billNo}</button><h1>Return or exchange</h1><p className="muted">Choose the items from the original bill. Returned stock is added back to inventory with its original cost.</p></header>
    {error && <div className="banner err">{error}</div>}
    {result && <div className="banner ok"><strong>{result.returnNo} saved.</strong> Credit {rupees(result.refundAmount)}{result.returnType === 'EXCHANGE' ? ` · replacement bill ${result.exchangeBill?.billNo ?? ''} for ${rupees(result.exchangeTotal)} · ${result.settlementDue >= 0 ? `collect ${rupees(result.settlementDue)}` : `refund remaining ${rupees(-result.settlementDue)}`}` : ` · refund by ${result.refundPaymentMode ?? paymentMode.toLowerCase()}`}.</div>}
    <section className="card">
      <div className="list-head"><div><h2 className="section-title">Bill {source.bill.billNo}</h2><p className="muted small">{source.bill.customerName ?? 'Walk-in'} · {new Date(source.bill.createdAt).toLocaleString()}</p></div><span className="tag">Original total {rupees(source.bill.total)}</span></div>
      <div className="table-scroll"><table className="return-table"><thead><tr><th>Article</th><th className="r">Sold</th><th className="r">Returned</th><th className="r">Can return</th><th>Return qty</th><th>Back in stock</th></tr></thead><tbody>{source.lines.map(line => <tr key={line.saleLineId}><td><strong>{line.articleCode}</strong><small className="block muted">{line.description} · {line.colour} · {line.size} · {rupees(line.unitPrice)}</small></td><td className="r num">{qty(line.soldQuantity)}</td><td className="r num">{qty(line.returnedQuantity)}</td><td className="r num">{qty(line.availableQuantity)}</td><td><input type="number" min="0" max={line.availableQuantity} step="1" value={quantities[line.saleLineId] ?? ''} disabled={line.availableQuantity <= 0 || Boolean(result)} onChange={e => setQuantities(current => ({ ...current, [line.saleLineId]: e.target.value }))} /></td><td><label className="inline-check"><input type="checkbox" checked={restock[line.saleLineId] ?? true} disabled={Number(quantities[line.saleLineId] ?? 0) <= 0 || Boolean(result)} onChange={e => setRestock(current => ({ ...current, [line.saleLineId]: e.target.checked }))} /> Good condition</label></td></tr>)}</tbody></table></div>
      <div className="grid return-controls">
        <label className="field"><span>Action</span><select value={returnType} disabled={Boolean(result)} onChange={e => setReturnType(e.target.value as 'REFUND' | 'EXCHANGE')}><option value="REFUND">Refund returned items</option><option value="EXCHANGE">Exchange for other items</option></select></label>
        <label className="field"><span>Handled by</span><select value={staffId} disabled={Boolean(result)} onChange={e => { setStaffId(e.target.value); localStorage.setItem(STAFF_KEY, e.target.value) }}><option value="">Choose staff…</option>{lookups.staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="field"><span>Refund / payment method</span><select value={paymentMode} disabled={Boolean(result)} onChange={e => setPaymentMode(e.target.value as PaymentMode)}>{PAYMENT_MODES.map(mode => <option key={mode} value={mode}>{mode}</option>)}</select></label>
        <label className="field"><span>Reason <em className="hint">optional</em></span><input value={reason} disabled={Boolean(result)} onChange={e => setReason(e.target.value)} placeholder="Size, defect, changed mind…" /></label>
      </div>
      {returnType === 'EXCHANGE' && <div className="exchange-picker"><h3 className="section-title">Replacement items</h3><label className="field"><span>Find replacement article</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by code, brand or style" /></label>{matches.slice(0, 6).map(article => <button type="button" className="exchange-match" key={article.variantId} disabled={article.qtyOnHand <= 0} onClick={() => addExchange(article)}><span><strong>{article.articleCode}</strong><small>{article.brand} · {article.colour} · {article.size} · {qty(article.qtyOnHand)} in stock</small></span><b>{rupees(article.sellingPrice)}</b></button>)}{exchangeItems.map(item => <div className="exchange-line" key={item.article.variantId}><span><strong>{item.article.articleCode}</strong><small>{item.article.colour} · {item.article.size} · max {qty(item.article.qtyOnHand)}</small></span><input aria-label="Replacement quantity" type="number" min="1" max={item.article.qtyOnHand} step="1" value={item.quantity} onChange={e => setExchangeItems(current => current.map(x => x.article.variantId === item.article.variantId ? { ...x, quantity: e.target.value } : x))} /><input aria-label="Replacement price" type="number" min="0" step="0.01" value={item.price} onChange={e => setExchangeItems(current => current.map(x => x.article.variantId === item.article.variantId ? { ...x, price: e.target.value } : x))} /><button type="button" className="ghost small-btn" onClick={() => setExchangeItems(current => current.filter(x => x.article.variantId !== item.article.variantId))}>Remove</button></div>)}{exchangeItems.length > 0 && !exchangeValid && <p className="warn small">Each replacement must have a whole-number quantity within available stock and a valid price.</p>}<p className="muted small">Replacement total: {rupees(exchangeTotal)}. The app will show the amount to collect or refund after applying the return credit.</p></div>}
      <div className="actions"><button type="button" className="primary" disabled={Boolean(result) || busy || !staffId || selectedPieces <= 0 || !exchangeValid} onClick={() => void submit()}>{busy ? 'Saving return…' : returnType === 'EXCHANGE' ? 'Complete exchange' : 'Record refund'}</button><span className="muted small">{qty(selectedPieces)} item(s) selected for return</span></div>
    </section>
  </div>
}

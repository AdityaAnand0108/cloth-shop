import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import type { ArticleDetail, ArticleListItem, Lookups } from '../../api/types'
import { qty, rupees } from '../../money'

type ReceiptLine = {
  article: ArticleListItem
  quantity: string
  buyingPrice: string
  sellingPrice: string
  reorderLevel: string
  updateSellingPrice: boolean
}

const staffStorage = 'bflex.staff.v1'
const supplierStorage = 'bflex.wholesaler.v1'
const idempotency = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
const fromDetail = (d: ArticleDetail): ArticleListItem => ({
  variantId: d.variantId, articleCode: d.articleCode, articleType: d.articleType,
  brand: d.brand, material: d.material, colour: d.colour, colourHex: d.colourHex,
  size: d.size, avgCost: d.avgCost, lastBuyingPrice: d.lastBuyingPrice,
  sellingPrice: d.sellingPrice, qtyOnHand: d.qtyOnHand,
})

export function ReceiveStockPage({ onBack, initialVariantId }: {
  onBack: () => void; initialVariantId?: number
}) {
  const [lookups, setLookups] = useState<Lookups | null>(null)
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<ArticleListItem[]>([])
  const [lines, setLines] = useState<ReceiptLine[]>([])
  const [wholesalerId, setWholesalerId] = useState(() => localStorage.getItem(supplierStorage) ?? '')
  const [staffId, setStaffId] = useState(() => localStorage.getItem(staffStorage) ?? '')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => { api.lookups().then(setLookups).catch((e: Error) => setError(e.message)) }, [])

  useEffect(() => {
    if (initialVariantId === undefined) return
    api.article(initialVariantId).then(d => addArticle(fromDetail(d))).catch((e: Error) => setError(e.message))
    // The detail is a one-time handoff from the article screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialVariantId])

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) { setMatches([]); return }
    let cancelled = false
    const timer = setTimeout(() => api.listArticles({ q: term })
      .then(page => { if (!cancelled) setMatches(page.content) })
      .catch((e: Error) => { if (!cancelled) setError(e.message) }), 220)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query])

  const selectedSupplier = useMemo(() => lookups?.wholesalers.find(w => String(w.id) === wholesalerId), [lookups, wholesalerId])
  const pieces = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0)
  const totalCost = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.buyingPrice) || 0), 0)

  function addArticle(article: ArticleListItem) {
    setLines(current => current.some(line => line.article.variantId === article.variantId) ? current : [...current, {
      article, quantity: '', buyingPrice: String(article.lastBuyingPrice), sellingPrice: String(article.sellingPrice),
      reorderLevel: '', updateSellingPrice: false,
    }])
    setQuery(''); setMatches([]); setError(null)
  }

  function editLine(variantId: number, patch: Partial<ReceiptLine>) {
    setLines(current => current.map(line => line.article.variantId === variantId ? { ...line, ...patch } : line))
  }

  async function save() {
    if (!lookups || !wholesalerId || !staffId || lines.length === 0) return
    const invalid = lines.some(line => !Number.isInteger(Number(line.quantity)) || Number(line.quantity) <= 0
      || Number(line.buyingPrice) < 0 || Number(line.sellingPrice) < 0)
    if (invalid) { setError('Enter a whole-number quantity and valid prices for each article.'); return }
    setBusy(true); setError(null); setSaved(null)
    try {
      const receiptRef = reference.trim() || `REC-${new Date().toISOString().slice(0, 10)}-${Date.now().toString().slice(-5)}`
      const result = await api.receiveInventory({
        wholesalerId: Number(wholesalerId), staffId: Number(staffId), reference: receiptRef,
        note: note.trim() || undefined,
        items: lines.map(line => ({ variantId: line.article.variantId,
          buyingPrice: Number(line.buyingPrice), sellingPrice: Number(line.sellingPrice),
          quantity: Number(line.quantity), updateSellingPrice: line.updateSellingPrice,
          reorderLevel: line.reorderLevel === '' ? undefined : Number(line.reorderLevel),
        })),
      }, idempotency())
      setSaved(`Received ${qty(pieces)} pieces across ${result.items.length} article variants. Reference ${result.reference ?? receiptRef}.`)
      setLines([]); setReference(''); setNote('')
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save this receipt.') }
    finally { setBusy(false) }
  }

  return <div className="page">
    <header className="page-head"><button type="button" className="link" onClick={onBack}>&larr; Dashboard</button><h1>Receive stock</h1><p className="muted">Record a supplier delivery once. Existing variants use their saved price defaults and the stock ledger keeps the invoice reference.</p></header>
    {error && <div className="banner err">{error}</div>}{saved && <div className="banner ok">{saved}</div>}
    <section className="card receipt-meta">
      <div className="grid">
        <label className="field"><span>Supplier</span><select value={wholesalerId} onChange={e => { setWholesalerId(e.target.value); localStorage.setItem(supplierStorage, e.target.value) }}><option value="">Choose supplier…</option>{lookups?.wholesalers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
        <label className="field"><span>Received by</span><select value={staffId} onChange={e => { setStaffId(e.target.value); localStorage.setItem(staffStorage, e.target.value) }}><option value="">Choose staff…</option>{lookups?.staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="field"><span>Supplier invoice / reference <em className="hint">optional</em></span><input value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. invoice number" /></label>
        <label className="field"><span>Note <em className="hint">optional</em></span><input value={note} onChange={e => setNote(e.target.value)} placeholder="Delivery note or purchase detail" /></label>
      </div>
      {selectedSupplier && <p className="muted small">Supplier contact: {selectedSupplier.phone} · {selectedSupplier.address}</p>}
    </section>

    <section className="card">
      <h2 className="section-title">Add items from this delivery</h2>
      <label className="field receipt-search"><span>Find an article by code, brand, material or name</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Start typing, e.g. Zara, TS or article code" /></label>
      {matches.length > 0 && <div className="receipt-matches">{matches.slice(0, 8).map(article => <button key={article.variantId} type="button" onClick={() => addArticle(article)}><span><strong>{article.articleCode}</strong><small>{article.brand} · {article.material} · {article.colour} · {article.size}</small></span><span>{qty(article.qtyOnHand)} on hand</span><b>{rupees(article.lastBuyingPrice)} last cost</b></button>)}</div>}
      {query.trim().length >= 2 && matches.length === 0 && <p className="muted small">No matching articles found. Add a new style from Add article first.</p>}
      {lines.length > 0 ? <div className="table-scroll"><table className="receipt-table"><thead><tr><th>Article</th><th className="r">On hand</th><th>Qty received</th><th>Buy price</th><th>Selling price</th><th>Alert at</th><th>Price update</th><th></th></tr></thead><tbody>{lines.map(line => <tr key={line.article.variantId}><td><strong>{line.article.articleCode}</strong><small className="block muted">{line.article.brand} · {line.article.material} · {line.article.colour} · {line.article.size}</small></td><td className="r num">{qty(line.article.qtyOnHand)}</td><td><input aria-label={`Quantity for ${line.article.articleCode}`} type="number" min="1" step="1" value={line.quantity} onChange={e => editLine(line.article.variantId, { quantity: e.target.value })} /></td><td><input aria-label={`Buying price for ${line.article.articleCode}`} type="number" min="0" step="0.01" value={line.buyingPrice} onChange={e => editLine(line.article.variantId, { buyingPrice: e.target.value })} /></td><td><input aria-label={`Selling price for ${line.article.articleCode}`} type="number" min="0" step="0.01" value={line.sellingPrice} onChange={e => editLine(line.article.variantId, { sellingPrice: e.target.value })} /></td><td><input aria-label={`Reorder alert for ${line.article.articleCode}`} type="number" min="0" step="1" placeholder="Keep existing" value={line.reorderLevel} onChange={e => editLine(line.article.variantId, { reorderLevel: e.target.value })} /></td><td><label className="inline-check"><input type="checkbox" checked={line.updateSellingPrice} onChange={e => editLine(line.article.variantId, { updateSellingPrice: e.target.checked })} /> Apply</label></td><td><button className="ghost small-btn" type="button" onClick={() => setLines(current => current.filter(x => x.article.variantId !== line.article.variantId))}>Remove</button></td></tr>)}</tbody></table></div> : <p className="muted">Search above and add the items on this supplier delivery.</p>}
      <div className="receipt-summary"><span>{qty(lines.length)} variants · {qty(pieces)} pieces</span><strong>Purchase value at cost: {rupees(totalCost)}</strong></div>
      <div className="actions"><button type="button" className="primary" disabled={busy || !lines.length || !wholesalerId || !staffId} onClick={() => void save()}>{busy ? 'Saving receipt…' : 'Save stock receipt'}</button><button type="button" className="ghost" onClick={onBack}>Cancel</button></div>
    </section>
  </div>
}

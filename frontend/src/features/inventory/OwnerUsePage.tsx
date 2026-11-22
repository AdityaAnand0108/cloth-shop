import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import type { ArticleListItem, Lookups } from '../../api/types'
import { qty, rupees } from '../../money'

export function OwnerUsePage({ onBack }: { onBack: () => void }) {
  const [lookups, setLookups] = useState<Lookups | null>(null)
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<ArticleListItem[]>([])
  const [article, setArticle] = useState<ArticleListItem | null>(null)
  const [quantity, setQuantity] = useState('1')
  const [staffId, setStaffId] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { api.lookups().then(setLookups).catch((e: Error) => setError(e.message)) }, [])
  useEffect(() => {
    if (query.trim().length < 2) { setMatches([]); return }
    let cancelled = false
    const timer = setTimeout(() => api.listArticles({ q: query.trim() })
      .then(page => { if (!cancelled) setMatches(page.content) })
      .catch((e: Error) => { if (!cancelled) setError(e.message) }), 220)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query])

  const count = Number(quantity)
  const total = article ? article.lastBuyingPrice * (Number.isFinite(count) ? count : 0) : 0

  async function save() {
    if (!article || !staffId || !Number.isFinite(count) || count <= 0 || count > article.qtyOnHand) {
      setError('Choose an article and staff member, and enter a quantity available in stock.'); return
    }
    setBusy(true); setError(null); setSaved(null)
    try {
      const result = await api.recordOwnerUse(article.variantId, count, Number(staffId), note.trim() || undefined)
      setSaved(`${qty(count)} × ${article.articleCode} recorded at supplier cost ${rupees(result.unitCost)} each (${rupees(result.totalCost)} total). ${qty(result.qtyOnHand)} remain in stock.`)
      setArticle(null); setQuantity('1'); setNote(''); setQuery('')
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not record owner use.') }
    finally { setBusy(false) }
  }

  return <div className="page">
    <header className="page-head"><button type="button" className="link" onClick={onBack}>&larr; Dashboard</button><h1>Owner use</h1><p className="muted">Record items taken from shop stock for the owner. Each item is valued at its latest supplier buying price.</p></header>
    {error && <div className="banner err">{error}</div>}{saved && <div className="banner ok">{saved}</div>}
    <section className="card">
      <label className="field"><span>Find article</span><input value={query} onChange={e => { setQuery(e.target.value); setArticle(null) }} placeholder="Search by code, brand or article name" /></label>
      {matches.length > 0 && <div className="receipt-matches">{matches.slice(0, 8).map(item => <button key={item.variantId} type="button" onClick={() => { setArticle(item); setQuery(item.articleCode); setMatches([]); setError(null) }}><span><strong>{item.articleCode}</strong><small>{item.articleType} · {item.brand} · {item.colour} · {item.size}</small></span><span>{qty(item.qtyOnHand)} on hand</span><b>{rupees(item.lastBuyingPrice)} supplier cost</b></button>)}</div>}
      {article && <div className="grid owner-use-fields">
        <div className="field"><span>Selected article</span><strong>{article.articleCode} · {article.brand} · {article.colour} · {article.size}</strong><small>{qty(article.qtyOnHand)} available</small></div>
        <label className="field"><span>Quantity taken</span><input type="number" min="1" max={article.qtyOnHand} step="1" value={quantity} onChange={e => setQuantity(e.target.value)} /></label>
        <label className="field"><span>Taken by</span><select value={staffId} onChange={e => setStaffId(e.target.value)}><option value="">Choose staff…</option>{lookups?.staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="field"><span>Note <em className="hint">optional</em></span><input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional detail" /></label>
        <div className="field"><span>Supplier buying price</span><strong>{rupees(article.lastBuyingPrice)} each · {rupees(total)} total</strong></div>
      </div>}
      <div className="actions"><button type="button" className="primary" disabled={busy || !article || !staffId} onClick={() => void save()}>{busy ? 'Saving…' : 'Record owner use'}</button><button type="button" className="ghost" onClick={onBack}>Cancel</button></div>
    </section>
  </div>
}

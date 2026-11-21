import { FormEvent, useEffect, useState } from 'react'
import { api } from '../../api/client'
import type { ArticleEditGroup } from '../../api/types'
import { amount } from '../../money'

type Row = ArticleEditGroup['variants'][number]

export function EditArticlePage({ variantId, onBack }: { variantId: number; onBack: () => void }) {
  const [group, setGroup] = useState<ArticleEditGroup | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [adjusting, setAdjusting] = useState<number | null>(null)
  const [newQuantity, setNewQuantity] = useState('')
  const [reason, setReason] = useState('')

  async function load() {
    setLoading(true)
    try {
      const result = await api.articleEditGroup(variantId)
      setGroup(result); setRows(result.variants); setError(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load this article.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [variantId])

  function editRow(id: number, key: 'sellingPrice' | 'reorderLevel', value: string) {
    setRows(current => current.map(row => row.variantId === id ? { ...row, [key]: value === '' ? 0 : Number(value) } : row))
  }

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage(null); setError(null)
    try {
      await api.updateArticleEditGroup(variantId, rows.map(row => ({
        variantId: row.variantId, sellingPrice: Number(row.sellingPrice), reorderLevel: Number(row.reorderLevel),
      })))
      setMessage('Article prices and reorder alerts saved.')
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save changes.') }
    finally { setSaving(false) }
  }

  async function saveStock(event: FormEvent) {
    event.preventDefault()
    if (adjusting === null) return
    const qty = Number(newQuantity)
    if (!Number.isFinite(qty) || qty < 0 || !reason.trim()) {
      setError('Enter a valid stock count and a reason for the adjustment.'); return
    }
    setSaving(true); setError(null); setMessage(null)
    try {
      await api.adjustArticleStock(adjusting, qty, reason.trim())
      setMessage('Stock count adjusted and recorded in inventory history.')
      setAdjusting(null); setReason(''); await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not adjust stock.') }
    finally { setSaving(false) }
  }

  if (loading && !group) return <div className="page"><p className="muted">Loading article…</p></div>
  if (!group) return <div className="page"><button type="button" className="link" onClick={onBack}>← All articles</button>{error && <div className="banner err">{error}</div>}</div>

  return (
    <div className="page article-edit-page">
      <header className="page-head">
        <button type="button" className="link" onClick={onBack}>← All articles</button>
        <h1>Edit article</h1>
        <p className="muted">{group.displayName} · {group.brand} · {group.material} · {group.articleType}</p>
        <p className="muted small">Article type and material are shown for reference. Stock counts, prices, and reorder alerts are managed per colour and size.</p>
      </header>
      {error && <div className="banner err">{error}</div>}
      {message && <div className="banner ok">{message}</div>}
      <form className="card" onSubmit={save}>
        <div className="list-head"><h2 className="section-title">Sizes and colours</h2><span className="muted small">{rows.length} variants</span></div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Article code</th><th>Colour</th><th>Size</th><th className="r">Avg cost</th><th className="r">On hand</th><th>Selling price</th><th>Reorder alert</th><th></th></tr></thead>
            <tbody>{rows.map(row => <tr key={row.variantId} className={row.variantId === variantId ? 'selected-edit-row' : ''}>
              <td><code>{row.articleCode}</code>{row.variantId === variantId && <small className="block muted">Selected</small>}</td>
              <td><span className="swatch sm" style={{ background: row.colourHex ?? 'transparent' }} />{row.colour}</td>
              <td>{row.size}</td>
              <td className="r num">{amount(row.avgCost)}</td>
              <td className="r num">{row.qtyOnHand}</td>
              <td><input aria-label={`Selling price for ${row.articleCode}`} type="number" min="0" step="0.01" value={row.sellingPrice} onChange={event => editRow(row.variantId, 'sellingPrice', event.target.value)} /></td>
              <td><input aria-label={`Reorder alert for ${row.articleCode}`} type="number" min="0" step="1" value={row.reorderLevel} onChange={event => editRow(row.variantId, 'reorderLevel', event.target.value)} /></td>
              <td><button type="button" className="ghost small-btn" onClick={() => { setAdjusting(row.variantId); setNewQuantity(String(row.qtyOnHand)); setReason(''); setError(null) }}>Adjust stock</button></td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="actions"><button className="primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save article changes'}</button><button type="button" className="ghost" onClick={onBack}>Cancel</button></div>
      </form>
      {adjusting !== null && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setAdjusting(null) }}>
        <form className="modal" role="dialog" aria-modal="true" aria-labelledby="stock-adjust-title" onSubmit={saveStock}>
          <h2 id="stock-adjust-title">Adjust stock count</h2>
          <p className="modal-lead muted">{rows.find(row => row.variantId === adjusting)?.articleCode} · current count {rows.find(row => row.variantId === adjusting)?.qtyOnHand}</p>
          <label className="field"><span>Actual quantity on hand</span><input autoFocus type="number" min="0" step="0.001" value={newQuantity} onChange={event => setNewQuantity(event.target.value)} /></label>
          <label className="field"><span>Reason for adjustment</span><input required maxLength={255} value={reason} onChange={event => setReason(event.target.value)} placeholder="e.g. Stock count correction" /></label>
          <div className="actions"><button className="primary" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save stock count'}</button><button className="ghost" type="button" onClick={() => setAdjusting(null)}>Cancel</button></div>
        </form>
      </div>}
    </div>
  )
}

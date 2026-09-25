import { useEffect, useMemo, useRef, useState } from 'react'
import { api, HttpError } from '../../api/client'
import type {
  AddArticleResponse, ArticleListItem, ExistingArticle, Lookups, PreviewResponse,
} from '../../api/types'
import { CodePreview } from './CodePreview'
import { DuplicateDialog } from './DuplicateDialog'
import { ArticleTable } from './ArticleTable'

type Selection = {
  articleTypeId: string
  brandId: string
  materialId: string
  colourId: string
  sizeId: string
}

const EMPTY: Selection = {
  articleTypeId: '', brandId: '', materialId: '', colourId: '', sizeId: '',
}

const newIdempotencyKey = () =>
  (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`)

export function AddArticlePage() {
  const [lookups, setLookups] = useState<Lookups | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [sel, setSel] = useState<Selection>(EMPTY)
  const [buyingPrice, setBuyingPrice] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')
  const [sellingPriceLocked, setSellingPriceLocked] = useState(true)
  const [quantity, setQuantity] = useState('1')

  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [duplicate, setDuplicate] = useState<ExistingArticle | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [articles, setArticles] = useState<ArticleListItem[]>([])

  // One key per form session. Reused across retries so a double-tap is harmless;
  // reset only after a submission actually succeeds.
  const idempotencyKey = useRef(newIdempotencyKey())
  const firstFieldRef = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    api.lookups()
      .then(setLookups)
      .catch((e: Error) => setLoadError(e.message))
    refreshList()
  }, [])

  function refreshList() {
    api.listArticles().then(p => setArticles(p.content)).catch(() => { /* list is not critical */ })
  }

  // Sizes depend on the article type: a jean has no size M.
  const sizeGroupId = useMemo(() => {
    const type = lookups?.articleTypes.find(a => String(a.id) === sel.articleTypeId)
    return type?.sizeGroupId ?? null
  }, [lookups, sel.articleTypeId])

  const availableSizes = useMemo(
    () => lookups?.sizes.filter(s => s.sizeGroupId === sizeGroupId) ?? [],
    [lookups, sizeGroupId],
  )

  // Clear a size that no longer belongs to the chosen article type.
  useEffect(() => {
    if (sel.sizeId && !availableSizes.some(s => String(s.id) === sel.sizeId)) {
      setSel(s => ({ ...s, sizeId: '' }))
    }
  }, [availableSizes, sel.sizeId])

  // Selling price follows buying price until the user takes it over.
  useEffect(() => {
    if (!sellingPriceLocked || !lookups) return
    const buy = Number(buyingPrice)
    setSellingPrice(buyingPrice === '' || Number.isNaN(buy)
      ? ''
      : (buy * lookups.defaultMarkup).toFixed(2))
  }, [buyingPrice, sellingPriceLocked, lookups])

  const codeFragments = useMemo(() => {
    const pick = (list: Lookups[keyof Lookups] | undefined, id: string) =>
      Array.isArray(list) ? list.find(i => String(i.id) === id)?.code ?? null : null
    return [
      pick(lookups?.articleTypes, sel.articleTypeId),
      pick(lookups?.brands, sel.brandId),
      pick(lookups?.materials, sel.materialId),
      pick(lookups?.colours, sel.colourId),
      pick(lookups?.sizes, sel.sizeId),
    ]
  }, [lookups, sel])

  const allSelected = codeFragments.every(Boolean)

  // Only the existence check needs the server; the code itself assembles locally.
  useEffect(() => {
    if (!allSelected) { setPreview(null); return }
    let cancelled = false
    const timer = setTimeout(() => {
      api.previewCode({
        articleTypeId: Number(sel.articleTypeId),
        brandId: Number(sel.brandId),
        materialId: Number(sel.materialId),
        colourId: Number(sel.colourId),
        sizeId: Number(sel.sizeId),
      })
        .then(p => { if (!cancelled) setPreview(p) })
        .catch(() => { if (!cancelled) setPreview(null) })
    }, 150)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [allSelected, sel])

  const margin = useMemo(() => {
    const buy = Number(buyingPrice), sell = Number(sellingPrice)
    if (!buy || !sell || Number.isNaN(buy) || Number.isNaN(sell)) return null
    return (((sell - buy) / sell) * 100).toFixed(1)
  }, [buyingPrice, sellingPrice])

  /**
   * @param sellingPriceOverride a new shelf price chosen in the duplicate dialog,
   *   or null to leave the existing one alone. Ignored when creating.
   */
  async function submit(mode: 'CREATE' | 'ADD_STOCK', sellingPriceOverride: number | null = null) {
    setSubmitting(true)
    setBanner(null)
    try {
      const res: AddArticleResponse = await api.addArticle({
        articleTypeId: Number(sel.articleTypeId),
        brandId: Number(sel.brandId),
        materialId: Number(sel.materialId),
        colourId: Number(sel.colourId),
        sizeId: Number(sel.sizeId),
        buyingPrice: Number(buyingPrice),
        sellingPrice: sellingPriceOverride ?? Number(sellingPrice),
        quantity: Number(quantity),
        mode,
        updateSellingPrice: sellingPriceOverride !== null,
      }, idempotencyKey.current)

      setBanner({
        kind: 'ok',
        text: res.outcome === 'CREATED'
          ? `Created ${res.articleCode} — ${res.displayName}. ${res.qtyOnHand} in stock.`
          : `Added to ${res.articleCode}. Now ${res.qtyOnHand} in stock at average cost ₹${res.avgCost.toFixed(2)}${res.sellingPriceChanged ? `, selling price now ₹${res.sellingPrice.toFixed(2)}` : ''}.`,
      })

      setDuplicate(null)
      resetForm()
      refreshList()
    } catch (e) {
      if (e instanceof HttpError && e.body.code === 'ARTICLE_EXISTS') {
        setDuplicate(e.body.details.existing as ExistingArticle)
      } else {
        setBanner({ kind: 'err', text: e instanceof Error ? e.message : 'Something went wrong' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  function resetForm() {
    setSel(EMPTY)
    setBuyingPrice('')
    setSellingPrice('')
    setSellingPriceLocked(true)
    setQuantity('1')
    setPreview(null)
    idempotencyKey.current = newIdempotencyKey()
    firstFieldRef.current?.focus()
  }

  async function addBrand() {
    const name = window.prompt('New brand name')
    if (!name?.trim()) return
    try {
      const brand = await api.createBrand(name.trim())
      setLookups(l => l && { ...l, brands: [...l.brands, brand].sort((a, b) => a.name.localeCompare(b.name)) })
      setSel(s => ({ ...s, brandId: String(brand.id) }))
      setBanner({ kind: 'ok', text: `Added ${brand.name} with code ${brand.code}.` })
    } catch (e) {
      // A taken 2-letter code comes back here with suggestions in details.
      setBanner({ kind: 'err', text: e instanceof Error ? e.message : 'Could not add brand' })
    }
  }

  const canSubmit = allSelected && Number(buyingPrice) >= 0 && buyingPrice !== ''
    && Number(quantity) > 0 && !submitting

  if (loadError) {
    return (
      <div className="page">
        <div className="banner err">
          Could not reach the server: {loadError}
          <br />Is the backend running on port 8080?
        </div>
      </div>
    )
  }

  if (!lookups) return <div className="page"><p className="muted">Loading…</p></div>

  return (
    <div className="page">
      <header className="page-head">
        <h1>Add article to inventory</h1>
        <p className="muted">
          Pick the five attributes and the article code builds itself. If the code already
          exists you will be asked to add stock instead of creating a duplicate.
        </p>
      </header>

      {banner && <div className={`banner ${banner.kind}`}>{banner.text}</div>}

      <form className="card" onSubmit={e => { e.preventDefault(); submit(preview?.exists ? 'ADD_STOCK' : 'CREATE') }}>
        <div className="grid">
          <label className="field">
            <span>Type of article</span>
            <select
              ref={firstFieldRef}
              value={sel.articleTypeId}
              onChange={e => setSel(s => ({ ...s, articleTypeId: e.target.value }))}
              required
            >
              <option value="">Select…</option>
              {lookups.articleTypes.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.code})</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Material type</span>
            <select
              value={sel.materialId}
              onChange={e => setSel(s => ({ ...s, materialId: e.target.value }))}
              required
            >
              <option value="">Select…</option>
              {lookups.materials.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.code})</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>
              Brand of article
              <button type="button" className="link" onClick={addBrand}>+ new</button>
            </span>
            <select
              value={sel.brandId}
              onChange={e => setSel(s => ({ ...s, brandId: e.target.value }))}
              required
            >
              <option value="">Select…</option>
              {lookups.brands.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Colour</span>
            <div className="with-swatch">
              <span
                className="swatch"
                style={{
                  background: lookups.colours.find(c => String(c.id) === sel.colourId)?.hex ?? 'transparent',
                }}
                aria-hidden="true"
              />
              <select
                value={sel.colourId}
                onChange={e => setSel(s => ({ ...s, colourId: e.target.value }))}
                required
              >
                <option value="">Select…</option>
                {lookups.colours.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>
          </label>

          <label className="field">
            <span>Size</span>
            <select
              value={sel.sizeId}
              onChange={e => setSel(s => ({ ...s, sizeId: e.target.value }))}
              disabled={!sel.articleTypeId}
              required
            >
              <option value="">
                {sel.articleTypeId ? 'Select…' : 'Pick an article type first'}
              </option>
              {availableSizes.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Quantity</span>
            <input
              type="number" min="1" step="1" inputMode="numeric"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              required
            />
          </label>
        </div>

        <div className="grid prices">
          <label className="field">
            <span>Buying price</span>
            <input
              type="number" min="0" step="0.01" inputMode="decimal"
              value={buyingPrice}
              onChange={e => setBuyingPrice(e.target.value)}
              placeholder="0.00"
              required
            />
          </label>

          <label className="field">
            <span>
              Selling price
              {sellingPriceLocked && (
                <em className="hint"> auto &times;{lookups.defaultMarkup}</em>
              )}
            </span>
            <div className="with-button">
              <input
                type="number" min="0" step="0.01" inputMode="decimal"
                value={sellingPrice}
                onChange={e => setSellingPrice(e.target.value)}
                readOnly={sellingPriceLocked}
                className={sellingPriceLocked ? 'readonly' : ''}
                required
              />
              <button
                type="button"
                className="ghost"
                onClick={() => setSellingPriceLocked(v => !v)}
              >
                {sellingPriceLocked ? 'Edit' : 'Auto'}
              </button>
            </div>
          </label>

          <div className="field">
            <span>Margin</span>
            <output className="margin">{margin ? `${margin}%` : '—'}</output>
          </div>
        </div>

        <CodePreview fragments={codeFragments} preview={preview} />

        <div className="actions">
          <button type="submit" className="primary" disabled={!canSubmit}>
            {submitting ? 'Saving…' : preview?.exists ? 'Add stock to this article' : 'Add this inventory'}
          </button>
          <button type="button" className="ghost" onClick={resetForm} disabled={submitting}>
            Clear
          </button>
        </div>
      </form>

      <ArticleTable items={articles} />

      {duplicate && (
        <DuplicateDialog
          existing={duplicate}
          incomingBuyingPrice={Number(buyingPrice)}
          markup={lookups.defaultMarkup}
          quantity={Number(quantity)}
          busy={submitting}
          onCancel={() => setDuplicate(null)}
          onConfirm={newPrice => submit('ADD_STOCK', newPrice)}
        />
      )}
    </div>
  )
}

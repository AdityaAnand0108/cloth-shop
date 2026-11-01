import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { api, HttpError } from '../../api/client'
import type {
  AddArticleBatchResponse, Lookups, PreviewResponse,
} from '../../api/types'
import { BatchDuplicateDialog, type DuplicateSize } from './BatchDuplicateDialog'
import { NewBrandDialog } from './NewBrandDialog'
import { NewWholesalerDialog } from './NewWholesalerDialog'

type Selection = {
  articleTypeId: string
  brandId: string
  materialId: string
  colourId: string
}

const EMPTY: Selection = {
  articleTypeId: '', brandId: '', materialId: '', colourId: '',
}

const newIdempotencyKey = () =>
  (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`)

export function AddArticlePage({ onBack }: { onBack: () => void }) {
  const [lookups, setLookups] = useState<Lookups | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [sel, setSel] = useState<Selection>(EMPTY)
  const [buyingPrice, setBuyingPrice] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')
  const [sellingPriceLocked, setSellingPriceLocked] = useState(true)
  const [quantities, setQuantities] = useState<Record<number, string>>({})
  const [wholesalerId, setWholesalerId] = useState('')
  // Whoever is at the counter usually enters a run of articles, so this is
  // deliberately not cleared between saves.
  const [staffId, setStaffId] = useState('')

  const [showNewBrand, setShowNewBrand] = useState(false)
  const [showNewWholesaler, setShowNewWholesaler] = useState(false)

  const [previews, setPreviews] = useState<Record<number, PreviewResponse>>({})
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewVersion, setPreviewVersion] = useState(0)
  const [duplicates, setDuplicates] = useState<DuplicateSize[] | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  // One key per form session. Reused across retries so a double-tap is harmless;
  // reset only after a submission actually succeeds.
  const idempotencyKey = useRef(newIdempotencyKey())
  const firstFieldRef = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    api.lookups()
      .then(setLookups)
      .catch((e: Error) => setLoadError(e.message))
  }, [])

  // Sizes depend on the article type: a jean has no size M.
  const sizeGroupId = useMemo(() => {
    const type = lookups?.articleTypes.find(a => String(a.id) === sel.articleTypeId)
    return type?.sizeGroupId ?? null
  }, [lookups, sel.articleTypeId])

  const availableSizes = useMemo(
    () => lookups?.sizes.filter(s => s.sizeGroupId === sizeGroupId) ?? [],
    [lookups, sizeGroupId],
  )

  // Clear quantities for sizes that do not belong to the newly selected article type.
  useEffect(() => {
    const validIds = new Set(availableSizes.map(size => size.id))
    setQuantities(current => Object.fromEntries(
      Object.entries(current).filter(([id]) => validIds.has(Number(id))),
    ))
  }, [availableSizes])

  // Selling price follows buying price until the user takes it over.
  useEffect(() => {
    if (!sellingPriceLocked || !lookups) return
    const buy = Number(buyingPrice)
    setSellingPrice(buyingPrice === '' || Number.isNaN(buy)
      ? ''
      : (buy * lookups.defaultMarkup).toFixed(2))
  }, [buyingPrice, sellingPriceLocked, lookups])

  const selectedSizes = useMemo(() => availableSizes
    .map(size => ({ sizeId: size.id, sizeName: size.name, sizeCode: size.code, quantity: quantities[size.id] ?? '' }))
    .filter(size => Number(size.quantity) > 0), [availableSizes, quantities])
  const selectedSizeKey = selectedSizes.map(size => size.sizeId).join(',')
  const attributesSelected = Boolean(sel.articleTypeId && sel.brandId && sel.materialId && sel.colourId)
  const articleCodeParts = lookups ? [
    lookups.articleTypes.find(a => String(a.id) === sel.articleTypeId)?.code,
    lookups.brands.find(b => String(b.id) === sel.brandId)?.code,
    lookups.materials.find(m => String(m.id) === sel.materialId)?.code,
    lookups.colours.find(c => String(c.id) === sel.colourId)?.code,
  ] : []
  const articleCodePrefix = articleCodeParts.every(Boolean) ? articleCodeParts.join('') : ''

  const selectedWholesaler = lookups?.wholesalers.find(w => String(w.id) === wholesalerId) ?? null

  // Check each size with stock entered so existing variants can be reviewed together.
  useEffect(() => {
    if (!attributesSelected || selectedSizes.length === 0) {
      setPreviews({})
      setPreviewLoading(false)
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    setPreviews({})
    const timer = setTimeout(() => {
      Promise.all(selectedSizes.map(size => api.previewCode({
        articleTypeId: Number(sel.articleTypeId),
        brandId: Number(sel.brandId),
        materialId: Number(sel.materialId),
        colourId: Number(sel.colourId),
        sizeId: size.sizeId,
      }).then(preview => [size.sizeId, preview] as const)))
        .then(rows => {
          if (!cancelled) setPreviews(Object.fromEntries(rows))
        })
        .catch(() => {
          if (!cancelled) setPreviews({})
        })
        .finally(() => { if (!cancelled) setPreviewLoading(false) })
    }, 150)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [attributesSelected, selectedSizeKey, previewVersion, sel.articleTypeId, sel.brandId, sel.materialId, sel.colourId])

  const margin = useMemo(() => {
    const buy = Number(buyingPrice), sell = Number(sellingPrice)
    if (!buy || !sell || Number.isNaN(buy) || Number.isNaN(sell)) return null
    return (((sell - buy) / sell) * 100).toFixed(1)
  }, [buyingPrice, sellingPrice])

  /**
   * Existing variants are reviewed together before their stock is added.
   */
  function handleFormSubmit(e: FormEvent) {
    e.preventDefault()
    if (previewLoading || selectedSizes.length === 0) return
    if (selectedSizes.some(size => !previews[size.sizeId])) {
      setBanner({ kind: 'err', text: 'Could not check the selected sizes. Please try again.' })
      setPreviewVersion(version => version + 1)
      return
    }
    const existingSizes = selectedSizes.flatMap(size => {
      const existing = previews[size.sizeId]?.existing
      return existing ? [{ existing, quantity: Number(size.quantity) }] : []
    })
    if (existingSizes.length > 0) {
      setDuplicates(existingSizes)
    } else {
      void submit(false)
    }
  }

  /**
   * @param updateExistingSellingPrice whether to apply the form's price to existing sizes.
   */
  async function submit(updateExistingSellingPrice: boolean) {
    setSubmitting(true)
    setBanner(null)
    try {
      const res: AddArticleBatchResponse = await api.addArticleBatch({
        articleTypeId: Number(sel.articleTypeId),
        brandId: Number(sel.brandId),
        materialId: Number(sel.materialId),
        colourId: Number(sel.colourId),
        buyingPrice: Number(buyingPrice),
        sellingPrice: Number(sellingPrice),
        wholesalerId: Number(wholesalerId),
        staffId: Number(staffId),
        sizes: selectedSizes.map(size => ({
          sizeId: size.sizeId,
          quantity: Number(size.quantity),
          mode: previews[size.sizeId]?.exists ? 'ADD_STOCK' : 'CREATE',
          updateSellingPrice: Boolean(previews[size.sizeId]?.exists && updateExistingSellingPrice),
        })),
      }, idempotencyKey.current)

      setBanner({
        kind: 'ok',
        text: `Saved ${res.items.length} sizes: ${res.items.map((item, index) =>
          `${selectedSizes[index]?.sizeName ?? item.articleCode} +${selectedSizes[index]?.quantity ?? ''} (total ${item.qtyOnHand})`,
        ).join(', ')}.`,
      })

      setDuplicates(null)
      resetForm()
    } catch (e) {
      if (e instanceof HttpError && ['ARTICLE_EXISTS', 'ARTICLE_MISSING'].includes(e.body.code)) {
        setDuplicates(null)
        setBanner({ kind: 'err', text: 'A selected size changed while you were entering stock. Review the sizes and submit again.' })
        setPreviewVersion(version => version + 1)
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
    setQuantities({})
    setWholesalerId('')
    setPreviews({})
    setDuplicates(null)
    idempotencyKey.current = newIdempotencyKey()
    firstFieldRef.current?.focus()
  }

  const canSubmit = attributesSelected && selectedSizes.length > 0
    && selectedSizes.every(size => Boolean(previews[size.sizeId]))
    && Number(buyingPrice) >= 0 && buyingPrice !== ''
    && Number(sellingPrice) >= 0 && sellingPrice !== ''
    && wholesalerId !== '' && staffId !== '' && !previewLoading && !submitting

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
        <button type="button" className="link" onClick={onBack}>&larr; Dashboard</button>
        <h1>Add article to inventory</h1>
        <p className="muted">
          Pick the article details, then enter stock for every size in one go. Existing
          sizes are added to stock; new sizes are created together.
        </p>
      </header>

      {banner && <div className={`banner ${banner.kind}`}>{banner.text}</div>}

      <form className="card" onSubmit={handleFormSubmit}>
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
              <button type="button" className="link" onClick={() => setShowNewBrand(true)}>+ new</button>
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

        </div>

        <section className="batch-sizes" aria-labelledby="batch-sizes-title">
          <div className="batch-sizes-heading">
            <div>
              <h2 id="batch-sizes-title">Sizes and quantities</h2>
              <p className="muted">Enter a quantity for each size in this purchase. Leave the rest blank.</p>
            </div>
            {selectedSizes.length > 0 && <span className="tag ok">{selectedSizes.length} selected</span>}
          </div>
          {availableSizes.length === 0 ? (
            <p className="muted">Choose an article type to see its sizes.</p>
          ) : (
            <div className="table-scroll">
              <table className="batch-size-table">
                <thead><tr><th>Size</th><th>Article code</th><th>Quantity to add</th><th>Inventory status</th></tr></thead>
                <tbody>
                  {availableSizes.map(size => {
                    const quantity = quantities[size.id] ?? ''
                    const preview = previews[size.id]
                    const status = !quantity || Number(quantity) <= 0
                      ? 'Not selected'
                      : previewLoading ? 'Checking…'
                        : preview?.exists ? `Already in stock · ${preview.existing?.qtyOnHand ?? 0}`
                          : preview ? 'New size' : 'Waiting to check'
                    return (
                      <tr key={size.id}>
                        <th scope="row">{size.name}</th>
                        <td><code>{articleCodePrefix ? `${articleCodePrefix}${size.code}` : '—'}</code></td>
                        <td>
                          <input
                            aria-label={`Quantity for size ${size.name}`}
                            type="number" min="1" step="1" inputMode="numeric"
                            placeholder="0"
                            value={quantity}
                            onChange={e => setQuantities(current => ({ ...current, [size.id]: e.target.value }))}
                            disabled={!attributesSelected || submitting}
                          />
                        </td>
                        <td className={preview?.exists ? 'warn' : 'muted'}>{status}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="grid">
          <label className="field">
            <span>
              Bought from
              <button type="button" className="link" onClick={() => setShowNewWholesaler(true)}>
                + new
              </button>
            </span>
            <select
              value={wholesalerId}
              onChange={e => setWholesalerId(e.target.value)}
              required
            >
              <option value="">Select…</option>
              {lookups.wholesalers.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Added by</span>
            <select
              value={staffId}
              onChange={e => setStaffId(e.target.value)}
              required
            >
              <option value="">Select…</option>
              {lookups.staff.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>

          {selectedWholesaler && (
            <div className="field">
              <span>Supplier contact</span>
              <p className="supplier-contact">
                {selectedWholesaler.phone}
                <em>{selectedWholesaler.address}</em>
              </p>
            </div>
          )}
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

        <div className="actions">
          <button type="submit" className="primary" disabled={!canSubmit}>
            {submitting ? 'Saving…' : previewLoading ? 'Checking sizes…' : `Save ${selectedSizes.length} selected sizes`}
          </button>
          <button type="button" className="ghost" onClick={resetForm} disabled={submitting}>
            Clear
          </button>
        </div>
      </form>

      {showNewBrand && (
        <NewBrandDialog
          onCancel={() => setShowNewBrand(false)}
          onCreated={brand => {
            setLookups(l => l && {
              ...l,
              brands: [...l.brands, brand].sort((a, b) => a.name.localeCompare(b.name)),
            })
            setSel(s => ({ ...s, brandId: String(brand.id) }))
            setShowNewBrand(false)
            setBanner({ kind: 'ok', text: `Added ${brand.name} with code ${brand.code}.` })
          }}
        />
      )}

      {showNewWholesaler && (
        <NewWholesalerDialog
          onCancel={() => setShowNewWholesaler(false)}
          onCreated={wholesaler => {
            setLookups(l => l && {
              ...l,
              wholesalers: [...l.wholesalers, wholesaler].sort((a, b) => a.name.localeCompare(b.name)),
            })
            setWholesalerId(String(wholesaler.id))
            setShowNewWholesaler(false)
            setBanner({ kind: 'ok', text: `Added ${wholesaler.name}.` })
          }}
        />
      )}

      {duplicates && (
        <BatchDuplicateDialog
          sizes={duplicates}
          sellingPrice={Number(sellingPrice)}
          busy={submitting}
          onCancel={() => setDuplicates(null)}
          onConfirm={updateExistingSellingPrice => void submit(updateExistingSellingPrice)}
        />
      )}
    </div>
  )
}

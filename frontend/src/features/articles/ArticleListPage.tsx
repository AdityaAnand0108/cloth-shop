import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import type { ArticleFilters, ArticleListItem, Lookups } from '../../api/types'
import { ArticleTable } from './ArticleTable'

export const NO_FILTERS: ArticleFilters = {
  q: '', articleTypeId: '', brandId: '', materialId: '', colourId: '', sizeId: '',
}

/**
 * Filters live in the parent so that opening an article and coming back does not
 * throw away the search that found it.
 */
export function ArticleListPage({ onBack, onSelect, filters, setFilters }: {
  onBack: () => void
  onSelect: (variantId: number) => void
  filters: ArticleFilters
  setFilters: React.Dispatch<React.SetStateAction<ArticleFilters>>
}) {
  const [lookups, setLookups] = useState<Lookups | null>(null)
  const [items, setItems] = useState<ArticleListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.lookups().then(setLookups).catch((e: Error) => setError(e.message))
  }, [])

  // Sizes belong to an article type, so narrow them once a type is picked. With no
  // type chosen every size is fair game.
  const availableSizes = useMemo(() => {
    if (!lookups) return []
    const type = lookups.articleTypes.find(a => String(a.id) === filters.articleTypeId)
    return type ? lookups.sizes.filter(s => s.sizeGroupId === type.sizeGroupId) : lookups.sizes
  }, [lookups, filters.articleTypeId])

  // A size left over from the previous article type would match nothing. Drop it.
  useEffect(() => {
    if (filters.sizeId && !availableSizes.some(s => String(s.id) === filters.sizeId)) {
      setFilters(f => ({ ...f, sizeId: '' }))
    }
  }, [availableSizes, filters.sizeId])

  // One debounced, cancellable request per settled set of filters, so typing in the
  // search box cannot leave a slower earlier response to land last.
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setLoading(true)
      api.listArticles(filters, controller.signal)
        .then(page => {
          setItems(page.content)
          setTotal(page.totalElements)
          setError(null)
        })
        .catch((e: Error) => { if (e.name !== 'AbortError') setError(e.message) })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 250)

    return () => { controller.abort(); clearTimeout(timer) }
  }, [filters])

  const set = (patch: Partial<ArticleFilters>) => setFilters(f => ({ ...f, ...patch }))
  const anyFilter = Object.values(filters).some(Boolean)

  return (
    <div className="page">
      <header className="page-head">
        <button type="button" className="link" onClick={onBack}>&larr; Dashboard</button>
        <h1>All articles</h1>
        <p className="muted">
          Search by code or name, or narrow the list with the same five attributes the
          code is built from.
        </p>
      </header>

      {error && <div className="banner err">Could not load articles: {error}</div>}

      <div className="card">
        <label className="field">
          <span>Search</span>
          <input
            type="text"
            value={filters.q}
            onChange={e => set({ q: e.target.value })}
            placeholder="Article code or name — e.g. TSLE or Levis"
          />
        </label>

        <div className="grid">
          <label className="field">
            <span>Type of article</span>
            <select
              value={filters.articleTypeId}
              onChange={e => set({ articleTypeId: e.target.value })}
            >
              <option value="">All</option>
              {lookups?.articleTypes.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.code})</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Material type</span>
            <select
              value={filters.materialId}
              onChange={e => set({ materialId: e.target.value })}
            >
              <option value="">All</option>
              {lookups?.materials.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.code})</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Brand of article</span>
            <select
              value={filters.brandId}
              onChange={e => set({ brandId: e.target.value })}
            >
              <option value="">All</option>
              {lookups?.brands.map(b => (
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
                  background: lookups?.colours.find(c => String(c.id) === filters.colourId)?.hex
                    ?? 'transparent',
                }}
                aria-hidden="true"
              />
              <select
                value={filters.colourId}
                onChange={e => set({ colourId: e.target.value })}
              >
                <option value="">All</option>
                {lookups?.colours.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>
          </label>

          <label className="field">
            <span>Size</span>
            <select
              value={filters.sizeId}
              onChange={e => set({ sizeId: e.target.value })}
            >
              <option value="">All</option>
              {availableSizes.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <section className="card">
        <div className="list-head">
          <h2 className="section-title">
            Articles {!loading && <span className="count">{total}</span>}
          </h2>
          {anyFilter && (
            <button type="button" className="ghost" onClick={() => setFilters(NO_FILTERS)}>
              Clear filters
            </button>
          )}
        </div>

        {loading && items.length === 0
          ? <p className="muted">Loading…</p>
          : items.length === 0
            ? (
              <p className="muted">
                {anyFilter
                  ? 'No articles match these filters.'
                  : 'Nothing added yet. The first article you add will appear here.'}
              </p>
            )
            : <ArticleTable items={items} onSelect={onSelect} />}
      </section>
    </div>
  )
}

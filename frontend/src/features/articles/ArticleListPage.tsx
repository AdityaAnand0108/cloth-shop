import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import type { ArticleFilters, ArticleListItem, ArticleSearchSummary, Lookups } from '../../api/types'
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
  const [summary, setSummary] = useState<ArticleSearchSummary | null>(null)
  const [page, setPage] = useState(0)
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
      Promise.all([
        api.listArticles(filters, controller.signal, page),
        api.articleSearchSummary(filters, controller.signal),
      ])
        .then(([result, searchSummary]) => {
          setItems(result.content)
          setTotal(result.totalElements)
          setSummary(searchSummary)
          setError(null)
        })
        .catch((e: Error) => { if (e.name !== 'AbortError') setError(e.message) })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 250)

    return () => { controller.abort(); clearTimeout(timer) }
  }, [filters, page])

  const set = (patch: Partial<ArticleFilters>) => {
    setPage(0)
    setFilters(f => ({ ...f, ...patch }))
  }
  const anyFilter = Object.values(filters).some(Boolean)
  const pageSize = 200
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const firstVisible = total === 0 ? 0 : page * pageSize + 1
  const lastVisible = Math.min((page + 1) * pageSize, total)

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

      <section className="card search-summary" aria-label="Search summary">
        <div className="list-head">
          <div>
            <h2 className="section-title">Search summary</h2>
            <p className="muted small">Across all matches, including results on other pages.</p>
          </div>
          {loading && <span className="searching-indicator" role="status">Updating…</span>}
        </div>
        <div className="search-summary-metrics">
          <SummaryMetric label="Matching variants" value={summary?.matchingVariants ?? '—'} />
          <SummaryMetric label="Variants in stock" value={summary?.inStockVariants ?? '—'} />
          <SummaryMetric label="Units on hand" value={summary?.unitsOnHand ?? '—'} />
          <div className="search-summary-detail">
            <span className="stat-label">Sizes</span>
            <div className="summary-chips">
              {summary?.sizes.length
                ? summary.sizes.map(size => <span className="chip" key={size}>{size}</span>)
                : <span className="muted">—</span>}
            </div>
          </div>
          <div className="search-summary-detail">
            <span className="stat-label">Colours</span>
            <div className="summary-chips">
              {summary?.colours.length
                ? summary.colours.map(colour => (
                  <span className="chip" key={colour.id}>
                    <span className="swatch sm" style={{ background: colour.hex ?? 'transparent' }} />
                    {colour.name}
                  </span>
                ))
                : <span className="muted">—</span>}
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="list-head">
          <h2 className="section-title">
            Articles <span className="count">{total}</span>
          </h2>
          {anyFilter && (
            <button type="button" className="ghost" onClick={() => { setPage(0); setFilters(NO_FILTERS) }}>
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
        {total > pageSize && (
          <div className="article-pagination">
            <span className="muted small">Showing {firstVisible}–{lastVisible} of {total}</span>
            <div className="row-actions">
              <button type="button" className="ghost small-btn" disabled={page === 0 || loading} onClick={() => setPage(p => Math.max(0, p - 1))}>Previous</button>
              <span className="small">Page {page + 1} of {pageCount}</span>
              <button type="button" className="ghost small-btn" disabled={page + 1 >= pageCount || loading} onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}>Next</button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function SummaryMetric({ label, value }: { label: string; value: number | string }) {
  return <div className="search-summary-metric"><span className="stat-label">{label}</span><strong>{typeof value === 'number' ? value.toLocaleString('en-IN') : value}</strong></div>
}

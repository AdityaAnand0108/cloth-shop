import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, HttpError } from '../../api/client'
import type { LookupItem } from '../../api/types'

/**
 * Replaces a window.prompt. The 2-letter code matters here — it becomes part of every
 * article code for this brand and is frozen once a tag is printed — so it is shown and
 * editable rather than decided silently. Left blank, the server suggests one.
 */
export function NewBrandDialog({ onCancel, onCreated }: {
  onCancel: () => void
  onCreated: (brand: LookupItem) => void
}) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const firstField = useRef<HTMLInputElement>(null)

  useEffect(() => { firstField.current?.focus() }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSuggestions([])
    try {
      onCreated(await api.createBrand(name.trim(), code.trim() || undefined))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the brand')
      // A taken code comes back with alternatives that are known to be free.
      if (err instanceof HttpError && Array.isArray(err.body.details?.suggestions)) {
        setSuggestions(err.body.details.suggestions as string[])
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Backdrop onCancel={onCancel} labelledBy="new-brand-title">
      <form className="modal" onSubmit={submit}>
        <h2 id="new-brand-title">Add a brand</h2>
        <p className="modal-lead muted">
          The code is the two letters this brand contributes to every article code.
        </p>

        {error && <div className="banner err">{error}</div>}

        <label className="field">
          <span>Brand name</span>
          <input
            ref={firstField}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Peter England"
            required
            minLength={2}
          />
        </label>

        <label className="field">
          <span>Code <em className="hint">optional — suggested if left blank</em></span>
          <input
            type="text"
            className="code-input"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))}
            placeholder="PE"
            maxLength={2}
          />
        </label>

        {suggestions.length > 0 && (
          <div className="suggestions">
            <span className="muted small">Free codes:</span>
            {suggestions.map(s => (
              <button type="button" key={s} className="ghost small-btn" onClick={() => setCode(s)}>
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="actions">
          <button type="submit" className="primary" disabled={busy || name.trim().length < 2}>
            {busy ? 'Saving…' : 'Add brand'}
          </button>
          <button type="button" className="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        </div>
      </form>
    </Backdrop>
  )
}

/** Escape closes, and a click on the backdrop itself does too. */
export function Backdrop({ onCancel, labelledBy, children }: {
  onCancel: () => void
  labelledBy: string
  children: React.ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onMouseDown={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      {children}
    </div>
  )
}

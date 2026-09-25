import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api } from '../../api/client'
import type { WholesalerItem } from '../../api/types'
import { Backdrop } from './NewBrandDialog'

/**
 * All three fields are required: the point of recording a supplier is being able to
 * ring them back about a bad lot, and a name on its own does not let you do that.
 */
export function NewWholesalerDialog({ onCancel, onCreated }: {
  onCancel: () => void
  onCreated: (wholesaler: WholesalerItem) => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const firstField = useRef<HTMLInputElement>(null)

  useEffect(() => { firstField.current?.focus() }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onCreated(await api.createWholesaler({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the wholesaler')
    } finally {
      setBusy(false)
    }
  }

  const complete = name.trim().length >= 2 && phone.trim() !== '' && address.trim() !== ''

  return (
    <Backdrop onCancel={onCancel} labelledBy="new-wholesaler-title">
      <form className="modal" onSubmit={submit}>
        <h2 id="new-wholesaler-title">Add a wholesaler</h2>
        <p className="modal-lead muted">
          Recorded against every lot you buy from them, so the history can always say
          where a piece came from.
        </p>

        {error && <div className="banner err">{error}</div>}

        <label className="field">
          <span>Wholesaler name</span>
          <input
            ref={firstField}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Sharma Textiles"
            required
            minLength={2}
          />
        </label>

        <label className="field">
          <span>Contact number</span>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="e.g. 98765 43210"
            required
          />
        </label>

        <label className="field">
          <span>Address</span>
          <textarea
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="Shop, street, city"
            rows={3}
            required
          />
        </label>

        <div className="actions">
          <button type="submit" className="primary" disabled={busy || !complete}>
            {busy ? 'Saving…' : 'Add wholesaler'}
          </button>
          <button type="button" className="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        </div>
      </form>
    </Backdrop>
  )
}

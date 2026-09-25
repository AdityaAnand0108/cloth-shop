import type { PreviewResponse } from '../../api/types'

const LABELS = ['Article', 'Brand', 'Material', 'Colour', 'Size']

/**
 * The code assembling as each dropdown is picked. Makes the scheme tangible for
 * staff, and catches a wrong dropdown before anything is saved.
 */
export function CodePreview({
  fragments,
  preview,
}: {
  fragments: (string | null)[]
  preview: PreviewResponse | null
}) {
  const complete = fragments.every(Boolean)

  return (
    <div className={`code-preview ${preview?.exists ? 'exists' : ''}`}>
      <div className="code-strip" aria-label="Article code being built">
        {fragments.map((f, i) => (
          <span key={LABELS[i]} className={`frag ${f ? 'set' : ''}`}>
            <em>{LABELS[i]}</em>
            <b>{f ?? (i === 4 ? '–' : '––')}</b>
          </span>
        ))}
      </div>

      <div className="code-result">
        {complete ? (
          <>
            <code>{fragments.join('')}</code>
            {preview?.exists && preview.existing ? (
              <span className="tag warn">
                Already in stock — {preview.existing.qtyOnHand} pcs
              </span>
            ) : preview ? (
              <span className="tag ok">New article</span>
            ) : (
              <span className="tag muted-tag">Checking…</span>
            )}
          </>
        ) : (
          <span className="muted">Pick all five to see the code</span>
        )}
      </div>
    </div>
  )
}

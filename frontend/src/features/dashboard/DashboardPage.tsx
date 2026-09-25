type Props = {
  onAdd: () => void
  onViewArticles: () => void
}

export function DashboardPage({ onAdd, onViewArticles }: Props) {
  return (
    <div className="page">
      <header className="page-head">
        <h1>BFlex</h1>
        <p className="muted">Dashboard</p>
      </header>

      <div className="card">
        <div className="actions">
          <button type="button" className="primary" onClick={onAdd}>
            + Add
          </button>
          <button type="button" onClick={onViewArticles}>
            View all articles
          </button>
        </div>
      </div>
    </div>
  )
}

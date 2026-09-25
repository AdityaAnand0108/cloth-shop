export function DashboardPage({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="page">
      <header className="page-head">
        <h1>BFlex</h1>
        <p className="muted">Dashboard</p>
      </header>

      <div className="card">
        <button type="button" className="primary" onClick={onAdd}>
          + Add
        </button>
      </div>
    </div>
  )
}

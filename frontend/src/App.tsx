import { useState } from 'react'
import { AddArticlePage } from './features/articles/AddArticlePage'
import { DashboardPage } from './features/dashboard/DashboardPage'

type View = 'dashboard' | 'add-article'

export default function App() {
  const [view, setView] = useState<View>('dashboard')

  if (view === 'add-article') {
    return <AddArticlePage onBack={() => setView('dashboard')} />
  }
  return <DashboardPage onAdd={() => setView('add-article')} />
}

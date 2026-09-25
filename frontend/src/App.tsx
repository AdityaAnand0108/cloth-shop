import { useState } from 'react'
import type { ArticleFilters } from './api/types'
import { AddArticlePage } from './features/articles/AddArticlePage'
import { ArticleDetailPage } from './features/articles/ArticleDetailPage'
import { ArticleListPage, NO_FILTERS } from './features/articles/ArticleListPage'
import { DashboardPage } from './features/dashboard/DashboardPage'

type View =
  | { name: 'dashboard' }
  | { name: 'add-article' }
  | { name: 'articles' }
  | { name: 'article'; variantId: number }

export default function App() {
  const [view, setView] = useState<View>({ name: 'dashboard' })
  // Held here so it survives opening an article and coming back.
  const [filters, setFilters] = useState<ArticleFilters>(NO_FILTERS)

  const toDashboard = () => setView({ name: 'dashboard' })
  const toArticles = () => setView({ name: 'articles' })
  const openArticle = (variantId: number) => setView({ name: 'article', variantId })

  switch (view.name) {
    case 'add-article':
      return <AddArticlePage onBack={toDashboard} />
    case 'articles':
      return (
        <ArticleListPage
          onBack={toDashboard}
          onSelect={openArticle}
          filters={filters}
          setFilters={setFilters}
        />
      )
    case 'article':
      return (
        <ArticleDetailPage
          variantId={view.variantId}
          onBack={toArticles}
          onOpenArticle={openArticle}
        />
      )
    default:
      return (
        <DashboardPage
          onAdd={() => setView({ name: 'add-article' })}
          onViewArticles={toArticles}
        />
      )
  }
}

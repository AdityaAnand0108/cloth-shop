import { useState } from 'react'
import type { ArticleFilters, Bill } from './api/types'
import { AddArticlePage } from './features/articles/AddArticlePage'
import { ArticleDetailPage } from './features/articles/ArticleDetailPage'
import { ArticleListPage, NO_FILTERS } from './features/articles/ArticleListPage'
import { BillPage } from './features/cart/BillPage'
import { CartBar } from './features/cart/CartBar'
import { CartPage } from './features/cart/CartPage'
import { CartProvider } from './features/cart/CartContext'
import { DashboardPage } from './features/dashboard/DashboardPage'

type View =
  | { name: 'dashboard' }
  | { name: 'add-article' }
  | { name: 'articles' }
  | { name: 'article'; variantId: number }
  | { name: 'cart' }
  /** A bill just rung up is carried in whole; an older one is fetched by id. */
  | { name: 'bill'; bill?: Bill; billId?: number }

export default function App() {
  return (
    <CartProvider>
      <Shell />
    </CartProvider>
  )
}

function Shell() {
  const [view, setView] = useState<View>({ name: 'dashboard' })
  // Held here so it survives opening an article and coming back.
  const [filters, setFilters] = useState<ArticleFilters>(NO_FILTERS)

  const toDashboard = () => setView({ name: 'dashboard' })
  const toArticles = () => setView({ name: 'articles' })
  const toCart = () => setView({ name: 'cart' })
  const openArticle = (variantId: number) => setView({ name: 'article', variantId })
  const openBill = (billId: number) => setView({ name: 'bill', billId })

  const page = () => {
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
      case 'cart':
        return (
          <CartPage
            onBack={toDashboard}
            onBrowse={toArticles}
            onBilled={bill => setView({ name: 'bill', bill })}
            onOpenArticle={openArticle}
          />
        )
      case 'bill':
        return (
          <BillPage
            bill={view.bill}
            billId={view.billId}
            onNewSale={toArticles}
            onBack={toDashboard}
          />
        )
      default:
        return (
          <DashboardPage
            onAdd={() => setView({ name: 'add-article' })}
            onViewArticles={toArticles}
            onOpenCart={toCart}
            onOpenBill={openBill}
          />
        )
    }
  }

  // The bar follows the cart everywhere except the two screens that already are the
  // cart — on those it would only repeat what fills the page.
  const showCartBar = view.name !== 'cart' && view.name !== 'bill'

  return (
    <>
      {page()}
      {showCartBar && <CartBar onOpenCart={toCart} />}
    </>
  )
}

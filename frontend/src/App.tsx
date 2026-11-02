import { useState } from 'react'
import { authClient } from './auth'
import type { ArticleFilters, Bill } from './api/types'
import { AddArticlePage } from './features/articles/AddArticlePage'
import { ArticleDetailPage } from './features/articles/ArticleDetailPage'
import { ArticleListPage, NO_FILTERS } from './features/articles/ArticleListPage'
import { BillPage } from './features/cart/BillPage'
import { CartBar } from './features/cart/CartBar'
import { CartPage } from './features/cart/CartPage'
import { CartProvider } from './features/cart/CartContext'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { LoginPage } from './features/auth/LoginPage'
import { ImportPage } from './features/import/ImportPage'
import { ReceiveStockPage } from './features/inventory/ReceiveStockPage'
import { CustomerPage } from './features/customers/CustomerPage'
import { ReturnPage } from './features/sales/ReturnPage'

type View =
  | { name: 'dashboard' }
  | { name: 'add-article' }
  | { name: 'articles' }
  | { name: 'article'; variantId: number }
  | { name: 'cart' }
  /** A bill just rung up is carried in whole; an older one is fetched by id. */
  | { name: 'bill'; bill?: Bill; billId?: number }
  | { name: 'import'; kind: 'inventory' | 'sales' }
  | { name: 'receive-stock'; variantId?: number }
  | { name: 'customers' }
  | { name: 'return'; saleId: number }

export default function App() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) return <main className="login-page"><p className="muted">Checking your session…</p></main>
  if (!session?.user) return <LoginPage />

  return <CartProvider><Shell onSignOut={() => { void authClient.signOut() }} /></CartProvider>
}

function Shell({ onSignOut }: { onSignOut: () => void }) {
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
            onReceiveStock={variantId => setView({ name: 'receive-stock', variantId })}
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
            onReturn={() => setView({ name: 'return', saleId: view.billId ?? view.bill!.id })}
          />
        )
      case 'import':
        return <ImportPage kind={view.kind} onBack={toDashboard} />
      case 'receive-stock':
        return <ReceiveStockPage initialVariantId={view.variantId} onBack={() => view.variantId ? openArticle(view.variantId) : toDashboard()} />
      case 'customers':
        return <CustomerPage onBack={toDashboard} onOpenBill={openBill} />
      case 'return':
        return <ReturnPage saleId={view.saleId} onBack={() => openBill(view.saleId)} />
      default:
        return (
          <DashboardPage
            onAdd={() => setView({ name: 'add-article' })}
            onViewArticles={toArticles}
            onOpenCart={toCart}
            onOpenBill={openBill}
            onImportInventory={() => setView({ name: 'import', kind: 'inventory' })}
            onImportSales={() => setView({ name: 'import', kind: 'sales' })}
            onReceiveStock={() => setView({ name: 'receive-stock' })}
            onCustomers={() => setView({ name: 'customers' })}
            onOpenArticle={openArticle}
          />
        )
    }
  }

  // The bar follows the cart everywhere except the two screens that already are the
  // cart — on those it would only repeat what fills the page.
  const showCartBar = view.name !== 'cart' && view.name !== 'bill'

  return (
    <>
      <button type="button" className="sign-out" onClick={onSignOut}>Sign out</button>
      {page()}
      {showCartBar && <CartBar onOpenCart={toCart} />}
    </>
  )
}

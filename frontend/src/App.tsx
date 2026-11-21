import { useState } from 'react'
import type { ArticleFilters, Bill } from './api/types'
import { AddArticlePage } from './features/articles/AddArticlePage'
import { ArticleDetailPage } from './features/articles/ArticleDetailPage'
import { EditArticlePage } from './features/articles/EditArticlePage'
import { ArticleListPage, NO_FILTERS } from './features/articles/ArticleListPage'
import { BillPage } from './features/cart/BillPage'
import { CartBar } from './features/cart/CartBar'
import { CartPage } from './features/cart/CartPage'
import { CartProvider } from './features/cart/CartContext'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { ImportPage } from './features/import/ImportPage'
import { ReceiveStockPage } from './features/inventory/ReceiveStockPage'
import { CustomerPage } from './features/customers/CustomerPage'
import { ReturnPage } from './features/sales/ReturnPage'
import { BillsPage } from './features/sales/BillsPage'

type View =
  | { name: 'dashboard' }
  | { name: 'add-article' }
  | { name: 'articles' }
  | { name: 'article'; variantId: number }
  | { name: 'edit-article'; variantId: number }
  | { name: 'cart' }
  /** A bill just rung up is carried in whole; an older one is fetched by id. */
  | { name: 'bill'; bill?: Bill; billId?: number }
  | { name: 'import'; kind: 'inventory' | 'sales' }
  | { name: 'receive-stock'; variantId?: number }
  | { name: 'customers' }
  | { name: 'bills' }
  | { name: 'return'; saleId: number }

export default function App() {
  return <CartProvider><Shell /></CartProvider>
}

function Shell() {
  const [view, setView] = useState<View>({ name: 'dashboard' })
  // Held here so it survives opening an article and coming back.
  const [filters, setFilters] = useState<ArticleFilters>(NO_FILTERS)

  const toDashboard = () => setView({ name: 'dashboard' })
  const toArticles = () => setView({ name: 'articles' })
  const toCart = () => setView({ name: 'cart' })
  const openArticle = (variantId: number) => setView({ name: 'article', variantId })
  const editArticle = (variantId: number) => setView({ name: 'edit-article', variantId })
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
            onEdit={editArticle}
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
      case 'edit-article':
        return <EditArticlePage variantId={view.variantId} onBack={toArticles} />
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
      case 'bills':
        return <BillsPage onBack={toDashboard} onOpenBill={openBill} />
      case 'return':
        return <ReturnPage saleId={view.saleId} onBack={() => openBill(view.saleId)} />
      default:
        return (
          <DashboardPage
            userName="Staff"
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
    <div className="app-frame">
      <aside className="app-sidebar" aria-label="Main navigation">
        <div className="app-brand"><span className="app-brand-mark">B</span><span>BFlex</span></div>
        <nav className="app-nav">
          <button type="button" className={view.name === 'dashboard' ? 'active' : ''} onClick={toDashboard}><span aria-hidden="true">⌂</span>Overview</button>
          <button type="button" className={view.name === 'articles' || view.name === 'article' || view.name === 'edit-article' ? 'active' : ''} onClick={toArticles}><span aria-hidden="true">▤</span>Articles</button>
          <button type="button" className={view.name === 'add-article' ? 'active' : ''} onClick={() => setView({ name: 'add-article' })}><span aria-hidden="true">＋</span>Add article</button>
          <button type="button" className={view.name === 'receive-stock' ? 'active' : ''} onClick={() => setView({ name: 'receive-stock' })}><span aria-hidden="true">⇩</span>Receive stock</button>
          <button type="button" className={view.name === 'cart' || view.name === 'bill' ? 'active' : ''} onClick={toCart}><span aria-hidden="true">▱</span>Sales cart</button>
          <button type="button" className={view.name === 'customers' ? 'active' : ''} onClick={() => setView({ name: 'customers' })}><span aria-hidden="true">♙</span>Customers</button>
          <button type="button" className={view.name === 'bills' ? 'active' : ''} onClick={() => setView({ name: 'bills' })}><span aria-hidden="true">▣</span>All bills</button>
          <div className="app-nav-label">Data tools</div>
          <button type="button" className={view.name === 'import' && view.kind === 'inventory' ? 'active' : ''} onClick={() => setView({ name: 'import', kind: 'inventory' })}><span aria-hidden="true">⇧</span>Import inventory</button>
          <button type="button" className={view.name === 'import' && view.kind === 'sales' ? 'active' : ''} onClick={() => setView({ name: 'import', kind: 'sales' })}><span aria-hidden="true">⇧</span>Import sales</button>
        </nav>
      </aside>
      <main className="app-main">
        {page()}
        {showCartBar && <CartBar onOpenCart={toCart} />}
      </main>
    </div>
  )
}

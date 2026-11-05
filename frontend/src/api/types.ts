export type LookupItem = {
  id: number
  code: string
  name: string
  hex: string | null
  sizeGroupId: number | null
}

export type WholesalerItem = {
  id: number
  name: string
  phone: string
  address: string
}

export type CustomerSummary = {
  id: number
  name: string
  phone: string
  visitCount: number
  lifetimeSpend: number
  lastVisit: string | null
  whatsappOptIn: boolean
}

export type StaffItem = {
  id: number
  name: string
}

export type Lookups = {
  articleTypes: LookupItem[]
  materials: LookupItem[]
  colours: LookupItem[]
  sizes: LookupItem[]
  brands: LookupItem[]
  wholesalers: WholesalerItem[]
  staff: StaffItem[]
  defaultMarkup: number
}

export type ExistingArticle = {
  variantId: number
  articleCode: string
  displayName: string
  colourName: string
  sizeName: string
  /** Cost basis of the stock on hand - what a new lot gets blended into. */
  avgCost: number
  lastBuyingPrice: number
  sellingPrice: number
  qtyOnHand: number
}

export type PreviewResponse = {
  articleCode: string
  exists: boolean
  existing: ExistingArticle | null
}

export type AddMode = 'CREATE' | 'ADD_STOCK'

export type AddArticleRequest = {
  articleTypeId: number
  brandId: number
  materialId: number
  colourId: number
  sizeId: number
  buyingPrice: number
  sellingPrice: number
  quantity: number
  /** Who this lot was bought from — recorded against the movement, not the article. */
  wholesalerId: number
  /** Who is entering it; their name lands in the ledger row. */
  staffId: number
  mode: AddMode
  /** Buying price is never optional - it is averaged in regardless. Only this is a choice. */
  updateSellingPrice: boolean
  note?: string
  purchaseReference?: string
  reorderLevel?: number
}

export type AddArticleResponse = {
  outcome: 'CREATED' | 'STOCK_ADDED'
  variantId: number
  articleCode: string
  displayName: string
  qtyOnHand: number
  avgCost: number
  lastBuyingPrice: number
  sellingPrice: number
  sellingPriceChanged: boolean
}

export type AddArticleBatchRequest = Omit<AddArticleRequest,
  'colourId' | 'sizeId' | 'quantity' | 'mode' | 'updateSellingPrice'> & {
  sizes: Array<{
    colourId: number
    sizeId: number
    quantity: number
    mode: AddMode
    updateSellingPrice: boolean
  }>
}

export type AddArticleBatchResponse = {
  items: AddArticleResponse[]
}

export type InventoryReceiptLineRequest = {
  variantId?: number
  wholesalerId?: number
  staffId?: number
  articleTypeId?: number
  brandId?: number
  materialId?: number
  colourId?: number
  sizeId?: number
  buyingPrice: number
  sellingPrice: number
  quantity: number
  updateSellingPrice: boolean
  reorderLevel?: number
  purchaseReference?: string
  note?: string
}

export type InventoryReceiptRequest = {
  wholesalerId: number
  staffId: number
  reference?: string
  note?: string
  items: InventoryReceiptLineRequest[]
}

export type InventoryReceiptResponse = { reference: string | null; items: AddArticleResponse[] }

/**
 * Held as strings because that is what a `<select>` and a text input give back —
 * an empty string simply means the filter is not set.
 */
export type ArticleFilters = {
  q: string
  articleTypeId: string
  brandId: string
  materialId: string
  colourId: string
  sizeId: string
}

export type ArticleListItem = {
  variantId: number
  articleCode: string
  articleType: string
  brand: string
  material: string
  colour: string
  colourHex: string | null
  size: string
  avgCost: number
  lastBuyingPrice: number
  sellingPrice: number
  qtyOnHand: number
}

export type LedgerEntry = {
  id: number
  movementType: string
  qtyDelta: number
  balanceAfter: number
  /** What this lot actually cost, as opposed to the running average. */
  unitCost: number | null
  /** What the customer paid. Only ever set on sales. */
  unitPrice: number | null
  wholesaler: string | null
  /** The bill this row came from, when it came from one. */
  reference: string | null
  note: string | null
  createdBy: string | null
  createdAt: string
}

export type SiblingVariant = {
  variantId: number
  articleCode: string
  colour: string
  colourHex: string | null
  size: string
  sellingPrice: number
  qtyOnHand: number
}

export type ArticleDetail = {
  variantId: number
  articleCode: string
  displayName: string
  articleType: string
  brand: string
  material: string
  colour: string
  colourHex: string | null
  size: string
  hsnCode: string | null
  status: string
  createdAt: string

  avgCost: number
  lastBuyingPrice: number
  sellingPrice: number
  mrp: number | null

  qtyOnHand: number
  reorderLevel: number

  totalIn: number
  totalOut: number
  firstMovementAt: string | null
  lastMovementAt: string | null
  lastSaleAt: string | null

  ledger: LedgerEntry[]
  siblings: SiblingVariant[]
}

export type Page<T> = {
  content: T[]
  totalElements: number
}

export type ArticleSearchSummary = {
  matchingVariants: number
  inStockVariants: number
  unitsOnHand: number
  sizes: string[]
  colours: Array<{ id: number; name: string; hex: string | null }>
}

export type ApiError = {
  code: string
  message: string
  details: Record<string, unknown>
}

// ---------- selling ----------

/**
 * What the counter needs to know about one article before a price is agreed: what it
 * sells for, what it cost, and how many are actually left.
 */
export type CartArticle = {
  variantId: number
  articleCode: string
  displayName: string
  colour: string
  colourHex: string | null
  size: string
  sellingPrice: number
  /** The floor. Shown while haggling so nobody goes under it by accident. */
  avgCost: number
  mrp: number | null
  qtyOnHand: number
  status: string
}

export type PaymentMode = 'CASH' | 'UPI' | 'CARD'

export type CheckoutLine = {
  variantId: number
  qty: number
  /** What was actually agreed, which is not always the shelf price. */
  unitPrice: number
  historicalUnitCost?: number
}

export type CheckoutRequest = {
  lines: CheckoutLine[]
  staffId: number
  billNo?: string
  customerName?: string
  customerPhone?: string
  whatsappOptIn?: boolean
  discount: number
  paymentMode: PaymentMode
  note?: string
  createdAt?: string
  affectInventory?: boolean
}

export type BillLine = {
  variantId: number
  articleCode: string
  description: string
  colour: string
  size: string
  qty: number
  /** The sticker price at the time, so the discount given stays legible later. */
  listPrice: number
  unitPrice: number
  unitCost: number
  lineTotal: number
  costEstimated: boolean
}

export type Bill = {
  id: number
  billNo: string
  createdAt: string
  staffName: string | null
  customerName: string | null
  customerPhone: string | null
  customerId: number | null
  subtotal: number
  discount: number
  total: number
  /** Not for the customer's copy. */
  costTotal: number
  profit: number
  paymentMode: PaymentMode
  note: string | null
  status: string
  whatsappStatus: string
  whatsappOptIn: boolean
  profitEstimated: boolean
  itemCount: number
  lines: BillLine[]
}

export type BillSummary = {
  id: number
  billNo: string
  createdAt: string
  customerName: string | null
  staffName: string | null
  itemCount: number
  total: number
  profit: number
  paymentMode: PaymentMode
  profitEstimated: boolean
}

export type DaySummary = {
  date: string
  billCount: number
  itemCount: number
  takings: number
  profit: number
  discountGiven: number
  bills: BillSummary[]
}

export type DashboardReport = {
  from: string
  to: string
  sales: {
    billCount: number; returnCount: number; itemCount: number; takings: number
    profit: number; discountGiven: number; estimatedProfitBills: number
  }
  inventory: {
    variantCount: number; unitsOnHand: number; stockAtCost: number
    outOfStockCount: number; lowStockCount: number
  }
  paymentBreakdown: Array<{ paymentMode: PaymentMode; total: number }>
  topSellers: Array<{
    variantId: number; articleCode: string; description: string; colour: string
    size: string; quantity: number; sales: number
  }>
  lowStock: Array<{
    variantId: number; articleCode: string; description: string; colour: string
    size: string; quantity: number; reorderLevel: number
  }>
  slowMovers: Array<{
    variantId: number; articleCode: string; description: string; colour: string
    size: string; quantity: number; stockAtCost: number; lastSoldAt: string | null
    daysSinceSale: number | null
  }>
}

export type ReturnRequest = {
  staffId: number
  returnType: 'REFUND' | 'EXCHANGE'
  reason?: string
  refundPaymentMode?: PaymentMode
  lines: Array<{ saleLineId: number; quantity: number; restock: boolean }>
  exchangeLines?: CheckoutLine[]
}

export type ReturnResult = {
  id: number
  returnNo: string
  originalBillNo: string
  returnType: 'REFUND' | 'EXCHANGE'
  refundAmount: number
  exchangeTotal: number
  settlementDue: number
  refundPaymentMode: PaymentMode | null
  createdAt: string
  exchangeBill: Bill | null
  lines: Array<{
    saleLineId: number; articleCode: string; description: string; colour: string
    size: string; quantity: number; refundTotal: number; restocked: boolean
  }>
}

export type ReturnableBill = {
  bill: Bill
  lines: Array<{
    saleLineId: number; variantId: number; articleCode: string; description: string
    colour: string; size: string; soldQuantity: number; returnedQuantity: number
    availableQuantity: number; unitPrice: number
  }>
}

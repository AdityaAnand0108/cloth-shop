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
  'sizeId' | 'quantity' | 'mode' | 'updateSellingPrice'> & {
  sizes: Array<{
    sizeId: number
    quantity: number
    mode: AddMode
    updateSellingPrice: boolean
  }>
}

export type AddArticleBatchResponse = {
  items: AddArticleResponse[]
}

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
}

export type CheckoutRequest = {
  lines: CheckoutLine[]
  staffId: number
  customerName?: string
  customerPhone?: string
  discount: number
  paymentMode: PaymentMode
  note?: string
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
}

export type Bill = {
  id: number
  billNo: string
  createdAt: string
  staffName: string | null
  customerName: string | null
  customerPhone: string | null
  subtotal: number
  discount: number
  total: number
  /** Not for the customer's copy. */
  costTotal: number
  profit: number
  paymentMode: PaymentMode
  note: string | null
  status: string
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

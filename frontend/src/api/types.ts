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
  wholesaler: string | null
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

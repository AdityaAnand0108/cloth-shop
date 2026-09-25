export type LookupItem = {
  id: number
  code: string
  name: string
  hex: string | null
  sizeGroupId: number | null
}

export type Lookups = {
  articleTypes: LookupItem[]
  materials: LookupItem[]
  colours: LookupItem[]
  sizes: LookupItem[]
  brands: LookupItem[]
  defaultMarkup: number
}

export type ExistingArticle = {
  variantId: number
  articleCode: string
  displayName: string
  colourName: string
  sizeName: string
  buyingPrice: number
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
  mode: AddMode
  updatePrices: boolean
  note?: string
}

export type AddArticleResponse = {
  outcome: 'CREATED' | 'STOCK_ADDED'
  variantId: number
  articleCode: string
  displayName: string
  qtyOnHand: number
  buyingPrice: number
  sellingPrice: number
  pricesUpdated: boolean
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
  buyingPrice: number
  sellingPrice: number
  qtyOnHand: number
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

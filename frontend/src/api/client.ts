import type {
  AddArticleRequest, AddArticleResponse, ApiError, ArticleDetail, ArticleFilters,
  ArticleListItem, Bill, CartArticle, CheckoutRequest, DaySummary, LookupItem,
  Lookups, Page, PreviewResponse, WholesalerItem,
} from './types'

const BASE = '/api/v1'

export class HttpError extends Error {
  constructor(public status: number, public body: ApiError) {
    super(body?.message ?? `Request failed (${status})`)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })

  if (!res.ok) {
    let body: ApiError
    try {
      body = await res.json()
    } catch {
      body = { code: 'NETWORK', message: res.statusText, details: {} }
    }
    throw new HttpError(res.status, body)
  }

  return res.status === 204 ? (undefined as T) : res.json()
}

export const api = {
  lookups: () => request<Lookups>('/lookups'),

  createBrand: (name: string, code?: string) =>
    request<LookupItem>('/brands', {
      method: 'POST',
      body: JSON.stringify({ name, code: code || null }),
    }),

  createWholesaler: (body: { name: string; phone: string; address: string }) =>
    request<WholesalerItem>('/wholesalers', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  previewCode: (body: {
    articleTypeId: number; brandId: number; materialId: number
    colourId: number; sizeId: number
  }) =>
    request<PreviewResponse>('/articles/preview-code', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  /**
   * The idempotency key is generated once when the form is opened and reused for
   * every retry of the same submission, so a double-tap cannot add stock twice.
   */
  addArticle: (body: AddArticleRequest, idempotencyKey: string) =>
    request<AddArticleResponse>('/articles', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(body),
    }),

  article: (variantId: number) => request<ArticleDetail>(`/articles/${variantId}`),

  /**
   * Blank filters are left off the query string entirely, so the server sees "any"
   * rather than having to interpret an empty value. Pass a signal to drop the
   * response of a search the user has already typed past.
   */
  listArticles: (filters: Partial<ArticleFilters> = {}, signal?: AbortSignal) => {
    const params = new URLSearchParams({ size: '100' })
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value)
    }
    return request<Page<ArticleListItem>>(`/articles?${params}`, { signal })
  },

  /**
   * The cart lives in the browser and can be hours old, so it re-asks the server for
   * price, cost and stock before anything is charged rather than trusting itself.
   */
  priceCheck: (variantIds: number[]) =>
    request<CartArticle[]>('/sales/price-check', {
      method: 'POST',
      body: JSON.stringify({ variantIds }),
    }),

  /**
   * Ring up the cart. The key is minted once per cart, so the counter tapping
   * "Complete sale" twice gets the same bill back instead of selling the goods again.
   */
  checkout: (body: CheckoutRequest, idempotencyKey: string) =>
    request<Bill>('/sales', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(body),
    }),

  bill: (id: number) => request<Bill>(`/sales/${id}`),

  /** Today by default; pass an ISO date to look back at a previous day. */
  day: (date?: string) =>
    request<DaySummary>(`/sales/day${date ? `?date=${date}` : ''}`),
}

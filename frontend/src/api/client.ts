import type {
  AddArticleRequest, AddArticleResponse, ApiError, ArticleListItem,
  LookupItem, Lookups, Page, PreviewResponse,
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

  listArticles: (q = '') =>
    request<Page<ArticleListItem>>(`/articles?size=50${q ? `&q=${encodeURIComponent(q)}` : ''}`),
}

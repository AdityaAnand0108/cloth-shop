import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters'

const authUrl = import.meta.env.VITE_NEON_AUTH_URL

if (!authUrl) {
  console.warn('VITE_NEON_AUTH_URL is not configured; Neon Auth is unavailable.')
}

const authAdapter = BetterAuthReactAdapter()(authUrl)

export const authClient = authAdapter.getBetterAuthInstance()

export async function getApiToken(): Promise<string | null> {
  try {
    return await authAdapter.getJWTToken(false)
  } catch {
    return null
  }
}

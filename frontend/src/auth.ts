import { createAuthClient } from '@neondatabase/auth'
import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters'

const authUrl = import.meta.env.VITE_NEON_AUTH_URL

if (!authUrl) {
  console.warn('VITE_NEON_AUTH_URL is not configured; Neon Auth is unavailable.')
}

export const authClient = createAuthClient(authUrl, {
  adapter: BetterAuthReactAdapter(),
})

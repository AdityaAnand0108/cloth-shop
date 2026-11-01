import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters'

const authUrl = import.meta.env.VITE_NEON_AUTH_URL

if (!authUrl) {
  console.warn('VITE_NEON_AUTH_URL is not configured; Neon Auth is unavailable.')
}

const authAdapter = BetterAuthReactAdapter()(authUrl)

// The React adapter handles the sign-in UI. The Spring API is public, so API
// requests do not need a Neon Auth token.
export const authClient = authAdapter.getBetterAuthInstance()

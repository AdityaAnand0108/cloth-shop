import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters'

const authUrl = import.meta.env.VITE_NEON_AUTH_URL

if (!authUrl) {
  console.warn('VITE_NEON_AUTH_URL is not configured; Neon Auth is unavailable.')
}

const authAdapter = BetterAuthReactAdapter()(authUrl)

// Keep the React adapter API for session/sign-in hooks and expose Neon Auth's
// session JWT getter for requests to the Spring API.
export const authClient = authAdapter.getBetterAuthInstance()
export const getApiAccessToken = () => authAdapter.getJWTToken(false)

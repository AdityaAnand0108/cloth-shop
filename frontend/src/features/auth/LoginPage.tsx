import { useState, type FormEvent } from 'react'
import { authClient } from '../../auth'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await authClient.signIn.email({ email: email.trim(), password })
      if (result.error) throw new Error(result.error.message || 'Authentication failed.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-story" aria-label="BFlex shop management">
        <div className="login-story-inner">
          <div className="login-brand" aria-label="BFlex">
            <span className="login-brand-mark" aria-hidden="true">B</span>
            <span>BFlex<span className="login-brand-period">.</span></span>
          </div>

          <div className="login-story-copy">
            <span className="login-eyebrow"><span /> YOUR SHOP, IN GOOD HANDS</span>
            <h1>More time for<br />the people <em>you serve.</em></h1>
            <p>Keep your inventory, customer sales and daily bills together in one clear workspace.</p>
          </div>

          <div className="fabric-art" aria-hidden="true">
            <div className="fabric-art-glow" />
            <div className="fabric-card fabric-card-back"><span>01</span><i /></div>
            <div className="fabric-card fabric-card-mid"><span>02</span><i /></div>
            <div className="fabric-card fabric-card-front"><span>BF</span><i /></div>
            <div className="fabric-thread thread-one" />
            <div className="fabric-thread thread-two" />
            <div className="fabric-stitch">MADE FOR THE EVERYDAY</div>
          </div>

          <p className="login-story-foot"><span className="login-status-dot" /> Your shop, ready when you are</p>
        </div>
      </section>

      <section className="login-panel" aria-label="Sign in">
        <div className="login-panel-inner">
          <div className="login-mobile-brand" aria-hidden="true">
            <span className="login-brand-mark">B</span><span>BFlex<span className="login-brand-period">.</span></span>
          </div>

          <div className="login-heading">
            <span className="login-welcome">WELCOME BACK</span>
            <h2>Sign in to your shop</h2>
            <p>Enter your shop account details to continue.</p>
          </div>

          <form className="login-form" onSubmit={submit}>
            {error && <div className="login-error" role="alert"><span aria-hidden="true">!</span>{error}</div>}

            <label className="login-field" htmlFor="shop-email">
              <span>Email address</span>
              <input
                id="shop-email"
                type="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@yourshop.com"
              />
            </label>

            <label className="login-field" htmlFor="shop-password">
              <span>Password</span>
              <span className="login-password-wrap">
                <input
                  id="shop-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
                <button
                  className="login-password-toggle"
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(value => !value)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </span>
            </label>

            <button className="login-submit" type="submit" disabled={busy} aria-busy={busy}>
              <span>{busy ? 'Signing in…' : 'Sign in'}</span>
              {!busy && <span className="login-submit-arrow" aria-hidden="true">→</span>}
            </button>
          </form>

          <div className="login-security-note">
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
              <rect x="4.25" y="8.25" width="11.5" height="8.5" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M6.75 8.25V5.75a3.25 3.25 0 0 1 6.5 0v2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span>Secure access to your shop workspace</span>
          </div>

          <p className="login-help">Need help signing in? Ask your shop administrator.</p>
        </div>
        <footer className="login-panel-footer"><span>BFlex Shop</span><span>Inventory, made simple.</span></footer>
      </section>
    </main>
  )
}

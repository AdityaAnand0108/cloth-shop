import { useState, type FormEvent } from 'react'
import { authClient } from '../../auth'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = creatingAccount
        ? await authClient.signUp.email({ email: email.trim(), password, name: name.trim() })
        : await authClient.signIn.email({ email: email.trim(), password })
      if (result.error) throw new Error(result.error.message || 'Authentication failed.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not authenticate. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login-page">
      <form className="card login-card" onSubmit={submit}>
        <div>
          <h1>BFlex</h1>
          <p className="muted">{creatingAccount ? 'Create your shop account' : 'Sign in to your shop'}</p>
        </div>
        {error && <div className="banner err" role="alert">{error}</div>}
        {creatingAccount && <label className="field">
          <span>Name</span>
          <input autoComplete="name" required value={name}
            onChange={e => setName(e.target.value)} />
        </label>}
        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="email" autoFocus required value={email}
            onChange={e => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" autoComplete={creatingAccount ? 'new-password' : 'current-password'} required value={password}
            onChange={e => setPassword(e.target.value)} />
        </label>
        <button className="primary big" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : creatingAccount ? 'Create account' : 'Sign in'}
        </button>
        <button type="button" className="ghost" disabled={busy}
          onClick={() => { setCreatingAccount(value => !value); setError(null) }}>
          {creatingAccount ? 'I already have an account' : 'Create an account'}
        </button>
      </form>
    </main>
  )
}

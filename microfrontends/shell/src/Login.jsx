import { useState } from 'react';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:4000';
const TOKEN_KEY = 'munchbox_admin_token';

// Logs in against identity-service (today: the gateway rewrites this to the monolith's
// /api/auth/login — see microservices/gateway/src/index.js MONOLITH_REWRITES). Every
// module's App.jsx already reads TOKEN_KEY from localStorage, so this is the one piece
// that turns all six modules' "Gateway returned 401" into real, live data.
export default function Login({ onLoggedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch(`${GATEWAY_URL}/api/identity/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Login failed (${res.status})`);
      if (!data.token) throw new Error('Login succeeded but no token was returned');
      localStorage.setItem(TOKEN_KEY, data.token);
      onLoggedIn(data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-split">
      <div className="login-hero">
        <div className="login-hero-mark">🍰</div>
        <h1>Munchbox</h1>
        <p>Admin — orders, shops, delivery, finance, catering and settings, each an independent module.</p>
      </div>
      <div className="login-form-side">
        <form onSubmit={submit} className="login-form">
          <h2>Sign in</h2>
          <p className="login-sub">via {GATEWAY_URL} → identity-service</p>
          {error && <p className="error">{error}</p>}
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </div>
    </div>
  );
}

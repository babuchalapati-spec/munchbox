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
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <form onSubmit={submit} style={{ width: 320, padding: '2rem', border: '1px solid #e6e0da', borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>Munchbox Admin</h2>
        <p style={{ color: '#776b63', fontSize: '0.85rem', marginTop: -8 }}>
          Signs in via {GATEWAY_URL} → identity-service (currently proxied to the live monolith).
        </p>
        {error && <p style={{ color: '#c62828', fontSize: '0.85rem' }}>{error}</p>}
        <label style={{ display: 'block', marginBottom: 10 }}>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ display: 'block', width: '100%', padding: 8, marginTop: 4, boxSizing: 'border-box' }}
          />
        </label>
        <label style={{ display: 'block', marginBottom: 16 }}>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ display: 'block', width: '100%', padding: 8, marginTop: 4, boxSizing: 'border-box' }}
          />
        </label>
        <button type="submit" disabled={busy} style={{ width: '100%', padding: 10, background: '#c2185b', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600 }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

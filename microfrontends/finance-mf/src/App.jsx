import { useEffect, useState } from 'react';

// Exposed to the shell as "finance_mf/FinanceApp" (see vite.config.js). Talks to
// finance-service via the gateway.
const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:4000';

export default function FinanceApp() {
  const [ledger, setLedger] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('munchbox_admin_token');
    fetch(`${GATEWAY_URL}/api/finance/ledger`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => {
        if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
        return res.json();
      })
      .then((data) => setLedger(data))
      .catch((err) => setError(err.message));
  }, []);

  const credits = (ledger?.entries || []).filter((e) => e.direction === 'credit').reduce((s, e) => s + Number(e.amount || 0), 0);
  const debits = (ledger?.entries || []).filter((e) => e.direction === 'debit').reduce((s, e) => s + Number(e.amount || 0), 0);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '1.5rem' }}>
      <h2 style={{ margin: '0 0 0.5rem' }}>Finance</h2>
      <p style={{ color: '#776b63', fontSize: '0.85rem', marginTop: 0 }}>finance-mf — talking to {GATEWAY_URL}</p>
      {error && (
        <p style={{ color: '#c62828' }}>
          Could not reach the gateway ({error}). Expected until finance-service is actually
          migrated (ARCHITECTURE.md §6, Phase 5) — the highest-stakes split, migrate with
          reconciliation tests comparing wallet balances exactly.
        </p>
      )}
      {!error && ledger === null && <p>Loading…</p>}
      {ledger && (
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <div style={{ flex: 1, background: '#e6f4ea', borderRadius: 10, padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#2e7d32', fontWeight: 700 }}>TOTAL CREDITS</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2e7d32' }}>₹{credits.toFixed(2)}</div>
          </div>
          <div style={{ flex: 1, background: '#fdecea', borderRadius: 10, padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#c62828', fontWeight: 700 }}>TOTAL DEBITS</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#c62828' }}>₹{debits.toFixed(2)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

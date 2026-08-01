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

  const entries = ledger?.entries || [];
  const credits = entries.filter((e) => e.direction === 'credit').reduce((s, e) => s + Number(e.amount || 0), 0);
  const debits = entries.filter((e) => e.direction === 'debit').reduce((s, e) => s + Number(e.amount || 0), 0);

  return (
    <div className="mf-page">
      <div className="mf-header">
        <div>
          <div className="mf-title">Finance</div>
          <div className="mf-subtitle">finance-mf · {GATEWAY_URL}</div>
        </div>
      </div>

      {error && (
        <p className="error">
          Could not reach the gateway ({error}). Expected until finance-service is actually migrated
          (ARCHITECTURE.md §6, Phase 5) — the highest-stakes split, migrate with reconciliation tests
          comparing wallet balances exactly, unless this is a real error.
        </p>
      )}

      {!error && ledger === null && (
        <div className="stat-row">
          {[0, 1].map((i) => <div key={i} className="skeleton-row" style={{ flex: 1, height: 80 }} />)}
        </div>
      )}

      {ledger && (
        <>
          <div className="stat-row">
            <div className="stat-tile">
              <div className="stat-num" style={{ color: '#2e7d32' }}>₹{credits.toFixed(2)}</div>
              <div className="stat-label">Total credits</div>
            </div>
            <div className="stat-tile">
              <div className="stat-num" style={{ color: '#c62828' }}>₹{debits.toFixed(2)}</div>
              <div className="stat-label">Total debits</div>
            </div>
          </div>

          {entries.length === 0 ? (
            <div className="mf-empty">
              <div className="mf-empty-icon">📒</div>
              No ledger activity yet.
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Kind</th>
                    <th>Description</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e._id}>
                      <td className="mf-subtitle">{new Date(e.createdAt).toLocaleDateString()}</td>
                      <td>{e.kind}</td>
                      <td>{e.description}</td>
                      <td style={{ color: e.direction === 'credit' ? '#2e7d32' : '#c62828', fontWeight: 700 }}>
                        {e.direction === 'credit' ? '+' : '-'}₹{Number(e.amount || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

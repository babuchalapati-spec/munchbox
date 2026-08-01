import { useEffect, useState } from 'react';

// Exposed to the shell as "catering_mf/CateringApp" (see vite.config.js). Talks to
// catering-service via the gateway — catering is the recommended first REAL backend
// split (ARCHITECTURE.md §6, Phase 2: self-contained, zero shared mutable state with
// orders), so this is also the best candidate to wire up for real once the pattern
// here is adopted.
const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:4000';

const STATUS_PILL = { requested: 'pill pill-warn', quoted: 'pill pill-info', accepted: 'pill pill-good', declined: 'pill pill-bad' };

export default function CateringApp() {
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('munchbox_admin_token');
    fetch(`${GATEWAY_URL}/api/catering`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => {
        if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
        return res.json();
      })
      .then((data) => setRequests(data.requests || data || []))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="mf-page">
      <div className="mf-header">
        <div>
          <div className="mf-title">Catering requests</div>
          <div className="mf-subtitle">catering-mf · {GATEWAY_URL}</div>
        </div>
      </div>

      {error && (
        <p className="error">
          Could not reach the gateway ({error}). Expected until catering-service is actually migrated —
          recommended first real split (ARCHITECTURE.md §6, Phase 2) — unless this is a real error.
        </p>
      )}

      {!error && requests === null && (
        <div className="table-wrap" style={{ padding: 12 }}>
          {[0, 1, 2].map((i) => <div key={i} className="skeleton-row" />)}
        </div>
      )}

      {Array.isArray(requests) && requests.length === 0 && (
        <div className="mf-empty">
          <div className="mf-empty-icon">🍽️</div>
          No catering requests yet.
        </div>
      )}

      {Array.isArray(requests) && requests.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Guests</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r._id}>
                  <td>{r.eventType || 'Catering request'}</td>
                  <td>{r.guestCount || '—'}</td>
                  <td><span className={STATUS_PILL[r.status] || 'pill'}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

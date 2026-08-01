import { useEffect, useState } from 'react';

// Exposed to the shell as "catering_mf/CateringApp" (see vite.config.js). Talks to
// catering-service via the gateway — catering is the recommended first REAL backend
// split (ARCHITECTURE.md §6, Phase 2: self-contained, zero shared mutable state with
// orders), so this is also the best candidate to wire up for real once the pattern
// here is adopted.
const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:4000';

const STATUS_COLOR = { requested: '#a86b00', quoted: '#1565c0', accepted: '#2e7d32', declined: '#c62828' };

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
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '1.5rem' }}>
      <h2 style={{ margin: '0 0 0.5rem' }}>Catering requests</h2>
      <p style={{ color: '#776b63', fontSize: '0.85rem', marginTop: 0 }}>catering-mf — talking to {GATEWAY_URL}</p>
      {error && (
        <p style={{ color: '#c62828' }}>
          Could not reach the gateway ({error}). Expected until catering-service is actually
          migrated — recommended first real split (ARCHITECTURE.md §6, Phase 2).
        </p>
      )}
      {!error && requests === null && <p>Loading…</p>}
      {Array.isArray(requests) && requests.length === 0 && <p>No catering requests yet.</p>}
      {Array.isArray(requests) && requests.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {requests.map((r) => (
            <li
              key={r._id}
              style={{ padding: '0.75rem', borderBottom: '1px solid #f0ebe5', display: 'flex', justifyContent: 'space-between' }}
            >
              <span>{r.eventType || 'Catering request'} — {r.guestCount || '?'} guests</span>
              <span style={{ color: STATUS_COLOR[r.status] || '#776b63', fontWeight: 600, textTransform: 'capitalize' }}>
                {r.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

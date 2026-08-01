import { useEffect, useState } from 'react';

// Exposed to the shell as "delivery_mf/DeliveryApp" (see vite.config.js). Talks to
// delivery-service via the gateway.
const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:4000';

const KYC_COLOR = { verified: '#2e7d32', pending: '#a86b00', rejected: '#c62828' };

export default function DeliveryApp() {
  const [partners, setPartners] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('munchbox_admin_token');
    fetch(`${GATEWAY_URL}/api/delivery/accounts`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => {
        if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
        return res.json();
      })
      .then((data) => setPartners(data.users || data.accounts || []))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '1.5rem' }}>
      <h2 style={{ margin: '0 0 0.5rem' }}>Delivery partners</h2>
      <p style={{ color: '#776b63', fontSize: '0.85rem', marginTop: 0 }}>delivery-mf — talking to {GATEWAY_URL}</p>
      {error && (
        <p style={{ color: '#c62828' }}>
          Could not reach the gateway ({error}). Expected until delivery-service is actually
          migrated (ARCHITECTURE.md §6, Phase 6) — live tracking + work-area currently live
          inside order-service's monolith code.
        </p>
      )}
      {!error && partners === null && <p>Loading…</p>}
      {partners?.length === 0 && <p>No delivery partners yet.</p>}
      {partners && partners.length > 0 && (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #e6e0da' }}>
              <th style={{ padding: '0.5rem' }}>Name</th>
              <th style={{ padding: '0.5rem' }}>Vehicle</th>
              <th style={{ padding: '0.5rem' }}>KYC status</th>
            </tr>
          </thead>
          <tbody>
            {partners.map((p) => (
              <tr key={p._id} style={{ borderBottom: '1px solid #f0ebe5' }}>
                <td style={{ padding: '0.5rem' }}>{p.name}</td>
                <td style={{ padding: '0.5rem', textTransform: 'capitalize' }}>{p.shop?.kyc?.vehicleType || p.kyc?.vehicleType || '—'}</td>
                <td style={{ padding: '0.5rem', color: KYC_COLOR[p.kyc?.status] || '#776b63', fontWeight: 600, textTransform: 'capitalize' }}>
                  {p.kyc?.status || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';

// Exposed to the shell as "delivery_mf/DeliveryApp" (see vite.config.js). Talks to
// delivery-service via the gateway.
const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:4000';

const KYC_PILL = { verified: 'pill pill-good', pending: 'pill pill-warn', rejected: 'pill pill-bad' };
const VEHICLE_ICON = { motorcycle: '🏍️', ev: '⚡', bicycle: '🚲', other: '🚗' };

export default function DeliveryApp() {
  const [partners, setPartners] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

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

  const filtered = useMemo(() => {
    if (!partners) return null;
    const q = search.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter((p) => p.name?.toLowerCase().includes(q));
  }, [partners, search]);

  return (
    <div className="mf-page">
      <div className="mf-header">
        <div>
          <div className="mf-title">Delivery partners</div>
          <div className="mf-subtitle">delivery-mf · {GATEWAY_URL}</div>
        </div>
        {partners && partners.length > 0 && (
          <input className="mf-search" placeholder="Search by name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        )}
      </div>

      {error && (
        <p className="error">
          Could not reach the gateway ({error}). Expected until delivery-service is actually migrated
          (ARCHITECTURE.md §6, Phase 6) — live tracking + work-area currently live inside order-service's
          monolith code, unless this is a real error.
        </p>
      )}

      {!error && partners === null && (
        <div className="table-wrap" style={{ padding: 12 }}>
          {[0, 1, 2].map((i) => <div key={i} className="skeleton-row" />)}
        </div>
      )}

      {filtered && filtered.length === 0 && (
        <div className="mf-empty">
          <div className="mf-empty-icon">🛵</div>
          {partners.length === 0 ? 'No delivery partners yet.' : 'No partners match your search.'}
        </div>
      )}

      {filtered && filtered.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Vehicle</th>
                <th>KYC status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const vehicle = p.shop?.kyc?.vehicleType || p.kyc?.vehicleType;
                return (
                  <tr key={p._id}>
                    <td>{p.name}</td>
                    <td>{VEHICLE_ICON[vehicle] || ''} {vehicle || '—'}</td>
                    <td><span className={KYC_PILL[p.kyc?.status] || 'pill'}>{p.kyc?.status || '—'}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

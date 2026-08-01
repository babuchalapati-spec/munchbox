import { useEffect, useState } from 'react';

// Exposed to the shell as "shops_mf/ShopsApp" (see vite.config.js). Talks to
// catalog-service via the gateway — never a specific service directly, so the
// gateway's monolith-fallback keeps this working during migration (ARCHITECTURE.md §6).
const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:4000';

// Mirrors the "Visible to customers" check added to admin/src/pages/Admin/Shops.jsx —
// a shop needs available AND an active subscription AND (deposit paid OR agreement
// signed) to actually show up for customers. Kept in sync with listShops on the
// backend; see ARCHITECTURE.md §4 for why this spans two service boundaries.
function visibility(shop) {
  if (!shop.available) return { text: 'Hidden — not available', ok: false };
  const ends = shop.subscription?.endsAt ? new Date(shop.subscription.endsAt) : null;
  if (!(shop.subscription?.active && ends && ends > new Date())) {
    return { text: 'Hidden — subscription inactive', ok: false };
  }
  if (shop.deposit?.required && !shop.deposit?.paid && !shop.agreement?.signed) {
    return { text: 'Hidden — deposit/agreement pending', ok: false };
  }
  return { text: 'Live to customers', ok: true };
}

export default function ShopsApp() {
  const [shops, setShops] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('munchbox_admin_token');
    fetch(`${GATEWAY_URL}/api/catalog/shops`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => {
        if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
        return res.json();
      })
      .then((data) => setShops(data.shops || []))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '1.5rem' }}>
      <h2 style={{ margin: '0 0 0.5rem' }}>Shops</h2>
      <p style={{ color: '#776b63', fontSize: '0.85rem', marginTop: 0 }}>shops-mf — talking to {GATEWAY_URL}</p>
      {error && (
        <p style={{ color: '#c62828' }}>
          Could not reach the gateway ({error}). Expected until catalog-service is actually
          migrated (ARCHITECTURE.md §6, Phase 4).
        </p>
      )}
      {!error && shops === null && <p>Loading…</p>}
      {shops?.length === 0 && <p>No shops yet.</p>}
      {shops && shops.length > 0 && (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #e6e0da' }}>
              <th style={{ padding: '0.5rem' }}>Name</th>
              <th style={{ padding: '0.5rem' }}>Category</th>
              <th style={{ padding: '0.5rem' }}>Visible to customers</th>
            </tr>
          </thead>
          <tbody>
            {shops.map((s) => {
              const v = visibility(s);
              return (
                <tr key={s._id} style={{ borderBottom: '1px solid #f0ebe5' }}>
                  <td style={{ padding: '0.5rem' }}>{s.name}</td>
                  <td style={{ padding: '0.5rem' }}>{s.category}</td>
                  <td style={{ padding: '0.5rem', color: v.ok ? '#2e7d32' : '#c62828', fontWeight: 600 }}>
                    {v.text}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

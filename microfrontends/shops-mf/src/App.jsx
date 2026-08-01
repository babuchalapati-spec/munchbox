import { useEffect, useMemo, useState } from 'react';

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

const CATEGORY_ICON = { cake: '🎂', restaurant: '🍔', catering: '🍽️' };

export default function ShopsApp() {
  const [shops, setShops] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

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

  const filtered = useMemo(() => {
    if (!shops) return null;
    const q = search.trim().toLowerCase();
    if (!q) return shops;
    return shops.filter((s) => s.name.toLowerCase().includes(q) || s.address?.toLowerCase().includes(q));
  }, [shops, search]);

  const liveCount = shops?.filter((s) => visibility(s).ok).length ?? 0;

  return (
    <div className="mf-page">
      <div className="mf-header">
        <div>
          <div className="mf-title">Shops</div>
          <div className="mf-subtitle">shops-mf · {GATEWAY_URL}</div>
        </div>
        {shops && shops.length > 0 && (
          <input className="mf-search" placeholder="Search by name or address…" value={search} onChange={(e) => setSearch(e.target.value)} />
        )}
      </div>

      {error && (
        <p className="error">
          Could not reach the gateway ({error}). Expected until catalog-service is actually migrated
          (ARCHITECTURE.md §6, Phase 4) unless this is a real error.
        </p>
      )}

      {!error && shops === null && (
        <div className="table-wrap" style={{ padding: 12 }}>
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton-row" />)}
        </div>
      )}

      {shops && shops.length > 0 && (
        <div className="stat-row">
          <div className="stat-tile">
            <div className="stat-num">{shops.length}</div>
            <div className="stat-label">Total shops</div>
          </div>
          <div className="stat-tile">
            <div className="stat-num" style={{ color: '#2e7d32' }}>{liveCount}</div>
            <div className="stat-label">Live to customers</div>
          </div>
          <div className="stat-tile">
            <div className="stat-num" style={{ color: '#c62828' }}>{shops.length - liveCount}</div>
            <div className="stat-label">Hidden</div>
          </div>
        </div>
      )}

      {filtered && filtered.length === 0 && (
        <div className="mf-empty">
          <div className="mf-empty-icon">🏪</div>
          {shops.length === 0 ? 'No shops yet.' : 'No shops match your search.'}
        </div>
      )}

      {filtered && filtered.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Address</th>
                <th>Visible to customers</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const v = visibility(s);
                return (
                  <tr key={s._id}>
                    <td>{s.name}</td>
                    <td>{CATEGORY_ICON[s.category] || ''} {s.category}</td>
                    <td className="mf-subtitle">{s.address || '—'}</td>
                    <td><span className={v.ok ? 'pill pill-good' : 'pill pill-bad'}>{v.text}</span></td>
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

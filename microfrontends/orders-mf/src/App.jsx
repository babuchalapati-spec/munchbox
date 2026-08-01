import { useEffect, useMemo, useState } from 'react';

// The component exposed to the shell as "orders_mf/OrdersApp" (see vite.config.js).
// Standalone-runnable too (npm run dev on port 5101) so this module can be developed
// and tested in isolation without the shell running at all — that independence is the
// whole point of a micro-frontend.
const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:4000';

const STATUS_PILL = {
  placed: 'pill',
  confirmed: 'pill pill-info',
  baking: 'pill pill-warn',
  heading_to_shop: 'pill pill-info',
  out_for_delivery: 'pill pill-warn',
  delivered: 'pill pill-good',
  cancelled: 'pill pill-bad',
};

export default function OrdersApp() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('munchbox_admin_token');
    fetch(`${GATEWAY_URL}/api/orders`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => {
        if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
        return res.json();
      })
      .then((data) => setOrders(data.orders || []))
      .catch((err) => setError(err.message));
  }, []);

  const filtered = useMemo(() => {
    if (!orders) return null;
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => o._id.toLowerCase().includes(q) || (o.status || '').toLowerCase().includes(q));
  }, [orders, search]);

  return (
    <div className="mf-page">
      <div className="mf-header">
        <div>
          <div className="mf-title">Orders</div>
          <div className="mf-subtitle">orders-mf · {GATEWAY_URL}</div>
        </div>
        {orders && orders.length > 0 && (
          <input className="mf-search" placeholder="Search by ID or status…" value={search} onChange={(e) => setSearch(e.target.value)} />
        )}
      </div>

      {error && (
        <p className="error">
          Could not reach the gateway ({error}). Expected until order-service is actually migrated
          (ARCHITECTURE.md §6, Phase 7) unless you're logged in and it's a real error.
        </p>
      )}

      {!error && orders === null && (
        <div className="table-wrap" style={{ padding: 12 }}>
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton-row" />)}
        </div>
      )}

      {filtered && filtered.length === 0 && (
        <div className="mf-empty">
          <div className="mf-empty-icon">🧾</div>
          {orders.length === 0 ? 'No orders yet.' : 'No orders match your search.'}
        </div>
      )}

      {filtered && filtered.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o._id}>
                  <td>#{o._id.slice(-6).toUpperCase()}</td>
                  <td><span className={STATUS_PILL[o.status] || 'pill'}>{o.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

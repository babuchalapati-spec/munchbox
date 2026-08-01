import { useEffect, useState } from 'react';

// The component exposed to the shell as "orders_mf/OrdersApp" (see vite.config.js).
// Standalone-runnable too (npm run dev on port 5101) so this module can be developed
// and tested in isolation without the shell running at all — that independence is the
// whole point of a micro-frontend.
const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:4000';

export default function OrdersApp() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('munchbox_admin_token');
    fetch(`${GATEWAY_URL}/api/orders`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
        return res.json();
      })
      .then((data) => setOrders(data.orders || []))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '1.5rem' }}>
      <h2 style={{ margin: '0 0 0.5rem' }}>Orders</h2>
      <p style={{ color: '#776b63', fontSize: '0.85rem', marginTop: 0 }}>
        orders-mf — loaded {window.parent === window ? 'standalone' : 'inside the shell'}, talking to {GATEWAY_URL}
      </p>
      {error && (
        <p style={{ color: '#c62828' }}>
          Could not reach the gateway ({error}). This is expected until order-service is
          actually migrated (ARCHITECTURE.md §6, Phase 7) — the gateway falls back to the
          monolith, which needs its own CORS/auth wiring to answer this remote's requests.
        </p>
      )}
      {!error && orders === null && <p>Loading…</p>}
      {orders?.length === 0 && <p>No orders yet.</p>}
      {orders && orders.length > 0 && (
        <ul>
          {orders.map((o) => (
            <li key={o._id}>
              #{o._id.slice(-6).toUpperCase()} — {o.status}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import testClient from '../api/testClient';

const NEXT_STATUS = {
  placed: { next: 'confirmed', label: 'Confirm order' },
  confirmed: { next: 'baking', label: 'Start baking / preparing' },
  baking: { next: 'ready', label: 'Mark ready for pickup' },
};

// Standalone page to verify the full shop-owner flow — login, see incoming orders,
// move them through confirmed -> baking -> ready, assign a delivery partner, and
// toggle an item's stock — without needing the mobile app. Isolated from the
// admin/customer/delivery sessions the same way the other test pages are (see
// ../api/testClient.js), so all four can be open in separate tabs at once to watch
// one order move through the whole lifecycle.
export default function ShopTest() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState(null); // { user, token }
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [orders, setOrders] = useState([]);
  const [partners, setPartners] = useState([]);
  const [assignPicks, setAssignPicks] = useState({});
  const [products, setProducts] = useState([]);
  const [actionError, setActionError] = useState('');

  function authHeaders() {
    return { headers: { Authorization: `Bearer ${session.token}` } };
  }

  async function login(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await testClient.post('/auth/login', { email, password });
      if (data.twoFactorRequired) {
        throw new Error('This shop has two-factor turned on — use the mobile app or admin login to sign in.');
      }
      if (data.user.role !== 'shop') {
        throw new Error('This account is not a shop owner');
      }
      setSession(data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  function logout() {
    setSession(null);
    setOrders([]);
    setPartners([]);
    setProducts([]);
    setEmail('');
    setPassword('');
  }

  async function refresh() {
    if (!session) return;
    try {
      const [ordersRes, partnersRes, productsRes] = await Promise.all([
        testClient.get('/orders', authHeaders()),
        testClient.get('/orders/delivery-partners', authHeaders()),
        testClient.get('/products', { ...authHeaders(), params: { shop: session.user.shop } }),
      ]);
      setOrders(ordersRes.data.orders);
      setPartners(partnersRes.data.partners);
      setProducts(productsRes.data.products);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Could not load shop data');
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function advance(order) {
    const step = NEXT_STATUS[order.status];
    if (!step) return;
    setActionError('');
    try {
      await testClient.put(`/orders/${order._id}/status`, { status: step.next }, authHeaders());
      await refresh();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Could not update status');
    }
  }

  async function assign(order) {
    const deliveryUserId = assignPicks[order._id];
    if (!deliveryUserId) return;
    setActionError('');
    try {
      await testClient.put(`/orders/${order._id}/assign`, { deliveryUserId }, authHeaders());
      await refresh();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Could not assign delivery partner');
    }
  }

  async function toggleStock(product) {
    setActionError('');
    try {
      await testClient.put(`/products/${product._id}`, { available: !product.available }, authHeaders());
      await refresh();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Could not update stock');
    }
  }

  if (!session) {
    return (
      <div className="login-split">
        <div className="login-hero">
          <div className="login-hero-mark">🍱</div>
          <h1>Munchbox</h1>
          <p>Shop owner — test page</p>
        </div>
        <div className="login-form-side">
          <div className="login-form">
            <h2>Shop owner login</h2>
            <p className="login-sub">Sign in with a shop account's email and password.</p>
            {error && <p className="error">{error}</p>}
            <form onSubmit={login} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label>
                Email
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
              </label>
              <label>
                Password
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </label>
              <button type="submit" disabled={submitting}>
                {submitting ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
            <p style={{ marginTop: 20 }}>
              <Link to="/test-center">← Test Center</Link>
              <br />
              <Link to="/customer-test">Customer test page →</Link>
              <br />
              <Link to="/delivery-test">Delivery partner test page →</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 820, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Shop owner — {session.user.name}</h1>
        <button type="button" onClick={logout}>
          Log out
        </button>
      </div>
      {actionError && <p className="error">{actionError}</p>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
        <h2>Orders ({orders.length})</h2>
        <button type="button" onClick={refresh}>
          ↻ Refresh
        </button>
      </div>
      {orders.length === 0 ? (
        <p className="login-sub">No orders yet.</p>
      ) : (
        orders.map((order) => (
          <div className="card" key={order._id} style={{ marginTop: 10 }}>
            <div>
              <strong>{order.user?.name || 'Customer'}</strong> —{' '}
              <span style={{ fontWeight: 600 }}>{order.status}</span>
            </div>
            {order.items.map((item, idx) => (
              <div key={idx} className="muted">
                {item.quantity}× {item.name}
              </div>
            ))}
            <div className="muted">Total: ₹{order.totalAmount} · Payment: {order.payment?.method === 'online' ? `Online (${order.payment.status})` : 'Cash on Delivery'}</div>
            <div className="muted">Deliver to: {order.deliveryAddress}</div>

            {NEXT_STATUS[order.status] && (
              <button type="button" onClick={() => advance(order)} style={{ marginTop: 8 }}>
                {NEXT_STATUS[order.status].label}
              </button>
            )}

            {order.status === 'ready' && !order.assignedTo && (
              <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  value={assignPicks[order._id] || ''}
                  onChange={(e) => setAssignPicks((s) => ({ ...s, [order._id]: e.target.value }))}
                >
                  <option value="">Choose delivery partner</option>
                  {partners.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => assign(order)}>
                  Assign
                </button>
              </div>
            )}
            {order.assignedTo && <div className="muted" style={{ marginTop: 6 }}>🛵 Assigned: {order.assignedTo.name}</div>}
          </div>
        ))
      )}

      <h2 style={{ marginTop: 24 }}>Menu items — toggle stock ({products.length})</h2>
      {products.length === 0 ? (
        <p className="login-sub">No items yet.</p>
      ) : (
        products.map((p) => (
          <div className="card" key={p._id} style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>{p.name}</strong> <span className="muted">₹{p.basePrice}</span>
            </div>
            <button type="button" onClick={() => toggleStock(p)} style={{ background: p.available ? '#2e7d32' : '#c62828', color: '#fff' }}>
              {p.available ? '✅ In stock' : '⏸️ Out of stock'} — tap to toggle
            </button>
          </div>
        ))
      )}

      <p style={{ marginTop: 24 }}>
        <Link to="/test-center">← Test Center</Link>
        <br />
        <Link to="/customer-test">Customer test page →</Link>
        <br />
        <Link to="/delivery-test">Delivery partner test page →</Link>
      </p>
    </div>
  );
}

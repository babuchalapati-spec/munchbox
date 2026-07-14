import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import testClient from '../api/testClient';

const STATUS_LABEL = {
  placed: 'Placed',
  confirmed: 'Confirmed by shop',
  baking: 'Baking',
  ready: 'Ready for pickup',
  heading_to_shop: 'Partner heading to shop',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Standalone page to verify the full customer flow — login, place an order, and
// watch its status change (as the shop/delivery test pages, or the mobile apps,
// move it along) — without needing the mobile app. Deliberately isolated from the
// admin/shop session (see ../api/testClient.js): its own token lives in local state,
// never in localStorage, so it can't collide with an admin session in the same browser.
export default function CustomerLoginTest() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' | 'code' | 'done'
  const [session, setSession] = useState(null); // { user, token }
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Ordering
  const [shops, setShops] = useState([]);
  const [products, setProducts] = useState([]);
  const [shopId, setShopId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [address, setAddress] = useState('123 Test Street');
  const [lat, setLat] = useState('17.4');
  const [lng, setLng] = useState('78.48');
  const [orderError, setOrderError] = useState('');
  const [placing, setPlacing] = useState(false);

  // My orders
  const [orders, setOrders] = useState([]);
  const [shopStars, setShopStars] = useState({});
  const [deliveryStars, setDeliveryStars] = useState({});

  function authHeaders() {
    return { headers: { Authorization: `Bearer ${session.token}` } };
  }

  async function sendOtp(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await testClient.post('/auth/request-otp', { phone });
      // Dev-mode OTP (only present when real SMS isn't configured yet) goes to the
      // browser console only — never shown on the page itself.
      if (data.devMode && data.devCode) console.log(`[dev OTP] ${phone}: ${data.devCode}`);
      setStep('code');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send OTP');
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyOtp(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await testClient.post('/auth/verify-otp', { phone, code, role: 'customer' });
      setSession(data);
      setStep('done');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setPhone('');
    setCode('');
    setSession(null);
    setError('');
    setStep('phone');
    setOrders([]);
  }

  useEffect(() => {
    if (step !== 'done') return;
    testClient.get('/shops').then(({ data }) => setShops(data.shops)).catch(() => {});
    refreshOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    if (!shopId) {
      setProducts([]);
      setProductId('');
      return;
    }
    testClient
      .get('/products', { params: { shop: shopId } })
      .then(({ data }) => {
        setProducts(data.products);
        setProductId(data.products[0]?._id || '');
      })
      .catch(() => setProducts([]));
  }, [shopId]);

  async function refreshOrders() {
    try {
      const { data } = await testClient.get('/orders/mine', authHeaders());
      setOrders(data.orders);
    } catch (err) {
      // ignore — session may have just started
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setLat(String(pos.coords.latitude));
      setLng(String(pos.coords.longitude));
    });
  }

  async function placeOrder(e) {
    e.preventDefault();
    setOrderError('');
    if (!shopId || !productId) {
      setOrderError('Pick a shop and an item.');
      return;
    }
    setPlacing(true);
    try {
      await testClient.post(
        '/orders',
        {
          shop: shopId,
          items: [{ product: productId, quantity: Number(quantity) || 1 }],
          deliveryAddress: address,
          phone,
          deliveryLocation: { lat: Number(lat), lng: Number(lng) },
          deliveryDate: tomorrow(),
        },
        authHeaders()
      );
      await refreshOrders();
    } catch (err) {
      setOrderError(err.response?.data?.message || 'Could not place order');
    } finally {
      setPlacing(false);
    }
  }

  async function submitRating(order) {
    try {
      await testClient.put(
        `/orders/${order._id}/rate`,
        {
          shopStars: Number(shopStars[order._id]) || 0,
          deliveryStars: order.assignedTo ? Number(deliveryStars[order._id]) || 0 : undefined,
        },
        authHeaders()
      );
      await refreshOrders();
    } catch (err) {
      setOrderError(err.response?.data?.message || 'Could not submit rating');
    }
  }

  return (
    <div className="login-split">
      <div className="login-hero">
        <div className="login-hero-mark">🍱</div>
        <h1>Munchbox</h1>
        <p>Customer app — test page</p>
      </div>
      <div className="login-form-side">
        <div className="login-form" style={{ maxWidth: 480 }}>
          <h2>Customer login</h2>
          <p className="login-sub">Confirms the customer OTP login + ordering flow works end-to-end.</p>
          {error && <p className="error">{error}</p>}

          {step === 'phone' && (
            <form onSubmit={sendOtp} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label>
                Phone number
                <input value={phone} onChange={(e) => setPhone(e.target.value)} required autoFocus />
              </label>
              <button type="submit" disabled={submitting}>
                {submitting ? 'Sending...' : 'Send OTP'}
              </button>
            </form>
          )}

          {step === 'code' && (
            <form onSubmit={verifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p className="login-sub">OTP sent to {phone}</p>
              <label>
                Enter OTP
                <input value={code} onChange={(e) => setCode(e.target.value)} required autoFocus />
              </label>
              <button type="submit" disabled={submitting}>
                {submitting ? 'Verifying...' : 'Verify & sign in'}
              </button>
              <button type="button" onClick={() => setStep('phone')} style={{ background: 'transparent', color: '#c2185b' }}>
                ← Change number
              </button>
            </form>
          )}

          {step === 'done' && session && (
            <div>
              <p style={{ color: '#2e7d32', fontWeight: 600 }}>
                ✅ Logged in as {session.user.name} ({session.user.phone})
              </p>
              <button type="button" onClick={reset} style={{ marginTop: 8 }}>
                Log out / test another number
              </button>

              <h3 style={{ marginTop: 24 }}>Place a test order</h3>
              {orderError && <p className="error">{orderError}</p>}
              <form onSubmit={placeOrder} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label>
                  Shop
                  <select value={shopId} onChange={(e) => setShopId(e.target.value)} required>
                    <option value="">Choose a shop</option>
                    {shops.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name} ({s.category})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Item
                  <select value={productId} onChange={(e) => setProductId(e.target.value)} required disabled={!products.length}>
                    {products.length === 0 && <option value="">No items available</option>}
                    {products.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} — ₹{p.basePrice}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Quantity
                  <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                </label>
                <label>
                  Delivery address
                  <input value={address} onChange={(e) => setAddress(e.target.value)} required />
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <label style={{ flex: 1 }}>
                    Lat
                    <input type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} required />
                  </label>
                  <label style={{ flex: 1 }}>
                    Lng
                    <input type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} required />
                  </label>
                </div>
                <button type="button" onClick={useMyLocation} style={{ background: 'transparent' }}>
                  📍 Use my location
                </button>
                <button type="submit" disabled={placing}>
                  {placing ? 'Placing...' : 'Place order'}
                </button>
              </form>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24 }}>
                <h3>My orders</h3>
                <button type="button" onClick={refreshOrders}>
                  ↻ Refresh
                </button>
              </div>
              {orders.length === 0 ? (
                <p className="login-sub">No orders yet.</p>
              ) : (
                orders.map((order) => (
                  <div className="card" key={order._id} style={{ marginTop: 10 }}>
                    <div>
                      <strong>{order.shop?.name || 'Order'}</strong> —{' '}
                      <span style={{ fontWeight: 600 }}>{STATUS_LABEL[order.status] || order.status}</span>
                    </div>
                    {order.items.map((item, idx) => (
                      <div key={idx} className="muted">
                        {item.quantity}× {item.name}
                      </div>
                    ))}
                    <div className="muted">Total: ₹{order.totalAmount}</div>
                    {order.assignedTo && <div className="muted">🛵 {order.assignedTo.name}</div>}
                    {order.deliveryCode && order.status === 'out_for_delivery' && (
                      <div style={{ marginTop: 6, fontWeight: 700 }}>
                        Delivery code (give to partner at the door): {order.deliveryCode}
                      </div>
                    )}
                    {order.status === 'delivered' &&
                      (order.rating?.ratedAt ? (
                        <div className="muted" style={{ marginTop: 6 }}>
                          Rated — shop {order.rating.shopStars}★
                          {order.rating.deliveryStars ? `, delivery ${order.rating.deliveryStars}★` : ''}
                        </div>
                      ) : (
                        <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <label>
                            Shop ★
                            <select
                              value={shopStars[order._id] || ''}
                              onChange={(e) => setShopStars((s) => ({ ...s, [order._id]: e.target.value }))}
                            >
                              <option value="">-</option>
                              {[1, 2, 3, 4, 5].map((n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                            </select>
                          </label>
                          {order.assignedTo && (
                            <label>
                              Delivery ★
                              <select
                                value={deliveryStars[order._id] || ''}
                                onChange={(e) => setDeliveryStars((s) => ({ ...s, [order._id]: e.target.value }))}
                              >
                                <option value="">-</option>
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <option key={n} value={n}>
                                    {n}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                          <button type="button" onClick={() => submitRating(order)}>
                            Submit rating
                          </button>
                        </div>
                      ))}
                  </div>
                ))
              )}
            </div>
          )}

          <p style={{ marginTop: 20 }}>
            <Link to="/delivery-test">Delivery partner test page →</Link>
            <br />
            <Link to="/login">← Back to admin/shop login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

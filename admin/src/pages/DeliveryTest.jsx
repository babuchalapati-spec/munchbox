import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import testClient from '../api/testClient';

const NEXT_STAGE = {
  confirmed: 'heading_to_shop',
  baking: 'heading_to_shop',
  ready: 'heading_to_shop',
};

// Standalone page to verify the full delivery-partner flow — login, see nearby
// available orders, claim one, head to the shop, confirm pickup, push GPS, and
// confirm delivery — without needing the mobile app. Isolated from the admin/shop
// session the same way ./CustomerLoginTest.jsx is (see ../api/testClient.js).
export default function DeliveryTest() {
  const [mode, setMode] = useState('password'); // 'password' | 'otp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [otpStep, setOtpStep] = useState('phone'); // 'phone' | 'code'
  const [devHint, setDevHint] = useState('');
  const [session, setSession] = useState(null); // { user, token }
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [available, setAvailable] = useState([]);
  const [assigned, setAssigned] = useState([]);
  const [pickupCodeInputs, setPickupCodeInputs] = useState({});
  const [deliveryCodeInputs, setDeliveryCodeInputs] = useState({});
  const [locationDrafts, setLocationDrafts] = useState({});
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
      if (data.user.role !== 'delivery') {
        throw new Error('This account is not a delivery partner');
      }
      setSession(data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function sendOtp(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await testClient.post('/auth/request-otp', { phone });
      setDevHint(data.devMode && data.devCode ? `Dev code: ${data.devCode}` : '');
      setOtpStep('code');
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
      const { data } = await testClient.post('/auth/verify-otp', { phone, code, role: 'delivery' });
      if (data.needsRegistration) {
        setError('No delivery account for this number yet. Create one in Admin → Delivery accounts first.');
        return;
      }
      setSession(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setSubmitting(false);
    }
  }

  function logout() {
    setSession(null);
    setAvailable([]);
    setAssigned([]);
    setEmail('');
    setPassword('');
    setPhone('');
    setCode('');
    setOtpStep('phone');
    setMode('password');
  }

  async function refresh() {
    if (!session) return;
    try {
      const [availableRes, assignedRes] = await Promise.all([
        testClient.get('/orders/available', authHeaders()),
        testClient.get('/orders/assigned', authHeaders()),
      ]);
      setAvailable(availableRes.data.available);
      setAssigned(assignedRes.data.orders);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Could not load orders');
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function claim(id) {
    setActionError('');
    try {
      await testClient.put(`/orders/${id}/claim`, {}, authHeaders());
      await refresh();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Could not claim — it may have just been taken.');
    }
  }

  async function advanceToHeadingToShop(order) {
    setActionError('');
    try {
      await testClient.put(`/orders/${order._id}/status`, { status: 'heading_to_shop' }, authHeaders());
      await refresh();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Could not update status');
    }
  }

  async function confirmPickup(order) {
    setActionError('');
    try {
      await testClient.put(
        `/orders/${order._id}/pickup`,
        { code: pickupCodeInputs[order._id] || '' },
        authHeaders()
      );
      await refresh();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Incorrect pickup code');
    }
  }

  async function pushLocation(order) {
    setActionError('');
    const draft = locationDrafts[order._id];
    if (!draft?.lat || !draft?.lng) return;
    try {
      await testClient.put(
        `/orders/${order._id}/location`,
        { lat: Number(draft.lat), lng: Number(draft.lng) },
        authHeaders()
      );
      await refresh();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Could not push location');
    }
  }

  function useMyLocation(orderId) {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setLocationDrafts((s) => ({
        ...s,
        [orderId]: { lat: pos.coords.latitude, lng: pos.coords.longitude },
      }));
    });
  }

  async function confirmDelivery(order) {
    setActionError('');
    try {
      await testClient.put(
        `/orders/${order._id}/deliver`,
        { code: deliveryCodeInputs[order._id] || '' },
        authHeaders()
      );
      await refresh();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Incorrect delivery code');
    }
  }

  if (!session) {
    return (
      <div className="login-split">
        <div className="login-hero">
          <div className="login-hero-mark">🍱</div>
          <h1>Munchbox</h1>
          <p>Delivery partner — test page</p>
        </div>
        <div className="login-form-side">
          <div className="login-form">
            <h2>Delivery partner login</h2>
            <p className="login-sub">Sign in with a delivery account created in Admin → Delivery accounts.</p>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => { setMode('password'); setError(''); }}
                style={{ flex: 1, opacity: mode === 'password' ? 1 : 0.6 }}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => { setMode('otp'); setError(''); }}
                style={{ flex: 1, opacity: mode === 'otp' ? 1 : 0.6 }}
              >
                OTP
              </button>
            </div>

            {error && <p className="error">{error}</p>}

            {mode === 'password' ? (
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
            ) : otpStep === 'phone' ? (
              <form onSubmit={sendOtp} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label>
                  Phone number
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} required autoFocus />
                </label>
                <button type="submit" disabled={submitting}>
                  {submitting ? 'Sending...' : 'Send OTP'}
                </button>
              </form>
            ) : (
              <form onSubmit={verifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p className="login-sub">OTP sent to {phone}</p>
                {devHint && <p style={{ color: '#a86b00', fontSize: '0.8rem' }}>{devHint}</p>}
                <label>
                  Enter OTP
                  <input value={code} onChange={(e) => setCode(e.target.value)} required autoFocus />
                </label>
                <button type="submit" disabled={submitting}>
                  {submitting ? 'Verifying...' : 'Verify & sign in'}
                </button>
                <button type="button" onClick={() => setOtpStep('phone')} style={{ background: 'transparent', color: '#c2185b' }}>
                  ← Change number
                </button>
              </form>
            )}

            <p style={{ marginTop: 20 }}>
              <Link to="/customer-test">Customer test page →</Link>
              <br />
              <Link to="/login">← Back to admin/shop login</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Delivery partner — {session.user.name}</h1>
        <button type="button" onClick={logout}>
          Log out
        </button>
      </div>
      {actionError && <p className="error">{actionError}</p>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
        <h2>Nearby available deliveries ({available.length})</h2>
        <button type="button" onClick={refresh}>
          ↻ Refresh
        </button>
      </div>
      {available.length === 0 ? (
        <p className="login-sub">Nothing available right now.</p>
      ) : (
        available.map((order) => (
          <div className="card" key={order._id} style={{ marginTop: 10 }}>
            <div>
              <strong>{order.type === 'courier' ? '🛵 Food pickup' : `🏪 ${order.shop?.name || 'Shop'}`}</strong>
              {order.distanceToPickup != null && <span className="muted"> · {order.distanceToPickup} km away</span>}
            </div>
            <div className="muted">Drop: {order.deliveryAddress}</div>
            <div className="muted">Delivery fee ₹{order.deliveryFee ?? 0}</div>
            <button type="button" onClick={() => claim(order._id)} style={{ marginTop: 8 }}>
              Pick this delivery
            </button>
          </div>
        ))
      )}

      <h2 style={{ marginTop: 24 }}>My deliveries ({assigned.length})</h2>
      {assigned.length === 0 ? (
        <p className="login-sub">Nothing claimed yet.</p>
      ) : (
        assigned.map((order) => (
          <div className="card" key={order._id} style={{ marginTop: 10 }}>
            <div>
              <strong>{order.shop?.name || order.pickupAddress || 'Order'}</strong> —{' '}
              <span style={{ fontWeight: 600 }}>{order.status}</span>
            </div>
            <div className="muted">Customer: {order.user?.name} · {order.user?.phone || order.phone}</div>
            <div className="muted">Drop: {order.deliveryAddress}</div>

            {NEXT_STAGE[order.status] && (
              <button type="button" onClick={() => advanceToHeadingToShop(order)} style={{ marginTop: 8 }}>
                🛵 Heading to shop
              </button>
            )}

            {order.status === 'heading_to_shop' && (
              <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  placeholder="6-digit pickup code"
                  maxLength={6}
                  value={pickupCodeInputs[order._id] || ''}
                  onChange={(e) => setPickupCodeInputs((s) => ({ ...s, [order._id]: e.target.value }))}
                />
                <button type="button" onClick={() => confirmPickup(order)}>
                  Confirm pickup
                </button>
              </div>
            )}

            {order.status === 'out_for_delivery' && (
              <>
                <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="number"
                    step="any"
                    placeholder="lat"
                    value={locationDrafts[order._id]?.lat ?? ''}
                    onChange={(e) =>
                      setLocationDrafts((s) => ({ ...s, [order._id]: { ...s[order._id], lat: e.target.value } }))
                    }
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="lng"
                    value={locationDrafts[order._id]?.lng ?? ''}
                    onChange={(e) =>
                      setLocationDrafts((s) => ({ ...s, [order._id]: { ...s[order._id], lng: e.target.value } }))
                    }
                  />
                  <button type="button" onClick={() => useMyLocation(order._id)}>
                    📍 Use my location
                  </button>
                  <button type="button" onClick={() => pushLocation(order)}>
                    Push location
                  </button>
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    placeholder="6-digit delivery code"
                    maxLength={6}
                    value={deliveryCodeInputs[order._id] || ''}
                    onChange={(e) => setDeliveryCodeInputs((s) => ({ ...s, [order._id]: e.target.value }))}
                  />
                  <button type="button" onClick={() => confirmDelivery(order)}>
                    Confirm delivery
                  </button>
                </div>
              </>
            )}

            {order.status === 'delivered' && <div style={{ color: '#2e7d32', fontWeight: 700, marginTop: 8 }}>✓ Delivered</div>}
          </div>
        ))
      )}

      <p style={{ marginTop: 24 }}>
        <Link to="/customer-test">Customer test page →</Link>
        <br />
        <Link to="/login">← Back to admin/shop login</Link>
      </p>
    </div>
  );
}

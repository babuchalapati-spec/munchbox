import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import client from '../api/client';
import {useCart} from '../context/CartContext';
import {useAuth} from '../context/AuthContext';

const TIP_OPTIONS = [0, 10, 20, 30, 50];

function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Could not load payment page'));
    document.body.appendChild(script);
  });
}

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function Checkout() {
  const {items, shop, total: itemsTotal, clear} = useCart();
  const {user} = useAuth();
  const navigate = useNavigate();

  const [deliveryAddress, setDeliveryAddress] = useState(user?.address || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [deliveryDate, setDeliveryDate] = useState(tomorrow());
  const [couponCode, setCouponCode] = useState('');
  const [tip, setTip] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [location, setLocation] = useState(null);
  const [quote, setQuote] = useState(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!shop) navigate('/');
  }, [shop, navigate]);

  const grandTotal = itemsTotal + (quote?.deliveryFee || 0) + tip;

  // Browsers block GPS access on plain-HTTP, non-localhost addresses — which this app
  // may be running on — so this quietly falls back to geocoding the typed address
  // server-side instead of leaving the customer stuck with no way to check out.
  async function quoteFromAddress() {
    if (!deliveryAddress.trim()) {
      setError('Type your delivery address first, or allow location access.');
      return;
    }
    setLocating(true);
    setError('');
    try {
      const {data} = await client.post(`/shops/${shop._id}/delivery-quote`, {address: deliveryAddress});
      setQuote(data);
      if (data.lat != null && data.lng != null) setLocation({lat: data.lat, lng: data.lng});
    } catch (err) {
      setError(err.response?.data?.message || 'Could not calculate delivery fee from that address.');
    } finally {
      setLocating(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      quoteFromAddress();
      return;
    }
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const loc = {lat: pos.coords.latitude, lng: pos.coords.longitude};
        setLocation(loc);
        try {
          const {data} = await client.post(`/shops/${shop._id}/delivery-quote`, loc);
          setQuote(data);
        } catch (err) {
          setError('Could not calculate delivery fee');
        } finally {
          setLocating(false);
        }
      },
      () => {
        // Most likely GPS is blocked (insecure origin) rather than truly denied —
        // fall back to the typed address instead of dead-ending the customer.
        quoteFromAddress();
      }
    );
  }

  function buildPayload() {
    return {
      shop: shop._id,
      items: items.map(({key, ...rest}) => rest),
      deliveryAddress,
      phone,
      deliveryLocation: location,
      deliveryDate,
      couponCode: couponCode || undefined,
      tip,
    };
  }

  async function placeOrder() {
    if (!deliveryAddress || !phone) return setError('Delivery address and phone are required');

    setError('');
    setSubmitting(true);
    try {
      if (paymentMethod === 'online') {
        const {data: checkoutOrder} = await client.post('/payments/razorpay/order', buildPayload());
        await loadRazorpayScript();
        const rzp = new window.Razorpay({
          key: checkoutOrder.keyId,
          amount: checkoutOrder.amount,
          currency: checkoutOrder.currency,
          name: 'Munchbox',
          description: `Order at ${shop.name}`,
          order_id: checkoutOrder.razorpayOrderId,
          prefill: {name: user?.name || '', contact: phone},
          theme: {color: '#E23364'},
          handler: async (response) => {
            try {
              const {data} = await client.post('/orders', {
                ...buildPayload(),
                paymentMethod: 'online',
                payment: {
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                },
              });
              clear();
              navigate(`/orders/${data.order._id}`);
            } catch (err) {
              setError(err.response?.data?.message || 'Payment succeeded but the order could not be placed. Please contact support.');
            }
          },
          modal: {
            ondismiss: () => {
              client.post('/payments/razorpay/failed', {
                amount: checkoutOrder.totalAmount,
                reason: 'Payment cancelled',
                razorpayOrderId: checkoutOrder.razorpayOrderId,
              }).catch(() => {});
            },
          },
        });
        rzp.open();
        setSubmitting(false);
        return;
      }

      const {data} = await client.post('/orders', {...buildPayload(), paymentMethod: 'COD'});
      clear();
      navigate(`/orders/${data.order._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not place order');
    } finally {
      if (paymentMethod !== 'online') setSubmitting(false);
    }
  }

  if (!shop) return null;

  return (
    <div className="screen">
      <div className="top-bar">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <h2>Checkout</h2>
      </div>
      <div className="page-pad" style={{flex: 1}}>
        {error && <p className="error">{error}</p>}

        <label className="label">Delivery address</label>
        <textarea className="input" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} rows={2} placeholder="Flat, street, city, pincode" />

        <button className="btn btn-outline" onClick={useMyLocation} disabled={locating} style={{marginBottom: 16}}>
          {locating ? 'Calculating…' : quote ? '✓ Delivery fee calculated — tap to update' : '📍 Calculate delivery fee'}
        </button>
        <p className="muted" style={{marginTop: -10, marginBottom: 16}}>Uses your location if allowed, otherwise your typed address above.</p>

        <label className="label">Phone</label>
        <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />

        <label className="label">Delivery date</label>
        <input className="input" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} min={tomorrow()} />

        <label className="label">Coupon code (optional)</label>
        <input className="input" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="WELCOME123456" />

        <label className="label">Tip your delivery partner</label>
        <div className="tab-row">
          {TIP_OPTIONS.map((amount) => (
            <button key={amount} className={`tab ${tip === amount ? 'active' : ''}`} onClick={() => setTip(amount)}>
              {amount === 0 ? 'No tip' : `₹${amount}`}
            </button>
          ))}
        </div>

        <label className="label">Payment method</label>
        <div className="tab-row">
          <button className={`tab ${paymentMethod === 'COD' ? 'active' : ''}`} onClick={() => setPaymentMethod('COD')}>💵 Cash on Delivery</button>
          <button className={`tab ${paymentMethod === 'online' ? 'active' : ''}`} onClick={() => setPaymentMethod('online')}>💳 Pay online</button>
        </div>

        <div className="card">
          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 6}}>
            <span className="muted">Items</span><span>₹{itemsTotal}</span>
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 6}}>
            <span className="muted">Delivery {quote ? `(${quote.distanceKm} km)` : ''}</span>
            <span>{quote ? `₹${quote.deliveryFee}` : '— set location'}</span>
          </div>
          {tip > 0 && (
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 6}}>
              <span className="muted">Tip</span><span>₹{tip}</span>
            </div>
          )}
          <div style={{display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16, borderTop: '1px solid #e6e0da', paddingTop: 8}}>
            <span>Total</span><span>₹{grandTotal}</span>
          </div>
        </div>
      </div>
      <div style={{position: 'sticky', bottom: 0, background: '#fff', borderTop: '1px solid #e6e0da', padding: 16}}>
        <button className="btn" onClick={placeOrder} disabled={submitting}>
          {submitting ? 'Placing…' : paymentMethod === 'online' ? `Pay ₹${grandTotal} online` : 'Place order (Cash on Delivery)'}
        </button>
      </div>
    </div>
  );
}

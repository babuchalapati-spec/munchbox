import {useEffect, useState} from 'react';
import {useParams, useNavigate} from 'react-router-dom';
import client from '../api/client';

const STEPS = ['placed', 'confirmed', 'baking', 'heading_to_shop', 'out_for_delivery', 'delivered'];
const STATUS_LABELS = {
  placed: 'Placed', confirmed: 'Confirmed', baking: 'Baking',
  heading_to_shop: 'Partner heading to shop', out_for_delivery: 'Out for delivery',
  delivered: 'Delivered', cancelled: 'Cancelled',
};

function osmEmbedUrl(lat, lng) {
  const d = 0.008;
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

export default function OrderTracking() {
  const {id} = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [shopStars, setShopStars] = useState(0);
  const [deliveryStars, setDeliveryStars] = useState(0);

  async function load() {
    const {data} = await client.get(`/orders/${id}`);
    setOrder(data.order);
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function submitRating() {
    if (!shopStars) return alert('Tap a star to rate the shop');
    await client.put(`/orders/${id}/rate`, {shopStars, deliveryStars: order.assignedTo ? deliveryStars : undefined});
    load();
  }

  if (!order) return <div className="screen page-pad">Loading…</div>;
  const stepIndex = STEPS.indexOf(order.status);

  return (
    <div className="screen">
      <div className="top-bar">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <h2>Order #{order._id.slice(-6).toUpperCase()}</h2>
      </div>
      <div className="page-pad" style={{flex: 1}}>
        {order.status === 'cancelled' ? (
          <p className="error">This order was cancelled.</p>
        ) : (
          <div className="card">
            {STEPS.map((step, idx) => (
              <div key={step} style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, opacity: idx <= stepIndex ? 1 : 0.4}}>
                <div style={{width: 10, height: 10, borderRadius: 5, background: idx <= stepIndex ? '#c2185b' : '#e6e0da'}} />
                <span style={{fontWeight: idx <= stepIndex ? 700 : 400}}>{STATUS_LABELS[step]}</span>
              </div>
            ))}
          </div>
        )}

        {order.assignedTo && order.status !== 'cancelled' && (
          <button
            className="btn btn-outline"
            style={{marginBottom: 12}}
            onClick={() => navigate(`/orders/${order._id}/chat?title=${encodeURIComponent(order.assignedTo.name)}`)}
          >
            💬 Chat with {order.assignedTo.name}
          </button>
        )}

        {order.status === 'out_for_delivery' && order.deliveryCode && (
          <div className="card" style={{background: '#c2185b', color: '#fff', textAlign: 'center'}}>
            <div style={{fontSize: 12}}>Your delivery code</div>
            <div style={{fontSize: 30, fontWeight: 800, letterSpacing: 6, margin: '6px 0'}}>{order.deliveryCode}</div>
            <div style={{fontSize: 11}}>Share this with the delivery partner only when your order arrives.</div>
          </div>
        )}

        {order.status === 'out_for_delivery' && order.currentLocation && (
          <div className="card" style={{padding: 0, overflow: 'hidden'}}>
            <iframe
              title="live location"
              width="100%"
              height="220"
              style={{border: 0}}
              src={osmEmbedUrl(order.currentLocation.lat, order.currentLocation.lng)}
            />
          </div>
        )}

        {order.status === 'delivered' && !order.rating?.ratedAt && (
          <div className="card">
            <p style={{fontWeight: 700}}>Rate your order</p>
            <p className="muted">Shop</p>
            <div style={{fontSize: 24}}>
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} onClick={() => setShopStars(n)} style={{cursor: 'pointer'}}>{n <= shopStars ? '⭐' : '☆'}</span>
              ))}
            </div>
            {order.assignedTo && (
              <>
                <p className="muted">Delivery partner</p>
                <div style={{fontSize: 24}}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n} onClick={() => setDeliveryStars(n)} style={{cursor: 'pointer'}}>{n <= deliveryStars ? '⭐' : '☆'}</span>
                  ))}
                </div>
              </>
            )}
            <button className="btn" onClick={submitRating} style={{marginTop: 12}}>Submit rating</button>
          </div>
        )}

        <div className="card">
          {order.items.map((item, idx) => (
            <div key={idx} className="muted">{item.quantity}× {item.name}{item.weight ? ` (${item.weight})` : ''} — ₹{item.price}</div>
          ))}
          <div style={{marginTop: 8}}>{order.deliveryAddress}</div>
          <div style={{fontWeight: 800, marginTop: 8}}>Total: ₹{order.totalAmount}</div>
        </div>
      </div>
    </div>
  );
}

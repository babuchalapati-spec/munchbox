import {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import client from '../api/client';
import BottomNav from '../components/BottomNav';

const STATUS_LABELS = {
  placed: 'Placed',
  confirmed: 'Confirmed',
  baking: 'Baking',
  ready: 'Ready',
  heading_to_shop: 'Partner heading to shop',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/orders/mine').then(({data}) => setOrders(data.orders)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="screen">
      <div className="top-bar"><h2>My orders</h2></div>
      <div className="page-pad" style={{flex: 1}}>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="muted">No orders yet.</p>
        ) : (
          orders.map((o) => (
            <Link to={`/orders/${o._id}`} key={o._id} className="card" style={{display: 'block'}}>
              <div style={{display: 'flex', justifyContent: 'space-between'}}>
                <strong>{o.shop?.name || 'Order'}</strong>
                <span style={{fontWeight: 600}}>{STATUS_LABELS[o.status] || o.status}</span>
              </div>
              <div className="muted">{o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</div>
              <div className="muted">Total: ₹{o.totalAmount}</div>
            </Link>
          ))
        )}
      </div>
      <BottomNav />
    </div>
  );
}

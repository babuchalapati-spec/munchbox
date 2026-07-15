import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import client from '../api/client';

const STATUS_LABEL = {
  paid: '✅ Paid',
  pending: '⏳ Cash on delivery',
  failed: '❌ Failed',
  refunded: '↩️ Refunded',
};

// Every order is a "debit" from the customer's perspective; a refunded order shows as
// a credit — the same pattern shop/delivery partners already see for their balance.
export default function PaymentHistory() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/orders/mine').then(({data}) => setOrders(data.orders)).finally(() => setLoading(false));
  }, []);

  const totalPaid = orders.filter((o) => o.status !== 'cancelled').reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
  const totalOnline = orders
    .filter((o) => o.payment?.method === 'online' && o.payment?.status === 'paid')
    .reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);

  return (
    <div className="screen">
      <div className="top-bar">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <h2>Payment history</h2>
      </div>
      <div className="page-pad" style={{flex: 1}}>
        <div className="card">
          <div style={{display: 'flex', justifyContent: 'space-between'}}>
            <span style={{fontWeight: 700}}>Total spent</span>
            <span style={{fontWeight: 800, color: '#c2185b', fontSize: 20}}>₹{totalPaid.toFixed(2)}</span>
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between', marginTop: 4}}>
            <span className="muted">Paid online</span>
            <span className="muted">₹{totalOnline.toFixed(2)}</span>
          </div>
        </div>

        {loading ? (
          <p className="muted">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="muted">No payments yet.</p>
        ) : (
          orders.map((o) => (
            <div key={o._id} className="card" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
              <div>
                <div style={{fontWeight: 700}}>{o.shop?.name || (o.type === 'courier' ? 'Food pickup' : 'Order')}</div>
                <div className="muted">{new Date(o.createdAt).toLocaleDateString()} · {o.payment?.method === 'online' ? 'Online' : 'Cash on Delivery'}</div>
                <div style={{fontSize: 12, fontWeight: 600, marginTop: 4}}>{STATUS_LABEL[o.payment?.status] || o.payment?.status || 'pending'}</div>
              </div>
              <div style={{fontWeight: 800, color: o.payment?.status === 'refunded' ? '#2e7d32' : '#c62828'}}>
                {o.payment?.status === 'refunded' ? '+' : '-'}₹{Number(o.totalAmount || 0).toFixed(2)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

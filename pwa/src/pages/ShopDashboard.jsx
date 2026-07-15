import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import client from '../api/client';
import {useAuth} from '../context/AuthContext';

const NEXT_STATUS = {
  placed: {next: 'confirmed', label: 'Confirm order'},
  confirmed: {next: 'baking', label: 'Start baking / preparing'},
  baking: {next: 'ready', label: 'Mark ready for pickup'},
};

export default function ShopDashboard() {
  const {user, logout} = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [partners, setPartners] = useState([]);
  const [products, setProducts] = useState([]);
  const [assignPicks, setAssignPicks] = useState({});
  const [error, setError] = useState('');

  async function refresh() {
    try {
      const [ordersRes, partnersRes, productsRes] = await Promise.all([
        client.get('/orders'),
        client.get('/orders/delivery-partners'),
        client.get('/products', {params: {shop: user.shop}}),
      ]);
      setOrders(ordersRes.data.orders);
      setPartners(partnersRes.data.partners);
      setProducts(productsRes.data.products);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load shop data');
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function advance(order) {
    const step = NEXT_STATUS[order.status];
    if (!step) return;
    setError('');
    try {
      await client.put(`/orders/${order._id}/status`, {status: step.next});
      refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update status');
    }
  }

  async function assign(order) {
    const deliveryUserId = assignPicks[order._id];
    if (!deliveryUserId) return;
    setError('');
    try {
      await client.put(`/orders/${order._id}/assign`, {deliveryUserId});
      refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not assign delivery partner');
    }
  }

  async function toggleStock(product) {
    setError('');
    try {
      await client.put(`/products/${product._id}`, {available: !product.available});
      refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update stock');
    }
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="screen">
      <div className="top-bar">
        <h2>🏪 {user?.name}</h2>
        <button className="link" style={{margin: 0}} onClick={handleLogout}>Log out</button>
      </div>
      <div className="page-pad" style={{flex: 1}}>
        {error && <p className="error">{error}</p>}

        <h3>Orders ({orders.length})</h3>
        {orders.length === 0 ? (
          <p className="muted">No orders yet.</p>
        ) : (
          orders.map((order) => (
            <div key={order._id} className="card">
              <div style={{display: 'flex', justifyContent: 'space-between'}}>
                <strong>{order.user?.name || 'Customer'}</strong>
                <span style={{fontWeight: 600}}>{order.status}</span>
              </div>
              {order.items.map((item, idx) => (
                <div key={idx} className="muted">{item.quantity}× {item.name}</div>
              ))}
              <div className="muted">Total: ₹{order.totalAmount} · {order.payment?.method === 'online' ? `Online (${order.payment.status})` : 'Cash on Delivery'}</div>
              <div className="muted">Deliver to: {order.deliveryAddress}</div>

              {NEXT_STATUS[order.status] && (
                <button className="btn" style={{marginTop: 8}} onClick={() => advance(order)}>{NEXT_STATUS[order.status].label}</button>
              )}

              {order.status === 'ready' && !order.assignedTo && (
                <div style={{display: 'flex', gap: 8, marginTop: 8}}>
                  <select
                    className="input"
                    style={{marginBottom: 0}}
                    value={assignPicks[order._id] || ''}
                    onChange={(e) => setAssignPicks((s) => ({...s, [order._id]: e.target.value}))}
                  >
                    <option value="">Choose delivery partner</option>
                    {partners.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                  <button className="btn" style={{width: 'auto', flex: '0 0 auto', padding: '0 14px'}} onClick={() => assign(order)}>Assign</button>
                </div>
              )}
              {order.assignedTo && <div className="muted" style={{marginTop: 6}}>🛵 Assigned: {order.assignedTo.name}</div>}
            </div>
          ))
        )}

        <h3 style={{marginTop: 20}}>Menu items — toggle stock ({products.length})</h3>
        {products.map((p) => (
          <div key={p._id} className="card" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <div><strong>{p.name}</strong> <span className="muted">₹{p.basePrice}</span></div>
            <button className="btn" style={{width: 'auto', flex: '0 0 auto', padding: '8px 12px', background: p.available ? '#2e7d32' : '#c62828'}} onClick={() => toggleStock(p)}>
              {p.available ? '✅ In stock' : '⏸️ Out of stock'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

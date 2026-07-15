import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import client from '../api/client';
import {useAuth} from '../context/AuthContext';

export default function DeliveryDashboard() {
  const {user, logout} = useAuth();
  const navigate = useNavigate();
  const [available, setAvailable] = useState([]);
  const [assigned, setAssigned] = useState([]);
  const [pickupCodeInputs, setPickupCodeInputs] = useState({});
  const [deliveryCodeInputs, setDeliveryCodeInputs] = useState({});
  const [error, setError] = useState('');

  async function refresh() {
    try {
      const [availableRes, assignedRes] = await Promise.all([
        client.get('/orders/available'),
        client.get('/orders/assigned'),
      ]);
      setAvailable(availableRes.data.available);
      setAssigned(assignedRes.data.orders);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load orders');
    }
  }

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 15000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function claim(id) {
    setError('');
    try {
      await client.put(`/orders/${id}/claim`);
      refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not claim — it may have just been taken.');
    }
  }

  async function advanceToHeadingToShop(order) {
    setError('');
    try {
      await client.put(`/orders/${order._id}/status`, {status: 'heading_to_shop'});
      refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update status');
    }
  }

  async function confirmPickup(order) {
    setError('');
    try {
      await client.put(`/orders/${order._id}/pickup`, {code: pickupCodeInputs[order._id] || ''});
      refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Incorrect pickup code');
    }
  }

  function pushLocation(order) {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        await client.put(`/orders/${order._id}/location`, {lat: pos.coords.latitude, lng: pos.coords.longitude});
        refresh();
      } catch (err) {
        setError('Could not push location');
      }
    });
  }

  async function confirmDelivery(order) {
    setError('');
    try {
      await client.put(`/orders/${order._id}/deliver`, {code: deliveryCodeInputs[order._id] || ''});
      refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Incorrect delivery code');
    }
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="screen">
      <div className="top-bar">
        <h2>🛵 {user?.name}</h2>
        <button className="link" style={{margin: 0}} onClick={handleLogout}>Log out</button>
      </div>
      <div className="page-pad" style={{flex: 1}}>
        {error && <p className="error">{error}</p>}

        <h3>Nearby available deliveries ({available.length})</h3>
        {available.length === 0 ? (
          <p className="muted">Nothing available right now.</p>
        ) : (
          available.map((order) => (
            <div key={order._id} className="card">
              <strong>{order.type === 'courier' ? '🛵 Food pickup' : `🏪 ${order.shop?.name || 'Shop'}`}</strong>
              {order.distanceToPickup != null && <span className="muted"> · {order.distanceToPickup} km away</span>}
              <div className="muted">Drop: {order.deliveryAddress}</div>
              <div className="muted">Delivery fee ₹{order.deliveryFee ?? 0}</div>
              <button className="btn" style={{marginTop: 8}} onClick={() => claim(order._id)}>Pick this delivery</button>
            </div>
          ))
        )}

        <h3 style={{marginTop: 20}}>My deliveries ({assigned.length})</h3>
        {assigned.length === 0 ? (
          <p className="muted">Nothing claimed yet.</p>
        ) : (
          assigned.map((order) => (
            <div key={order._id} className="card">
              <div style={{display: 'flex', justifyContent: 'space-between'}}>
                <strong>{order.shop?.name || order.pickupAddress || 'Order'}</strong>
                <span>{order.status}</span>
              </div>
              <div className="muted">Customer: {order.user?.name} · {order.user?.phone || order.phone}</div>
              <div className="muted">Drop: {order.deliveryAddress}</div>

              {['confirmed', 'baking', 'ready'].includes(order.status) && (
                <button className="btn" style={{marginTop: 8}} onClick={() => advanceToHeadingToShop(order)}>🛵 Heading to shop</button>
              )}

              {order.status === 'heading_to_shop' && (
                <div style={{display: 'flex', gap: 8, marginTop: 8}}>
                  <input className="input" style={{marginBottom: 0}} placeholder="6-digit pickup code" maxLength={6}
                    value={pickupCodeInputs[order._id] || ''}
                    onChange={(e) => setPickupCodeInputs((s) => ({...s, [order._id]: e.target.value}))} />
                  <button className="btn" style={{width: 'auto', flex: '0 0 auto', padding: '0 14px'}} onClick={() => confirmPickup(order)}>Confirm</button>
                </div>
              )}

              {order.status === 'out_for_delivery' && (
                <>
                  <button className="btn btn-outline" style={{marginTop: 8}} onClick={() => pushLocation(order)}>📍 Push my location</button>
                  <div style={{display: 'flex', gap: 8, marginTop: 8}}>
                    <input className="input" style={{marginBottom: 0}} placeholder="6-digit delivery code" maxLength={6}
                      value={deliveryCodeInputs[order._id] || ''}
                      onChange={(e) => setDeliveryCodeInputs((s) => ({...s, [order._id]: e.target.value}))} />
                    <button className="btn" style={{width: 'auto', flex: '0 0 auto', padding: '0 14px'}} onClick={() => confirmDelivery(order)}>Confirm</button>
                  </div>
                </>
              )}

              {order.status === 'delivered' && <div style={{color: '#2e7d32', fontWeight: 700, marginTop: 8}}>✓ Delivered</div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

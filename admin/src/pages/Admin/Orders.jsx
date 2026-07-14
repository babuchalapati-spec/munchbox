import { useEffect, useState } from 'react';
import { listOrders, updateOrderStatus, updateOrderLocation, assignDelivery, listDeliveryPartners } from '../../api/orders';
import LiveTrackingMap from '../../components/LiveTrackingMap';

const STATUSES = ['placed', 'confirmed', 'baking', 'heading_to_shop', 'out_for_delivery', 'delivered', 'cancelled'];

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [deliveryAccounts, setDeliveryAccounts] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [locationDrafts, setLocationDrafts] = useState({});
  const [loadError, setLoadError] = useState('');

  async function refresh() {
    setLoading(true);
    setLoadError('');
    try {
      const [ordersData, deliveryData] = await Promise.all([
        listOrders(statusFilter || undefined),
        listDeliveryPartners(),
      ]);
      setOrders(ordersData);
      setDeliveryAccounts(deliveryData);
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Could not load orders');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [statusFilter]);

  async function handleStatusChange(id, status) {
    const updated = await updateOrderStatus(id, status);
    setOrders((prev) => prev.map((o) => (o._id === id ? updated : o)));
  }

  async function handleAssign(id, deliveryUserId) {
    if (!deliveryUserId) return;
    const updated = await assignDelivery(id, deliveryUserId);
    setOrders((prev) => prev.map((o) => (o._id === id ? updated : o)));
  }

  function handleLocationDraftChange(id, field, value) {
    setLocationDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }

  async function handlePushLocation(id) {
    const draft = locationDrafts[id];
    if (!draft?.lat || !draft?.lng) return;
    const updated = await updateOrderLocation(id, Number(draft.lat), Number(draft.lng));
    setOrders((prev) => prev.map((o) => (o._id === id ? updated : o)));
  }

  function useMyLocation(id) {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      setLocationDrafts((prev) => ({
        ...prev,
        [id]: { lat: latitude, lng: longitude },
      }));
    });
  }

  return (
    <div>
      <h1>Orders</h1>
      {loadError && <p className="error">{loadError}</p>}

      <div className="filters">
        <label>
          Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : orders.length === 0 ? (
        <p>No orders found.</p>
      ) : (
        <div className="order-list">
          {orders.map((order) => (
            <div className="card order-card" key={order._id}>
              <div className="order-card-header">
                <div>
                  <strong>{order.user?.name || 'Customer'}</strong>
                  <span className="muted"> · {order.user?.phone || order.phone}</span>
                  {order.type === 'courier' ? (
                    <span className="muted"> · 🛵 Food pickup</span>
                  ) : order.shop?.name ? (
                    <span className="muted"> · 🏪 {order.shop.name}</span>
                  ) : null}
                </div>
                <span className={`status-badge status-${order.status}`}>{order.status}</span>
              </div>
              {order.type === 'courier' && (
                <p className="muted">Pickup: {order.pickupAddress} → Drop: {order.deliveryAddress}</p>
              )}

              <ul className="order-items">
                {order.items.map((item, idx) => (
                  <li key={idx}>
                    {item.quantity}× {item.name}
                    {item.weight ? ` (${item.weight})` : ''} — ₹{item.price}
                  </li>
                ))}
              </ul>

              <p className="muted">{order.deliveryAddress}</p>
              <p className="muted">
                Delivery: {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : '—'}
                {order.deliverySlot ? ` · ${order.deliverySlot}` : ''}
              </p>
              <p className="muted">
                Items ₹{order.itemsTotal ?? order.totalAmount} + delivery ₹{order.deliveryFee ?? 0}
                {order.distanceKm ? ` (${order.distanceKm} km)` : ''}
              </p>
              <p>
                <strong>Total: ₹{order.totalAmount}</strong>
              </p>

              <div className="order-actions">
                <label>
                  Status
                  <select value={order.status} onChange={(e) => handleStatusChange(order._id, e.target.value)}>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Delivery partner
                  <select value={order.assignedTo?._id || ''} onChange={(e) => handleAssign(order._id, e.target.value)}>
                    <option value="">Unassigned</option>
                    {deliveryAccounts.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {order.status === 'heading_to_shop' && (
                <div className="location-tracker">
                  <LiveTrackingMap order={order} />
                  <p className="muted">
                    Pickup code — give to delivery partner: <strong>{order.pickupCode || '—'}</strong>
                  </p>
                </div>
              )}

              {order.status === 'out_for_delivery' && (
                <div className="location-tracker">
                  <LiveTrackingMap order={order} />
                  <p className="muted">
                    Manual override (normally the delivery partner's app sends this automatically):
                  </p>
                  <div className="location-inputs">
                    <input
                      type="number"
                      step="any"
                      placeholder="lat"
                      value={locationDrafts[order._id]?.lat ?? ''}
                      onChange={(e) => handleLocationDraftChange(order._id, 'lat', e.target.value)}
                    />
                    <input
                      type="number"
                      step="any"
                      placeholder="lng"
                      value={locationDrafts[order._id]?.lng ?? ''}
                      onChange={(e) => handleLocationDraftChange(order._id, 'lng', e.target.value)}
                    />
                    <button type="button" onClick={() => useMyLocation(order._id)}>
                      Use my location
                    </button>
                    <button type="button" onClick={() => handlePushLocation(order._id)}>
                      Update GPS
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

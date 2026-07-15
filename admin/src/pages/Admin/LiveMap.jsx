import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { listOrders } from '../../api/orders';
import { listShops } from '../../api/shops';

const ACTIVE_STATUSES = ['confirmed', 'baking', 'ready', 'heading_to_shop', 'out_for_delivery'];

// Colored circle markers (no external icon images needed, so nothing to fetch/break).
function dot(color) {
  return L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 3px rgba(0,0,0,0.5)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}
const SHOP_ICON = dot('#1565c0');
const CUSTOMER_ICON = dot('#2e7d32');
const PARTNER_ICON = dot('#ef6c00');

// Live map for the admin: every shop (blue), the customer delivery address and
// assigned delivery partner's current GPS position for each active order (green /
// orange, moving) — all on one free OpenStreetMap view, refreshed every 15s. No API
// key needed (unlike Google Maps, which required billing setup nobody wanted to do).
export default function LiveMap() {
  const [orders, setOrders] = useState([]);
  const [shops, setShops] = useState([]);
  const [error, setError] = useState('');
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    mapInstance.current = L.map(mapRef.current).setView([17.385, 78.4867], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(mapInstance.current);
    return () => {
      mapInstance.current.remove();
      mapInstance.current = null;
    };
  }, []);

  async function refresh() {
    try {
      const [allOrders, allShops] = await Promise.all([listOrders(), listShops()]);
      setOrders(allOrders.filter((o) => ACTIVE_STATUSES.includes(o.status)));
      setShops(allShops);
    } catch (err) {
      setError('Could not load live map data');
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapInstance.current) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const points = [];

    shops.forEach((shop) => {
      if (shop.location?.lat == null) return;
      const pos = [shop.location.lat, shop.location.lng];
      const marker = L.marker(pos, { icon: SHOP_ICON }).addTo(mapInstance.current)
        .bindPopup(`🏪 <strong>${shop.name}</strong><br/>${shop.category || ''}`);
      markersRef.current.push(marker);
      points.push(pos);
    });

    orders.forEach((order) => {
      if (order.deliveryLocation?.lat != null) {
        const pos = [order.deliveryLocation.lat, order.deliveryLocation.lng];
        const marker = L.marker(pos, { icon: CUSTOMER_ICON }).addTo(mapInstance.current)
          .bindPopup(`📍 <strong>${order.user?.name || 'Customer'}</strong><br/>Order #${order._id.slice(-6).toUpperCase()}`);
        markersRef.current.push(marker);
        points.push(pos);
      }
      if (order.currentLocation?.lat != null) {
        const pos = [order.currentLocation.lat, order.currentLocation.lng];
        const marker = L.marker(pos, { icon: PARTNER_ICON }).addTo(mapInstance.current)
          .bindPopup(`🛵 <strong>${order.assignedTo?.name || 'Delivery partner'}</strong><br/>Order #${order._id.slice(-6).toUpperCase()}`);
        markersRef.current.push(marker);
        points.push(pos);
      }
    });

    if (points.length) {
      mapInstance.current.fitBounds(points, { padding: [30, 30], maxZoom: 15 });
    }
  }, [orders, shops]);

  return (
    <div>
      <h1>🗺️ Live map</h1>
      <p className="muted">
        Every shop (blue), customer delivery addresses (green) and delivery partners currently en route (orange) — all
        in one place, refreshing every 15 seconds. {shops.length} shop{shops.length === 1 ? '' : 's'} ·{' '}
        {orders.length} active order{orders.length === 1 ? '' : 's'}.
      </p>
      {error && <p className="error">{error}</p>}
      <div ref={mapRef} style={{ width: '100%', height: '70vh', borderRadius: 10, overflow: 'hidden' }} />
    </div>
  );
}

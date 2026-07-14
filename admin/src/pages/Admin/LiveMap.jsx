import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSettings } from '../../api/settings';
import { listOrders } from '../../api/orders';

const ACTIVE_STATUSES = ['confirmed', 'baking', 'ready', 'heading_to_shop', 'out_for_delivery'];

function loadGoogleMaps(apiKey) {
  if (window.google?.maps) return Promise.resolve();
  if (window.__mapsLoadingPromise) return window.__mapsLoadingPromise;
  window.__mapsLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Could not load Google Maps — check the API key in Settings.'));
    document.head.appendChild(script);
  });
  return window.__mapsLoadingPromise;
}

// Live map for the admin: plots every shop with an active order (blue), the customer
// delivery address (green), and the assigned delivery partner's current GPS position
// (orange, moving) on one map — refreshes every 15s. Google Maps only runs here, in the
// admin web dashboard; the mobile apps use OpenStreetMap and need no API key.
export default function LiveMap() {
  const [apiKey, setApiKey] = useState('');
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [mapError, setMapError] = useState('');
  const [orders, setOrders] = useState([]);
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    getSettings()
      .then((s) => setApiKey(s.maps?.googleMapsApiKey || ''))
      .catch(() => setMapError('Could not load settings'))
      .finally(() => setLoadingSettings(false));
  }, []);

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !mapRef.current) return;
        mapInstance.current = new window.google.maps.Map(mapRef.current, {
          center: { lat: 17.385, lng: 78.4867 }, // recentres once real markers load
          zoom: 12,
        });
      })
      .catch((err) => setMapError(err.message));
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  async function refresh() {
    try {
      const all = await listOrders();
      setOrders(all.filter((o) => ACTIVE_STATUSES.includes(o.status)));
    } catch (err) {
      setMapError('Could not load orders');
    }
  }

  useEffect(() => {
    if (!apiKey) return;
    refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  useEffect(() => {
    if (!mapInstance.current || !window.google?.maps) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const bounds = new window.google.maps.LatLngBounds();
    let any = false;

    orders.forEach((order) => {
      if (order.shop?.location?.lat != null) {
        const pos = { lat: order.shop.location.lat, lng: order.shop.location.lng };
        markersRef.current.push(
          new window.google.maps.Marker({
            position: pos,
            map: mapInstance.current,
            title: `🏪 ${order.shop.name}`,
            icon: { url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png' },
          })
        );
        bounds.extend(pos);
        any = true;
      }
      if (order.deliveryLocation?.lat != null) {
        const pos = { lat: order.deliveryLocation.lat, lng: order.deliveryLocation.lng };
        markersRef.current.push(
          new window.google.maps.Marker({
            position: pos,
            map: mapInstance.current,
            title: `📍 Customer: ${order.user?.name || 'Delivery address'}`,
            icon: { url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png' },
          })
        );
        bounds.extend(pos);
        any = true;
      }
      if (order.currentLocation?.lat != null) {
        const pos = { lat: order.currentLocation.lat, lng: order.currentLocation.lng };
        markersRef.current.push(
          new window.google.maps.Marker({
            position: pos,
            map: mapInstance.current,
            title: `🛵 ${order.assignedTo?.name || 'Delivery partner'} — order #${order._id.slice(-6).toUpperCase()}`,
            icon: { url: 'https://maps.google.com/mapfiles/ms/icons/orange-dot.png' },
          })
        );
        bounds.extend(pos);
        any = true;
      }
    });

    if (any) mapInstance.current.fitBounds(bounds);
  }, [orders]);

  if (loadingSettings) return <p>Loading...</p>;

  return (
    <div>
      <h1>🗺️ Live map</h1>
      <p className="muted">
        Shops (blue), customer delivery addresses (green), and delivery partners currently en route (orange) — refreshes
        every 15 seconds. Showing {orders.length} active order{orders.length === 1 ? '' : 's'}.
      </p>
      {mapError && <p className="error">{mapError}</p>}

      {!apiKey ? (
        <div className="card">
          <p>No Google Maps API key configured yet.</p>
          <Link to="/admin/settings">Add one in Settings →</Link>
        </div>
      ) : (
        <div ref={mapRef} style={{ width: '100%', height: '70vh', borderRadius: 10, overflow: 'hidden' }} />
      )}
    </div>
  );
}

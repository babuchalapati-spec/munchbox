import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { listOrders } from '../../api/orders';
import { listShops } from '../../api/shops';
import { getSettings } from '../../api/settings';

const ACTIVE_STATUSES = ['confirmed', 'baking', 'ready', 'heading_to_shop', 'out_for_delivery'];
const HYDERABAD = { lat: 17.385, lng: 78.4867 };
const GOOGLE_SCRIPT_ID = 'munchbox-google-maps';

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
const GOOGLE_COLORS = { shop: '#1565c0', customer: '#2e7d32', partner: '#ef6c00' };

function loadGoogleMaps(apiKey) {
  if (window.google?.maps) return Promise.resolve(window.google.maps);

  const existing = document.getElementById(GOOGLE_SCRIPT_ID);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(window.google.maps), { once: true });
      existing.addEventListener('error', reject, { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = GOOGLE_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.onload = () => resolve(window.google.maps);
    script.onerror = () => reject(new Error('Could not load Google Maps'));
    document.head.appendChild(script);
  });
}

function pointLabel(kind, title, detail) {
  const prefix = { shop: 'Shop', customer: 'Customer', partner: 'Delivery partner' }[kind];
  return `<strong>${prefix}: ${title}</strong>${detail ? `<br/>${detail}` : ''}`;
}

function removeMarker(marker) {
  if (marker?.setMap) marker.setMap(null);
  else if (marker?.remove) marker.remove();
}

export default function LiveMap() {
  const [orders, setOrders] = useState([]);
  const [shops, setShops] = useState([]);
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState('');
  const [provider, setProvider] = useState('leaflet');
  const [error, setError] = useState('');
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);

  async function refresh() {
    try {
      const [allOrders, allShops] = await Promise.all([listOrders(), listShops()]);
      setOrders(allOrders.filter((o) => ACTIVE_STATUSES.includes(o.status)));
      setShops(allShops);
    } catch (err) {
      setError('Could not load live map data from the database');
    }
  }

  useEffect(() => {
    getSettings()
      .then((settings) => setGoogleMapsApiKey((settings.maps?.googleMapsApiKey || '').trim()))
      .catch(() => setGoogleMapsApiKey(''));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      if (!mapRef.current) return;

      markersRef.current.forEach(removeMarker);
      markersRef.current = [];
      if (mapInstance.current?.remove) mapInstance.current.remove();
      mapInstance.current = null;
      mapRef.current.innerHTML = '';

      if (googleMapsApiKey) {
        try {
          const maps = await loadGoogleMaps(googleMapsApiKey);
          if (cancelled || !mapRef.current) return;
          mapInstance.current = new maps.Map(mapRef.current, {
            center: HYDERABAD,
            zoom: 12,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
          });
          setProvider('google');
          return;
        } catch (err) {
          setError('Google Maps key could not be loaded. Showing OpenStreetMap instead.');
        }
      }

      if (cancelled || !mapRef.current) return;
      mapInstance.current = L.map(mapRef.current).setView([HYDERABAD.lat, HYDERABAD.lng], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapInstance.current);
      setProvider('leaflet');
    }

    initMap();

    return () => {
      cancelled = true;
      markersRef.current.forEach(removeMarker);
      markersRef.current = [];
      if (mapInstance.current?.remove) mapInstance.current.remove();
      mapInstance.current = null;
      if (mapRef.current) mapRef.current.innerHTML = '';
    };
  }, [googleMapsApiKey]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!mapInstance.current) return;

    markersRef.current.forEach(removeMarker);
    markersRef.current = [];

    const points = [];

    function addPoint(kind, lat, lng, title, detail) {
      if (lat == null || lng == null) return;
      const position = { lat: Number(lat), lng: Number(lng) };
      if (!Number.isFinite(position.lat) || !Number.isFinite(position.lng)) return;
      points.push(position);

      if (provider === 'google') {
        const marker = new window.google.maps.Marker({
          position,
          map: mapInstance.current,
          title,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: GOOGLE_COLORS[kind],
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
          },
        });
        const info = new window.google.maps.InfoWindow({ content: pointLabel(kind, title, detail) });
        marker.addListener('click', () => info.open({ anchor: marker, map: mapInstance.current }));
        markersRef.current.push(marker);
        return;
      }

      const icon = kind === 'shop' ? SHOP_ICON : kind === 'customer' ? CUSTOMER_ICON : PARTNER_ICON;
      const marker = L.marker([position.lat, position.lng], { icon }).addTo(mapInstance.current)
        .bindPopup(pointLabel(kind, title, detail));
      markersRef.current.push(marker);
    }

    shops.forEach((shop) => {
      addPoint('shop', shop.location?.lat, shop.location?.lng, shop.name, shop.category || shop.address || '');
    });

    orders.forEach((order) => {
      const code = `Order #${order._id.slice(-6).toUpperCase()}`;
      addPoint('customer', order.deliveryLocation?.lat, order.deliveryLocation?.lng, order.user?.name || 'Customer', code);
      addPoint('partner', order.currentLocation?.lat, order.currentLocation?.lng, order.assignedTo?.name || 'Delivery partner', code);
    });

    if (!points.length) return;

    if (provider === 'google') {
      const bounds = new window.google.maps.LatLngBounds();
      points.forEach((point) => bounds.extend(point));
      mapInstance.current.fitBounds(bounds, 30);
    } else {
      mapInstance.current.fitBounds(points.map((p) => [p.lat, p.lng]), { padding: [30, 30], maxZoom: 15 });
    }
  }, [orders, shops, provider]);

  return (
    <div>
      <h1>Live map</h1>
      <p className="muted">
        Database locations for shops (blue), customer delivery addresses (green), and delivery partners currently en
        route (orange). Using {provider === 'google' ? 'Google Maps from the saved API key' : 'OpenStreetMap fallback'}.
        {' '}{shops.length} shop{shops.length === 1 ? '' : 's'} · {orders.length} active order{orders.length === 1 ? '' : 's'}.
      </p>
      {error && <p className="error">{error}</p>}
      <div ref={mapRef} style={{ width: '100%', height: '70vh', borderRadius: 10, overflow: 'hidden' }} />
    </div>
  );
}

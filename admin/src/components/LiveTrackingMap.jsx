import { useState } from 'react';
import { getOrderEta } from '../api/orders';

// OpenStreetMap's embeddable map with a marker — no API key needed, the same
// key-free embed the mobile customer/delivery-partner screens already use.
function osmEmbedUrl(lat, lng) {
  const d = 0.008; // bounding-box padding (~1km)
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

// Live position of the delivery partner for one order, with an on-demand ETA —
// shown to both admin and shop on the Orders page.
export default function LiveTrackingMap({ order }) {
  const [eta, setEta] = useState(null);
  const [loadingEta, setLoadingEta] = useState(false);

  async function refreshEta() {
    setLoadingEta(true);
    try {
      const data = await getOrderEta(order._id);
      setEta(data);
    } catch (err) {
      // ETA is best-effort — leave the last known value in place on failure
    } finally {
      setLoadingEta(false);
    }
  }

  if (!order.currentLocation) {
    return <p className="muted">Waiting for the delivery partner's location...</p>;
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <iframe
        title={`Live location for order ${order._id}`}
        src={osmEmbedUrl(order.currentLocation.lat, order.currentLocation.lng)}
        style={{ width: '100%', maxWidth: 400, height: 200, border: 0, borderRadius: 8 }}
      />
      <p className="muted">Last updated: {new Date(order.currentLocation.updatedAt).toLocaleTimeString()}</p>
      <button type="button" onClick={refreshEta} disabled={loadingEta}>
        {loadingEta
          ? 'Calculating...'
          : eta
            ? `📍 ${eta.distanceKm} km · ETA ~${eta.etaMinutes} min${eta.estimated ? ' (estimated)' : ''} — refresh`
            : 'Get ETA'}
      </button>
    </div>
  );
}

const https = require('https');

// Great-circle distance between two lat/lng points, in kilometres.
function haversineKm(a, b) {
  if (!a || !b) return 0;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(Number(b.lat) - Number(a.lat));
  const dLng = toRad(Number(b.lng) - Number(a.lng));
  const lat1 = toRad(Number(a.lat));
  const lat2 = toRad(Number(b.lat));
  let h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  h = Math.min(1, Math.max(0, h));
  return 2 * R * Math.asin(Math.sqrt(h));
}

function getGoogleRoadDistance(origin, destination) {
  return new Promise((resolve) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      resolve(null);
      return;
    }

    const originText = `${origin.lat},${origin.lng}`;
    const destinationText = `${destination.lat},${destination.lng}`;
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(originText)}&destination=${encodeURIComponent(destinationText)}&mode=driving&key=${apiKey}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const route = parsed.routes && parsed.routes[0];
          const leg = route && route.legs && route.legs[0];
          if (leg && typeof leg.distance?.value === 'number') {
            resolve(leg.distance.value / 1000);
          } else {
            resolve(null);
          }
        } catch (err) {
          resolve(null);
        }
      });
    }).on('error', () => {
      resolve(null);
    });
  });
}

// Real road-based ETA (distance + driving duration) between two points via Google
// Directions API. Returns null if no API key is configured or the call fails, so
// callers can fall back to a straight-line estimate.
function getGoogleRoute(origin, destination) {
  return new Promise((resolve) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      resolve(null);
      return;
    }

    const originText = `${origin.lat},${origin.lng}`;
    const destinationText = `${destination.lat},${destination.lng}`;
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(originText)}&destination=${encodeURIComponent(destinationText)}&mode=driving&key=${apiKey}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const route = parsed.routes && parsed.routes[0];
          const leg = route && route.legs && route.legs[0];
          if (leg && typeof leg.distance?.value === 'number' && typeof leg.duration?.value === 'number') {
            resolve({ distanceKm: leg.distance.value / 1000, durationMinutes: leg.duration.value / 60 });
          } else {
            resolve(null);
          }
        } catch (err) {
          resolve(null);
        }
      });
    }).on('error', () => {
      resolve(null);
    });
  });
}

// ETA to show the shop/customer for a moving delivery partner. Prefers real road-based
// duration; falls back to a straight-line distance / assumed city speed when no Google
// Maps API key is configured (or the call fails), so the UI still works either way.
const FALLBACK_SPEED_KMH = 20;
async function getEta(origin, destination) {
  const route = await getGoogleRoute(origin, destination);
  if (route) {
    return {
      distanceKm: Math.round(route.distanceKm * 100) / 100,
      etaMinutes: Math.max(1, Math.round(route.durationMinutes)),
      estimated: false,
    };
  }
  const distanceKm = haversineKm(origin, destination);
  return {
    distanceKm: Math.round(distanceKm * 100) / 100,
    etaMinutes: Math.max(1, Math.round((distanceKm / FALLBACK_SPEED_KMH) * 60)),
    estimated: true,
  };
}

async function computeDeliveryFee(shopLocation, deliveryLocation, perKmRate) {
  const fallbackKm = haversineKm(shopLocation, deliveryLocation);
  const roadKm = await getGoogleRoadDistance(shopLocation, deliveryLocation);
  const rawKm = Number.isFinite(roadKm) && roadKm > 0 ? roadKm : fallbackKm;
  const billedKm = Math.max(rawKm, 1);
  const fee = Math.round(billedKm * perKmRate);
  return { distanceKm: Math.round(rawKm * 100) / 100, deliveryFee: fee };
}

module.exports = { haversineKm, getGoogleRoadDistance, computeDeliveryFee, getEta };

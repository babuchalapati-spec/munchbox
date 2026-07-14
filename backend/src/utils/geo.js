// Address <-> coordinates mapping using OpenStreetMap's Nominatim (free, no API key).
// Used so a shop's/customer's typed address maps to the RIGHT point on the map, instead
// of garbage coordinates producing absurd distances and delivery fees.

const NOMINATIM = 'https://nominatim.openstreetmap.org';
// Nominatim requires an identifying User-Agent.
const HEADERS = { 'User-Agent': 'Munchbox/1.0 (delivery app)' };

function isValidLatLng(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  return (
    Number.isFinite(la) &&
    Number.isFinite(ln) &&
    la >= -90 &&
    la <= 90 &&
    ln >= -180 &&
    ln <= 180 &&
    !(la === 0 && ln === 0) // 0,0 is the ocean — treat as "not set"
  );
}

// Search an address and return candidate matches the user can pick from.
async function searchAddress(query, limit = 5) {
  if (!query || !query.trim()) return [];
  const url =
    `${NOMINATIM}/search?format=json&addressdetails=1&limit=${limit}` +
    `&countrycodes=in&q=${encodeURIComponent(query.trim())}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return [];
  const rows = await res.json();
  return rows
    .map((r) => ({
      label: r.display_name,
      lat: Number(r.lat),
      lng: Number(r.lon),
    }))
    .filter((r) => isValidLatLng(r.lat, r.lng));
}

// Best-effort single match for an address (first result), or null.
async function geocode(query) {
  const results = await searchAddress(query, 1);
  return results[0] || null;
}

// Coordinates -> a human-readable address.
async function reverseGeocode(lat, lng) {
  if (!isValidLatLng(lat, lng)) return null;
  const url = `${NOMINATIM}/reverse?format=json&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.display_name ? { label: data.display_name, lat: Number(lat), lng: Number(lng) } : null;
}

module.exports = { searchAddress, geocode, reverseGeocode, isValidLatLng };

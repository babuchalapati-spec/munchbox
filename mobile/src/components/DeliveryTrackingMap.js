import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { getOrder, getOrderEta } from '../api/orders';
import { colors } from '../theme';

// OpenStreetMap's embeddable map with a marker — no API key needed, the same
// key-free embed the customer/delivery-partner tracking screens already use.
function osmEmbedUrl(lat, lng) {
  const d = 0.008; // bounding-box padding (~1km)
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

// Live map of the delivery partner's position for one order, polled every 10s —
// shown inside the shop owner's order card while a partner is heading to the shop
// or out for delivery, so the shop can see where they are and the ETA.
export default function DeliveryTrackingMap({ orderId }) {
  const [location, setLocation] = useState(null);
  const [eta, setEta] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const [order, etaData] = await Promise.all([getOrder(orderId), getOrderEta(orderId)]);
        if (cancelled) return;
        setLocation(order.currentLocation || null);
        setEta(etaData);
      } catch (err) {
        // ignore — retried on the next tick
      }
    }
    poll();
    pollRef.current = setInterval(poll, 10000);
    return () => {
      cancelled = true;
      clearInterval(pollRef.current);
    };
  }, [orderId]);

  if (!location) {
    return <Text style={styles.waiting}>Waiting for the delivery partner's location...</Text>;
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.map}>
        <WebView source={{ uri: osmEmbedUrl(location.lat, location.lng) }} style={{ flex: 1 }} scrollEnabled={false} />
      </View>
      <Text style={styles.eta}>
        {eta
          ? `📍 ${eta.distanceKm} km away · ETA ~${eta.etaMinutes} min${eta.estimated ? ' (estimated)' : ''}`
          : 'Calculating ETA...'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8 },
  map: { width: '100%', height: 160, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.border },
  waiting: { color: colors.muted, fontSize: 12, marginTop: 8 },
  eta: { color: colors.text, fontSize: 12, fontWeight: '600', marginTop: 6 },
});

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getOrder, getOrderEta } from '../api/orders';
import BikeMap from './BikeMap';
import { colors } from '../theme';

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
      <BikeMap bike={location} height={160} />
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
  waiting: { color: colors.muted, fontSize: 12, marginTop: 8 },
  eta: { color: colors.text, fontSize: 12, fontWeight: '600', marginTop: 6 },
});

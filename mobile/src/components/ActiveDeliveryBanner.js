import React, { useEffect, useRef, useState } from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { listMyOrders } from '../api/orders';
import { colors } from '../theme';

// Sticky highlight above the tab bar: appears whenever one of the user's orders
// is out for delivery, and taps through to the live tracking screen.
export default function ActiveDeliveryBanner({ navigation }) {
  const [active, setActive] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    async function poll() {
      try {
        const orders = await listMyOrders();
        const out = orders.find((o) => o.status === 'out_for_delivery');
        if (mountedRef.current) setActive(out || null);
      } catch (err) {
        // ignore transient errors; try again next tick
      }
    }
    poll();
    const id = setInterval(poll, 10000);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, []);

  if (!active) return null;

  const partner = active.assignedTo?.name;
  const hasLocation = Boolean(active.currentLocation);

  return (
    <TouchableOpacity
      style={styles.banner}
      activeOpacity={0.85}
      onPress={() => navigation.navigate('OrderTracking', { orderId: active._id })}
    >
      <View style={styles.pulse} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Your order is on the way 🛵</Text>
        <Text style={styles.sub}>
          {partner ? `${partner} · ` : ''}
          {hasLocation ? 'live location updating' : 'starting soon'} · tap to track
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  pulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
  title: { color: '#fff', fontWeight: '700', fontSize: 14 },
  sub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 1 },
  chevron: { color: '#fff', fontSize: 26, fontWeight: '300' },
});

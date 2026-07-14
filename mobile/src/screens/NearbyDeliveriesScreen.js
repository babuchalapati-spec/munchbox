import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
import { listAvailableOrders, claimOrder } from '../api/orders';
import { requestLocationPermission, getCurrentPosition } from '../location';
import { colors } from '../theme';

function pickupOf(o) {
  if (o.type === 'courier') return { label: o.pickupAddress, loc: o.pickupLocation };
  return { label: o.shop?.name || 'Shop', loc: o.shop?.location, address: o.shop?.address };
}

export default function NearbyDeliveriesScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    let here = coords;
    try {
      const granted = await requestLocationPermission();
      if (granted) {
        here = await getCurrentPosition();
        setCoords(here);
      }
    } catch (e) {
      // fall back to unsorted list if location unavailable
    }
    const data = await listAvailableOrders(here?.lat, here?.lng);
    setOrders(data);
  }, [coords]);

  useEffect(() => {
    load()
      .catch((e) => setError(e.response?.data?.message || 'Could not load nearby deliveries'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load().catch((e) => setError(e.response?.data?.message || 'Could not refresh'));
    setRefreshing(false);
  }

  async function pick(order) {
    try {
      await claimOrder(order._id);
      setOrders((prev) => prev.filter((o) => o._id !== order._id));
      Alert.alert('Delivery picked', 'It has been added to "My deliveries".', [
        { text: 'View', onPress: () => navigation.navigate('DeliveryOrderDetail', { orderId: order._id }) },
        { text: 'OK' },
      ]);
    } catch (err) {
      Alert.alert('Could not pick', err.response?.data?.message || 'It may have been taken already.');
      onRefresh();
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Nearby deliveries</Text>
        <TouchableOpacity onPress={() => navigation.navigate('DeliveryOrders')}>
          <Text style={styles.headerLink}>My deliveries ›</Text>
        </TouchableOpacity>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        contentContainerStyle={styles.list}
        data={orders}
        keyExtractor={(o) => o._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>No deliveries available right now. Pull to refresh.</Text>}
        renderItem={({ item }) => {
          const p = pickupOf(item);
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>
                  {item.type === 'courier' ? '🛵 Food pickup' : `🏪 ${p.label}`}
                </Text>
                {item.distanceToPickup != null && <Text style={styles.dist}>{item.distanceToPickup} km away</Text>}
              </View>
              <Text style={styles.meta}>Pick up: {p.label}{p.address ? ` · ${p.address}` : ''}</Text>
              <Text style={styles.meta}>Drop: {item.deliveryAddress}</Text>
              <Text style={styles.earn}>
                Delivery fee ₹{item.deliveryFee ?? 0}
                {item.tipAmount > 0 ? ` · 🎉 ₹${item.tipAmount} tip` : ''}
              </Text>

              <View style={styles.actions}>
                {p.loc?.lat != null && (
                  <TouchableOpacity
                    style={styles.mapBtn}
                    onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${p.loc.lat},${p.loc.lng}`)}
                  >
                    <Text style={styles.mapBtnText}>🗺 Navigate to pickup</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.pickBtn} onPress={() => pick(item)}>
                  <Text style={styles.pickBtnText}>Pick this delivery</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: {
    padding: 16,
    paddingTop: 24,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  headerLink: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  error: { color: '#c62828', padding: 12 },
  list: { padding: 16 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontWeight: '700', color: colors.text, flex: 1 },
  dist: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  meta: { fontSize: 12, color: colors.muted, marginTop: 4 },
  earn: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  mapBtn: { flex: 1, borderWidth: 1, borderColor: colors.primary, borderRadius: 8, padding: 10, alignItems: 'center' },
  mapBtnText: { color: colors.primary, fontWeight: '600', fontSize: 12 },
  pickBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: 8, padding: 10, alignItems: 'center' },
  pickBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },
});

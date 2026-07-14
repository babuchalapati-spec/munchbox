import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { listMyOrders } from '../api/orders';
import { colors } from '../theme';

const STATUS_LABELS = {
  placed: 'Placed',
  confirmed: 'Confirmed',
  baking: 'Baking',
  heading_to_shop: 'Picking up',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export default function OrdersScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await listMyOrders();
    setOrders(data);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (orders.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No orders yet.</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.buttonText}>Browse cakes</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.list}
      data={orders}
      keyExtractor={(o) => o._id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('OrderTracking', { orderId: item._id })}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              {item.type === 'courier' ? '🛵 Food pickup' : `Order #${item._id.slice(-6).toUpperCase()}`}
            </Text>
            <Text style={styles.status}>{STATUS_LABELS[item.status] || item.status}</Text>
          </View>
          <Text style={styles.cardMeta}>
            {item.type === 'courier' ? `${item.pickupAddress} → ${item.deliveryAddress}` : `${item.items.length} item(s)`} · ₹{item.totalAmount}
          </Text>
          {item.deliveryDate ? (
            <Text style={styles.cardMeta}>Delivery: {new Date(item.deliveryDate).toLocaleDateString()}</Text>
          ) : null}
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 24 },
  emptyText: { color: colors.muted, marginBottom: 16 },
  list: { padding: 16 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  cardTitle: { fontWeight: '700', color: colors.text },
  status: { fontSize: 12, fontWeight: '600', color: colors.primary },
  cardMeta: { fontSize: 12, color: colors.muted },
  button: { backgroundColor: colors.primary, borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
});

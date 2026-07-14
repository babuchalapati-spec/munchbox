import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { listAssignedOrders } from '../api/orders';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

const STATUS_LABELS = {
  placed: 'Placed',
  confirmed: 'Confirmed',
  baking: 'Baking',
  heading_to_shop: 'Heading to shop',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export default function DeliveryOrdersScreen({ navigation }) {
  const { logout, user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await listAssignedOrders();
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

  const kyc = user?.kyc?.status;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My deliveries</Text>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <TouchableOpacity onPress={() => navigation.navigate('NearbyDeliveries')}>
            <Text style={styles.headerLink}>Nearby</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Earnings')}>
            <Text style={styles.headerLink}>Earnings</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={logout}>
            <Text style={styles.headerLink}>Log out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {kyc === 'pending' && (
        <View style={[styles.kycBanner, { backgroundColor: '#a86b00' }]}>
          <Text style={styles.kycText}>⏳ Your documents are under review. You'll be able to take deliveries once verified.</Text>
        </View>
      )}
      {kyc === 'rejected' && (
        <View style={[styles.kycBanner, { backgroundColor: '#c62828' }]}>
          <Text style={styles.kycText}>
            ❌ Verification rejected{user?.kyc?.rejectionReason ? `: ${user.kyc.rejectionReason}` : ''}. Please contact
            support.
          </Text>
        </View>
      )}

      {orders.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No deliveries assigned yet.</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={orders}
          keyExtractor={(o) => o._id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('DeliveryOrderDetail', { orderId: item._id })}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Order #{item._id.slice(-6).toUpperCase()}</Text>
                <Text style={styles.status}>{STATUS_LABELS[item.status] || item.status}</Text>
              </View>
              <Text style={styles.cardMeta}>{item.user?.name} · {item.user?.phone || item.phone}</Text>
              <Text style={styles.cardMeta}>{item.deliveryAddress}</Text>
            </TouchableOpacity>
          )}
        />
      )}
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
  emptyText: { color: colors.muted },
  kycBanner: { padding: 12, marginHorizontal: 16, marginTop: 12, borderRadius: 8 },
  kycText: { color: '#fff', fontSize: 12, lineHeight: 17 },
  list: { padding: 16, gap: 12 },
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
});

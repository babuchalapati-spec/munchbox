import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { listAssignedOrders } from '../api/orders';
import { useAuth } from '../context/AuthContext';
import { colors, cardShadow } from '../theme';
import { statusMeta } from '../deliveryStatus';

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
        <View>
          <Text style={styles.headerGreeting}>Hi {user?.name?.split(' ')[0] || 'there'} 👋</Text>
          <Text style={styles.headerTitle}>My deliveries</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerChip} onPress={() => navigation.navigate('NearbyDeliveries')}>
            <Text style={styles.headerChipText}>🛵 Nearby</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerChip} onPress={() => navigation.navigate('Earnings')}>
            <Text style={styles.headerChipText}>💰 Earnings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerChip} onPress={() => navigation.navigate('DeliveryArea')}>
            <Text style={styles.headerChipText}>📍 Area</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={logout}>
            <Text style={styles.headerIconBtnText}>⎋</Text>
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
          renderItem={({ item }) => {
            const meta = statusMeta(item.status);
            const earning = Number(item.deliveryFee || 0) + Number(item.tipAmount || 0);
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.75}
                onPress={() => navigation.navigate('DeliveryOrderDetail', { orderId: item._id })}
              >
                <View style={styles.cardTopRow}>
                  <View style={styles.cardIcon}>
                    <Text style={styles.cardIconText}>📦</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Order #{item._id.slice(-6).toUpperCase()}</Text>
                    <Text style={styles.cardMeta}>{item.user?.name} · {item.user?.phone || item.phone}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.statusPillText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
                <View style={styles.cardDivider} />
                <View style={styles.cardBottomRow}>
                  <Text style={styles.cardAddress} numberOfLines={1}>📍 {item.deliveryAddress}</Text>
                  {earning > 0 && <Text style={styles.cardEarning}>₹{earning}</Text>}
                </View>
              </TouchableOpacity>
            );
          }}
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
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 10,
  },
  headerGreeting: { fontSize: 13, color: colors.muted, fontWeight: '600', marginBottom: 2 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  headerChip: {
    backgroundColor: colors.bg,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  headerChipText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  headerIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconBtnText: { fontSize: 15, color: colors.muted, fontWeight: '700' },
  emptyText: { color: colors.muted },
  kycBanner: { padding: 12, marginHorizontal: 16, marginTop: 12, borderRadius: 8 },
  kycText: { color: '#fff', fontSize: 12, lineHeight: 17 },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
    ...cardShadow(1),
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconText: { fontSize: 18 },
  cardTitle: { fontWeight: '700', color: colors.text, fontSize: 14 },
  cardMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16 },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  cardDivider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
  cardBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardAddress: { fontSize: 12, color: colors.muted, flex: 1 },
  cardEarning: { fontSize: 15, fontWeight: '800', color: colors.success },
});

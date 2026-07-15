import React, {useCallback, useEffect, useState} from 'react';
import {View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl} from 'react-native';
import {listMyOrders} from '../api/orders';
import {colors} from '../theme';

const STATUS_LABEL = {
  paid: '✅ Paid',
  pending: '⏳ Cash on delivery',
  failed: '❌ Failed',
  refunded: '↩️ Refunded',
};

// Every order is a "debit" from the customer's perspective (money paid or owed for
// it). A refunded order also shows as a credit line, so the two read like a simple
// ledger — the same pattern shop/delivery partners already see for their balance.
export default function PaymentHistoryScreen() {
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

  const totalPaid = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
  const totalOnline = orders
    .filter((o) => o.payment?.method === 'online' && o.payment?.status === 'paid')
    .reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total spent</Text>
          <Text style={styles.summaryValue}>₹{totalPaid.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabelMuted}>Paid online</Text>
          <Text style={styles.summaryValueMuted}>₹{totalOnline.toFixed(2)}</Text>
        </View>
      </View>

      <FlatList
        contentContainerStyle={styles.list}
        data={orders}
        keyExtractor={(o) => o._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.emptyText}>No payments yet.</Text>}
        renderItem={({item}) => (
          <View style={styles.row}>
            <View style={{flex: 1}}>
              <Text style={styles.rowTitle}>{item.shop?.name || (item.type === 'courier' ? 'Food pickup' : 'Order')}</Text>
              <Text style={styles.rowMeta}>
                {new Date(item.createdAt).toLocaleDateString()} · {item.payment?.method === 'online' ? 'Online' : 'Cash on Delivery'}
              </Text>
              <Text style={styles.rowStatus}>{STATUS_LABEL[item.payment?.status] || item.payment?.status || 'pending'}</Text>
            </View>
            <Text style={[styles.rowAmount, item.payment?.status === 'refunded' && styles.rowAmountCredit]}>
              {item.payment?.status === 'refunded' ? '+' : '-'}₹{Number(item.totalAmount || 0).toFixed(2)}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.bg},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg},
  summary: {
    backgroundColor: colors.card,
    margin: 16,
    marginBottom: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  summaryRow: {flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4},
  summaryLabel: {fontSize: 14, fontWeight: '700', color: colors.text},
  summaryValue: {fontSize: 20, fontWeight: '800', color: colors.primary},
  summaryLabelMuted: {fontSize: 12, color: colors.muted},
  summaryValueMuted: {fontSize: 12, color: colors.muted},
  list: {padding: 16},
  emptyText: {color: colors.muted, textAlign: 'center', marginTop: 24},
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  rowTitle: {fontWeight: '700', color: colors.text},
  rowMeta: {fontSize: 12, color: colors.muted, marginTop: 2},
  rowStatus: {fontSize: 12, color: colors.text, marginTop: 4, fontWeight: '600'},
  rowAmount: {fontWeight: '800', color: '#c62828'},
  rowAmountCredit: {color: colors.success},
});

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Linking, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { listLedger, getLedgerPdfUrl } from '../api/ledger';
import { useAuth } from '../context/AuthContext';
import WalletTopUp from '../components/WalletTopUp';
import { colors } from '../theme';

const KIND_ICON = { tip: '🎉', commission: '➖', deposit: '💰', adjustment: '⚙️' };

// Credits and debits for whoever is logged in — a delivery partner sees their tips
// and per-delivery commission; a shop owner sees their platform commission per
// order and their UPI top-ups. Same screen, same clear balance either way.
export default function EarningsScreen({ navigation }) {
  const { user } = useAuth();
  const isDelivery = user?.role === 'delivery';
  const [balance, setBalance] = useState(0);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await listLedger();
    setBalance(data.balance || 0);
    setEntries(data.entries || []);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const secondaryEntries = entries.filter((e) => (isDelivery ? e.kind === 'tip' : e.kind === 'commission'));
  const secondaryTotal = secondaryEntries.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const totalCredits = entries.filter((e) => e.direction === 'credit').reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const totalDebits = entries.filter((e) => e.direction === 'debit').reduce((sum, e) => sum + Number(e.amount || 0), 0);

  async function downloadStatement() {
    const token = await AsyncStorage.getItem('cake_token');
    if (!token) return;
    Linking.openURL(getLedgerPdfUrl(token)).catch(() => {
      Alert.alert('Could not open', 'No PDF viewer app found on this device.');
    });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={entries}
      keyExtractor={(e) => e._id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, { backgroundColor: colors.primary }]}>
              <Text style={styles.summaryLabel}>Wallet balance</Text>
              <Text style={styles.summaryValue}>₹{Number(balance).toFixed(2)}</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: isDelivery ? '#00897b' : '#6a1b9a' }]}>
              <Text style={styles.summaryLabel}>{isDelivery ? 'Tips earned' : 'Commission paid'}</Text>
              <Text style={styles.summaryValue}>₹{secondaryTotal.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.totalsRow}>
            <View style={styles.totalsBox}>
              <Text style={styles.totalsLabel}>Total credits</Text>
              <Text style={[styles.totalsValue, styles.credit]}>+₹{totalCredits.toFixed(2)}</Text>
            </View>
            <View style={styles.totalsBox}>
              <Text style={styles.totalsLabel}>Total debits</Text>
              <Text style={[styles.totalsValue, styles.debit]}>-₹{totalDebits.toFixed(2)}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.pdfButton} onPress={downloadStatement}>
            <Text style={styles.pdfButtonText}>📄 Download statement (PDF)</Text>
          </TouchableOpacity>

          {isDelivery && <WalletTopUp navigation={navigation} onDone={load} />}

          <Text style={styles.sectionTitle}>Activity</Text>
        </>
      }
      ListEmptyComponent={<Text style={styles.empty}>No activity yet.</Text>}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.rowIcon}>{KIND_ICON[item.kind] || '•'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowDesc}>{item.description}</Text>
            <Text style={styles.rowDate}>{new Date(item.createdAt).toLocaleString()}</Text>
          </View>
          <Text style={[styles.rowAmount, item.direction === 'credit' ? styles.credit : styles.debit]}>
            {item.direction === 'credit' ? '+' : '-'}₹{Number(item.amount || 0).toFixed(2)}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { padding: 16 },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  summaryCard: { flex: 1, borderRadius: 14, padding: 16 },
  summaryLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600' },
  summaryValue: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 6 },
  totalsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  totalsBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
  },
  totalsLabel: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  totalsValue: { fontSize: 15, fontWeight: '800', marginTop: 4 },
  pdfButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  pdfButtonText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  rowIcon: { fontSize: 18 },
  rowDesc: { fontSize: 13, fontWeight: '600', color: colors.text },
  rowDate: { fontSize: 11, color: colors.muted, marginTop: 2 },
  rowAmount: { fontSize: 14, fontWeight: '800' },
  credit: { color: colors.success },
  debit: { color: '#c62828' },
});

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
} from 'react-native';
import { listMyCateringRequests, respondToCateringQuote } from '../api/catering';
import { colors } from '../theme';

const STATUS_LABEL = {
  requested: 'Waiting for quote',
  quoted: 'Quote received',
  accepted: 'Confirmed',
  rejected: 'Declined',
  cancelled: 'Cancelled',
};

export default function MyCateringScreen({ navigation }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRequests(await listMyCateringRequests());
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function respond(id, accept) {
    try {
      const updated = await respondToCateringQuote(id, accept);
      setRequests((prev) => prev.map((r) => (r._id === id ? { ...r, ...updated } : r)));
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not update');
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (requests.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>No catering requests yet.</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.buttonText}>Browse caterers</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.list}
      data={requests}
      keyExtractor={(r) => r._id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{item.shop?.name || 'Caterer'}</Text>
            <Text style={styles.status}>{STATUS_LABEL[item.status] || item.status}</Text>
          </View>
          <Text style={styles.meta}>
            {item.headcount} people · {new Date(item.eventDate).toLocaleDateString()}
          </Text>
          {item.items.map((it, idx) => (
            <Text key={idx} style={styles.itemLine}>
              {it.quantity} × {it.name}
            </Text>
          ))}

          <Text style={styles.estimate}>Estimate: ₹{item.estimatedTotal}</Text>

          {item.status === 'quoted' && (
            <>
              {item.ownerNote ? <Text style={styles.ownerNote}>Caterer: "{item.ownerNote}"</Text> : null}
              <Text style={styles.quote}>
                Quoted price: ₹{item.quotedTotal}
                {item.discount ? `  (₹${item.discount} off)` : ''}
              </Text>
              <View style={styles.actions}>
                <TouchableOpacity style={[styles.smallBtn, styles.accept]} onPress={() => respond(item._id, true)}>
                  <Text style={styles.smallBtnText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.smallBtn, styles.reject]} onPress={() => respond(item._id, false)}>
                  <Text style={styles.smallBtnText}>Decline</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {item.status === 'accepted' && item.quotedTotal != null && (
            <Text style={styles.confirmed}>Confirmed at ₹{item.quotedTotal}</Text>
          )}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 24 },
  empty: { color: colors.muted, marginBottom: 16 },
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
  meta: { fontSize: 12, color: colors.muted, marginBottom: 6 },
  itemLine: { color: colors.text, fontSize: 13 },
  estimate: { color: colors.muted, fontSize: 13, marginTop: 8 },
  ownerNote: { color: colors.text, fontStyle: 'italic', marginTop: 8 },
  quote: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  smallBtn: { flex: 1, borderRadius: 8, padding: 10, alignItems: 'center' },
  accept: { backgroundColor: colors.primary },
  reject: { backgroundColor: '#9e9e9e' },
  smallBtnText: { color: '#fff', fontWeight: '600' },
  confirmed: { color: colors.success, fontWeight: '700', marginTop: 8 },
  button: { backgroundColor: colors.primary, borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
});

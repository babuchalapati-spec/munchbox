import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { listShops } from '../api/shops';
import { useCart } from '../context/CartContext';
import { imageUri } from '../api/client';
import { colors, categoryTheme } from '../theme';

export default function ShopsScreen({ route, navigation }) {
  const category = route?.params?.category;
  const { items } = useCart();
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await listShops(category);
    setShops(data.filter((s) => s.available));
  }, [category]);

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

  return (
    <View style={styles.container}>
      <View style={styles.subHeader}>
        <Text style={styles.deliveryNote}>Tap a shop to see its menu</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Cart')}>
          <Text style={styles.cartLink}>Cart ({items.length})</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={shops}
        keyExtractor={(s) => s._id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>No shops available in this category yet.</Text>}
        renderItem={({ item }) => {
          const theme = categoryTheme(item.category);
          return (
          <TouchableOpacity
            style={[styles.card, { borderLeftColor: theme.primary, borderLeftWidth: 4 }]}
            onPress={() =>
              navigation.navigate(item.category === 'catering' ? 'CateringRequest' : 'Shop', {
                shop: item,
                title: item.name,
              })
            }
          >
            {item.imageUrl ? (
              <Image source={{ uri: imageUri(item.imageUrl) }} style={styles.image} />
            ) : (
              <View style={[styles.image, styles.imagePlaceholder, { backgroundColor: theme.primary }]}>
                <Text style={styles.imagePlaceholderText}>{theme.icon}</Text>
              </View>
            )}
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              {item.description ? <Text style={styles.cardMeta}>{item.description}</Text> : null}
              <Text style={[styles.cardFee, { color: theme.primary }]}>Delivery ₹{item.perKmRate}/km</Text>
            </View>
          </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  subHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  deliveryNote: { fontSize: 12, color: colors.muted },
  cartLink: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  list: { padding: 16 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 40 },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: { width: 90, height: 90 },
  imagePlaceholder: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  imagePlaceholderText: { color: '#fff', fontSize: 32, fontWeight: '700' },
  cardBody: { flex: 1, padding: 12, justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  cardFee: { fontSize: 12, fontWeight: '600', color: colors.primary, marginTop: 6 },
});

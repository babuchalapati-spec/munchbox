import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { listProducts } from '../api/products';
import { useCart } from '../context/CartContext';
import { imageUri } from '../api/client';
import { colors, categoryTheme } from '../theme';

export default function ShopScreen({ route, navigation }) {
  const { shop } = route.params;
  const theme = categoryTheme(shop.category);
  const { items } = useCart();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');

  const load = useCallback(async () => {
    const data = await listProducts(shop._id);
    setProducts(data);
  }, [shop._id]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean));
    return ['All', ...set];
  }, [products]);

  const visibleProducts = useMemo(
    () => (activeCategory === 'All' ? products : products.filter((p) => p.category === activeCategory)),
    [products, activeCategory]
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.banner, { backgroundColor: theme.primary }]}>
        <Text style={styles.bannerIcon}>{theme.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>{shop.name}</Text>
          <View style={styles.bannerMetaRow}>
            {shop.rating?.count > 0 && (
              <View style={styles.ratingPill}>
                <Text style={styles.ratingPillText}>★ {shop.rating.avg.toFixed(1)}</Text>
              </View>
            )}
            <Text style={styles.bannerTag}>{theme.tagline}</Text>
          </View>
        </View>
      </View>
      <View style={[styles.subHeader, { backgroundColor: theme.soft }]}>
        <Text style={styles.deliveryNote}>🛵 Delivery ₹{shop.perKmRate}/km from this shop</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Cart')}>
          <Text style={[styles.cartLink, { color: theme.primary }]}>Cart ({items.length})</Text>
        </TouchableOpacity>
      </View>

      {categories.length > 1 && (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categories}
          keyExtractor={(c) => c}
          contentContainerStyle={styles.chipRow}
          renderItem={({ item: c }) => (
            <TouchableOpacity
              style={[styles.chip, activeCategory === c && { backgroundColor: theme.primary, borderColor: theme.primary }]}
              onPress={() => setActiveCategory(c)}
            >
              <Text style={[styles.chipText, activeCategory === c && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <FlatList
        data={visibleProducts}
        keyExtractor={(p) => p._id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>Nothing available at this shop yet.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, !item.available && styles.cardDisabled]}
            onPress={() => navigation.navigate('ProductDetail', { product: item, shop })}
            activeOpacity={0.85}
          >
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardMeta}>{item.category}</Text>
              {item.description ? (
                <Text style={styles.cardDesc} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}
              {item.available ? (
                <Text style={[styles.cardPrice, { color: theme.primary }]}>₹{item.basePrice}</Text>
              ) : (
                <Text style={styles.outOfStock}>Out of stock</Text>
              )}
            </View>
            <View style={styles.imageWrap}>
              {item.imageUrl ? (
                <Image source={{ uri: imageUri(item.imageUrl) }} style={styles.image} />
              ) : (
                <View style={[styles.image, styles.imagePlaceholder]}>
                  <Text style={{ fontSize: 22 }}>🍽️</Text>
                </View>
              )}
              {item.available && (
                <View style={[styles.addBadge, { borderColor: theme.primary }]}>
                  <Text style={[styles.addBadgeText, { color: theme.primary }]}>ADD</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  banner: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  bannerIcon: { fontSize: 30 },
  bannerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  bannerMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  ratingPill: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  ratingPillText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  bannerTag: { color: 'rgba(255,255,255,0.9)', fontSize: 12 },
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
  chipRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, backgroundColor: colors.card },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: colors.card,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.text },
  chipTextActive: { color: '#fff' },
  list: { padding: 16 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 40 },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 14,
    gap: 12,
  },
  cardDisabled: { opacity: 0.5 },
  cardBody: { flex: 1, justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  cardMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  cardDesc: { fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 16 },
  cardPrice: { fontSize: 14, fontWeight: '700', marginTop: 8 },
  outOfStock: { fontSize: 12, fontWeight: '700', color: '#c62828', marginTop: 8 },
  imageWrap: { width: 96, alignItems: 'center' },
  image: { width: 96, height: 96, borderRadius: 10 },
  imagePlaceholder: { backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  addBadge: {
    marginTop: -14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  addBadgeText: { fontSize: 12, fontWeight: '800' },
});

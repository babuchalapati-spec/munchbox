import React from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useCart } from '../context/CartContext';
import { imageUri } from '../api/client';
import { colors } from '../theme';

export default function CartScreen({ navigation }) {
  const { items, shop, updateQuantity, total } = useCart();

  if (items.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>🛒</Text>
        <Text style={styles.emptyText}>Your cart is empty.</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.buttonText}>Browse shops</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {shop && (
        <View style={styles.shopHeader}>
          <Text style={styles.shopName}>🏪 {shop.name}</Text>
        </View>
      )}
      <FlatList
        data={items}
        keyExtractor={(i) => i.key}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.row}>
            {item.imageUrl ? (
              <Image source={{ uri: imageUri(item.imageUrl) }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbEmpty]}>
                <Text style={{ fontSize: 18 }}>🍽️</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{item.name}</Text>
              {item.weight ? <Text style={styles.rowMeta}>{item.weight}</Text> : null}
              {item.flavor ? <Text style={styles.rowMeta}>Flavor: {item.flavor}</Text> : null}
              {item.messageOnCake ? <Text style={styles.rowMeta}>"{item.messageOnCake}"</Text> : null}
              {item.notes ? <Text style={styles.rowMeta}>{item.notes}</Text> : null}
              <Text style={styles.rowPrice}>₹{item.price * item.quantity}</Text>
            </View>
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepperBtn} onPress={() => updateQuantity(item.key, -1)}>
                <Text style={styles.stepperBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{item.quantity}</Text>
              <TouchableOpacity style={styles.stepperBtn} onPress={() => updateQuantity(item.key, 1)}>
                <Text style={styles.stepperBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListFooterComponent={
          <TouchableOpacity
            style={styles.addMore}
            onPress={() => (shop ? navigation.navigate('Shop', { shop }) : navigation.navigate('Home'))}
          >
            <Text style={styles.addMoreText}>+ Add more items</Text>
          </TouchableOpacity>
        }
      />
      <View style={styles.footer}>
        <Text style={styles.total}>Total: ₹{total}</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Checkout')}>
          <Text style={styles.buttonText}>Proceed to checkout ›</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 24 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyText: { color: colors.muted, marginBottom: 16 },
  shopHeader: {
    padding: 14,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  shopName: { fontWeight: '700', color: colors.text },
  list: { padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },
  thumb: { width: 56, height: 56, borderRadius: 8 },
  thumbEmpty: { backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontWeight: '700', color: colors.text, fontSize: 14 },
  rowMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  rowPrice: { fontWeight: '700', color: colors.primary, marginTop: 6 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    overflow: 'hidden',
  },
  stepperBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  stepperBtnText: { color: colors.primary, fontWeight: '800', fontSize: 15 },
  stepperValue: { fontWeight: '700', color: colors.text, minWidth: 20, textAlign: 'center' },
  addMore: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  addMoreText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  total: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12 },
  button: { backgroundColor: colors.primary, borderRadius: 10, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
});

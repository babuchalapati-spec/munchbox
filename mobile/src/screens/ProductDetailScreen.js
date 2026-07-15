import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image, Alert } from 'react-native';
import { useCart } from '../context/CartContext';
import { imageUri } from '../api/client';
import { colors, categoryTheme } from '../theme';

const SPICE_LEVELS = ['Mild', 'Medium', 'Spicy', 'Extra hot'];

// Shop owners can type any category text for a product (not just the 'Cake' / 'Food'
// / 'Catering' picker options — e.g. 'Biryani', 'Meals', 'Chocolate'), so match
// loosely: only 'cake' and 'catering' are distinctive enough to detect by keyword;
// everything else falls back to the food/restaurant field set, which is a safe
// default (spice level, add-ons) rather than showing no customization at all.
function customizationKind(rawCategory) {
  const c = String(rawCategory || '').toLowerCase();
  if (c.includes('cake')) return 'cake';
  if (c.includes('cater')) return 'catering';
  return 'food';
}

export default function ProductDetailScreen({ route, navigation }) {
  const { product, shop } = route.params;
  const category = shop?.category || 'cake';
  // Which customization fields to show follows the ITEM's own category — not the
  // shop's overall category, since one shop can carry mixed items (e.g. a dessert
  // at a restaurant).
  const productKind = customizationKind(product.category);
  const isCake = productKind === 'cake';
  const isRestaurant = productKind === 'food';
  const isCatering = productKind === 'catering';
  const theme = categoryTheme(category);
  const { addItem, replaceWith } = useCart();
  const outOfStock = !product.available;
  const [weight, setWeight] = useState(product.weightOptions?.[0]?.label || '');
  const [flavor, setFlavor] = useState('');
  const [messageOnCake, setMessageOnCake] = useState('');
  const [spice, setSpice] = useState('');
  const [addOns, setAddOns] = useState('');
  const [headcount, setHeadcount] = useState('');
  const [notes, setNotes] = useState('');
  const [imageBroken, setImageBroken] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const weightDelta = product.weightOptions?.find((w) => w.label === weight)?.priceDelta || 0;
  const unitPrice = product.basePrice + weightDelta;

  function buildItem() {
    // Fold category-specific choices into the order so the shop sees them.
    const extras = [];
    if (isRestaurant && spice) extras.push(`Spice: ${spice}`);
    if (isRestaurant && addOns) extras.push(`Add-ons: ${addOns}`);
    if (isCatering && headcount) extras.push(`For ${headcount} people`);
    if (notes) extras.push(notes);
    return {
      product: product._id,
      isCustom: false,
      name: product.name,
      weight: weight || undefined,
      flavor: isCake ? flavor || undefined : undefined,
      messageOnCake: isCake ? messageOnCake || undefined : undefined,
      notes: extras.length ? extras.join(' | ') : undefined,
      quantity,
      price: unitPrice,
      imageUrl: product.imageUrl || undefined,
    };
  }

  function added() {
    Alert.alert('Added to cart', `${product.name} added to your cart.`, [
      { text: 'Keep browsing', onPress: () => navigation.goBack() },
      { text: 'Go to cart', onPress: () => navigation.navigate('Cart') },
    ]);
  }

  function handleAddToCart() {
    if (isCake && !flavor.trim()) {
      Alert.alert('Flavour required', 'Please choose a flavour for this cake.');
      return;
    }
    if (isCake && !messageOnCake.trim()) {
      Alert.alert('Message required', 'Please enter what should be written on the cake (or type "None" if you don\'t want any message).');
      return;
    }
    const result = addItem(buildItem(), shop);
    if (result.conflict) {
      Alert.alert(
        'Start a new cart?',
        `Your cart has items from ${result.currentShop.name}. You can only order from one shop at a time. Clear it and add this item from ${result.newShop.name}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Start new cart',
            style: 'destructive',
            onPress: () => {
              replaceWith(buildItem(), shop);
              added();
            },
          },
        ]
      );
      return;
    }
    added();
  }

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {product.imageUrl && !imageBroken ? (
        <Image source={{ uri: imageUri(product.imageUrl) }} style={styles.image} onError={() => setImageBroken(true)} />
      ) : null}
      <Text style={styles.title}>{!isCake ? (product.isVeg !== false ? '🟢 ' : '🔴 ') : ''}{product.name}</Text>
      <Text style={styles.description}>{product.description}</Text>
      {outOfStock && (
        <Text style={styles.outOfStockBanner}>⏸️ Currently out of stock at this shop</Text>
      )}

      {product.weightOptions?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.label}>Weight</Text>
          <View style={styles.optionRow}>
            {product.weightOptions.map((w) => (
              <TouchableOpacity
                key={w.label}
                style={[
                  styles.option,
                  weight === w.label && { backgroundColor: theme.primary, borderColor: theme.primary },
                ]}
                onPress={() => setWeight(w.label)}
              >
                <Text style={weight === w.label ? styles.optionTextSelected : styles.optionText}>{w.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Cake customisation */}
      {isCake && (
        <>
          <View style={styles.section}>
            <Text style={styles.label}>🎂 Flavour *</Text>
            <TextInput style={styles.input} placeholder="e.g. Chocolate, Vanilla, Butterscotch" value={flavor} onChangeText={setFlavor} />
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>✍️ Message on cake *</Text>
            <TextInput
              style={styles.input}
              placeholder="Happy Birthday Ravi... (type None if you don't want a message)"
              value={messageOnCake}
              onChangeText={setMessageOnCake}
            />
          </View>
        </>
      )}

      {/* Restaurant options */}
      {isRestaurant && (
        <>
          <View style={styles.section}>
            <Text style={styles.label}>🌶️ Spice level</Text>
            <View style={styles.optionRow}>
              {SPICE_LEVELS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.option, spice === s && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                  onPress={() => setSpice(s)}
                >
                  <Text style={spice === s ? styles.optionTextSelected : styles.optionText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>🧀 Extra toppings / add-ons</Text>
            <TextInput style={styles.input} placeholder="e.g. Extra cheese, raita, extra gravy" value={addOns} onChangeText={setAddOns} />
          </View>
        </>
      )}

      {/* Catering options */}
      {isCatering && (
        <>
          <View style={[styles.cateringBanner, { backgroundColor: theme.soft }]}>
            <Text style={[styles.cateringText, { color: theme.primary }]}>
              🍽️ Catering is served in bulk. Tell us the headcount and the shop will confirm a quote with quantity discounts.
            </Text>
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>👥 Number of people</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 50"
              keyboardType="number-pad"
              value={headcount}
              onChangeText={(v) => setHeadcount(v.replace(/[^0-9]/g, ''))}
            />
          </View>
          <TouchableOpacity
            style={[styles.quoteBtn, { borderColor: theme.primary }]}
            onPress={() => navigation.navigate('CateringRequest', { shop })}
          >
            <Text style={[styles.quoteBtnText, { color: theme.primary }]}>Request a full catering quote →</Text>
          </TouchableOpacity>
        </>
      )}

      <View style={styles.section}>
        <Text style={styles.label}>Notes</Text>
        <TextInput style={styles.input} placeholder="Any special instructions" value={notes} onChangeText={setNotes} />
      </View>

    </ScrollView>

      <View style={styles.bottomBar}>
        <View style={styles.stepper}>
          <TouchableOpacity style={styles.stepperBtn} onPress={() => setQuantity((q) => Math.max(1, q - 1))}>
            <Text style={styles.stepperBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.stepperValue}>{quantity}</Text>
          <TouchableOpacity style={styles.stepperBtn} onPress={() => setQuantity((q) => q + 1)}>
            <Text style={styles.stepperBtnText}>+</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: theme.primary }, outOfStock && styles.buttonDisabled]}
          onPress={handleAddToCart}
          disabled={outOfStock}
        >
          <Text style={styles.addButtonText}>
            {outOfStock ? 'Out of stock' : `Add item · ₹${unitPrice * quantity}`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16 },
  image: { width: '100%', height: 200, borderRadius: 10, marginBottom: 16, backgroundColor: colors.border },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  description: { fontSize: 14, color: colors.muted, marginTop: 6, marginBottom: 16 },
  outOfStockBanner: {
    backgroundColor: '#ffebee',
    color: '#c62828',
    fontWeight: '600',
    fontSize: 13,
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  section: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
  },
  optionSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionText: { color: colors.text },
  optionTextSelected: { color: '#fff', fontWeight: '600' },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10 },
  cateringBanner: { borderRadius: 10, padding: 12, marginBottom: 16 },
  cateringText: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  quoteBtn: { borderWidth: 1, borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 16 },
  quoteBtnText: { fontWeight: '700' },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: 'hidden',
  },
  stepperBtn: { paddingHorizontal: 14, paddingVertical: 12 },
  stepperBtnText: { fontSize: 18, fontWeight: '800', color: colors.text },
  stepperValue: { fontSize: 16, fontWeight: '700', color: colors.text, minWidth: 24, textAlign: 'center' },
  addButton: { flex: 1, borderRadius: 10, padding: 14, alignItems: 'center' },
  buttonDisabled: { backgroundColor: colors.border, opacity: 0.8 },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

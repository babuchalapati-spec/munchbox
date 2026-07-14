import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { listProducts } from '../api/products';
import { createCateringRequest } from '../api/catering';
import { useAuth } from '../context/AuthContext';
import { colors, categoryTheme } from '../theme';

const cateringAccent = categoryTheme('catering').primary;

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

export default function CateringRequestScreen({ route, navigation }) {
  const { shop } = route.params;
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [qty, setQty] = useState({}); // productId -> quantity
  const [loading, setLoading] = useState(true);
  const [headcount, setHeadcount] = useState('');
  const [eventDate, setEventDate] = useState(formatDate(new Date(Date.now() + 3 * 86400000)));
  const [address, setAddress] = useState(user?.address || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listProducts(shop._id)
      .then((data) => setProducts(data.filter((p) => p.available)))
      .finally(() => setLoading(false));
  }, [shop._id]);

  const estimate = useMemo(
    () => products.reduce((sum, p) => sum + (Number(qty[p._id]) || 0) * p.basePrice, 0),
    [products, qty]
  );

  function setQuantity(id, value) {
    setQty((q) => ({ ...q, [id]: value.replace(/[^0-9]/g, '') }));
  }

  async function handleSubmit() {
    const items = products
      .filter((p) => Number(qty[p._id]) > 0)
      .map((p) => ({ product: p._id, quantity: Number(qty[p._id]) }));

    if (items.length === 0) {
      setError('Select at least one item with a quantity');
      return;
    }
    if (!headcount || Number(headcount) < 1) {
      setError('Enter the number of people');
      return;
    }
    if (!address || !phone) {
      setError('Address and phone are required');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await createCateringRequest({
        shop: shop._id,
        items,
        headcount: Number(headcount),
        eventDate,
        address,
        phone,
        notes: notes || undefined,
      });
      Alert.alert(
        'Request sent',
        'The caterer will review and send you a price quote. You can accept it from "My catering".',
        [{ text: 'OK', onPress: () => navigation.navigate('MyCatering') }]
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send request');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Request catering</Text>
      <Text style={styles.shop}>🍽️ {shop.name}</Text>
      <Text style={styles.intro}>
        Choose items and quantities, tell us how many people, and the caterer will send you a price quote (they may
        offer a discount for larger orders).
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.label}>Menu</Text>
      {products.map((p) => (
        <View key={p._id} style={styles.itemRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemName}>{p.name}</Text>
            <Text style={styles.itemPrice}>₹{p.basePrice} each</Text>
          </View>
          <TextInput
            style={styles.qtyInput}
            keyboardType="number-pad"
            placeholder="0"
            value={qty[p._id] ?? ''}
            onChangeText={(v) => setQuantity(p._id, v)}
          />
        </View>
      ))}

      <Text style={styles.label}>Number of people</Text>
      <TextInput style={styles.input} keyboardType="number-pad" value={headcount} onChangeText={setHeadcount} placeholder="e.g. 150" />

      <Text style={styles.label}>Event date</Text>
      <TextInput style={styles.input} value={eventDate} onChangeText={setEventDate} placeholder="YYYY-MM-DD" />

      <Text style={styles.label}>Event address</Text>
      <TextInput style={[styles.input, styles.multiline]} multiline value={address} onChangeText={setAddress} />

      <Text style={styles.label}>Phone</Text>
      <TextInput style={styles.input} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />

      <Text style={styles.label}>Notes (optional)</Text>
      <TextInput style={styles.input} value={notes} onChangeText={setNotes} placeholder="Veg only, timings, etc." />

      <Text style={styles.estimate}>Estimated: ₹{estimate}</Text>
      <Text style={styles.estimateNote}>Final price will be confirmed by the caterer.</Text>

      <TouchableOpacity style={[styles.button, { backgroundColor: cateringAccent }]} onPress={handleSubmit} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Request quote</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { padding: 16 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  shop: { fontSize: 13, color: colors.muted, marginTop: 2 },
  intro: { fontSize: 13, color: colors.muted, marginTop: 10, lineHeight: 19 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6, marginTop: 16 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  itemName: { color: colors.text, fontWeight: '600' },
  itemPrice: { color: colors.muted, fontSize: 12, marginTop: 2 },
  qtyInput: {
    width: 64,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 8,
    textAlign: 'center',
    backgroundColor: colors.bg,
  },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10 },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  estimate: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 20 },
  estimateNote: { fontSize: 12, color: colors.muted, marginBottom: 12 },
  button: { backgroundColor: colors.primary, borderRadius: 8, padding: 14, alignItems: 'center', marginBottom: 32 },
  buttonText: { color: '#fff', fontWeight: '600' },
  error: { color: '#c62828', marginTop: 8 },
});

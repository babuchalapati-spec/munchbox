import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { courierQuote, placeCourierOrder } from '../api/orders';
import { useAuth } from '../context/AuthContext';
import { requestLocationPermission, getCurrentPosition } from '../location';
import { colors } from '../theme';

const ACCENT = '#00897b'; // teal — distinct from the food categories

export default function FoodPickupScreen({ navigation }) {
  const { user } = useAuth();
  const [direction, setDirection] = useState('outgoing'); // outgoing = from my home; incoming = to my home
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupLoc, setPickupLoc] = useState(null);
  const [dropAddress, setDropAddress] = useState('');
  const [dropLoc, setDropLoc] = useState(null);
  const [foodNote, setFoodNote] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function grab(which) {
    setError('');
    setBusy(which);
    try {
      const granted = await requestLocationPermission();
      if (!granted) {
        setError('Location permission is needed to set the point and calculate the fee.');
        return;
      }
      const pos = await getCurrentPosition();
      const nextPickup = which === 'pickup' ? pos : pickupLoc;
      const nextDrop = which === 'drop' ? pos : dropLoc;
      if (which === 'pickup') setPickupLoc(pos);
      else setDropLoc(pos);
      if (nextPickup && nextDrop) {
        setQuote(await courierQuote(nextPickup, nextDrop));
      }
    } catch (err) {
      setError(err.message || 'Could not get location.');
    } finally {
      setBusy('');
    }
  }

  async function submit() {
    if (!pickupAddress || !pickupLoc) return setError('Set the pickup address and location.');
    if (!dropAddress || !dropLoc) return setError('Set the drop address and location.');
    if (!phone) return setError('Phone is required.');
    setError('');
    setSubmitting(true);
    try {
      await placeCourierOrder({
        direction,
        packageNote: foodNote || undefined,
        pickupAddress,
        pickupLocation: pickupLoc,
        deliveryAddress: dropAddress,
        deliveryLocation: dropLoc,
        phone,
      });
      Alert.alert('Pickup requested', 'Your food pickup has been booked. Track it in My orders.', [
        { text: 'OK', onPress: () => navigation.navigate('Orders') },
      ]);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not book pickup');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={[styles.banner, { backgroundColor: ACCENT }]}>
        <Text style={styles.bannerIcon}>🛵</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>Food pickup</Text>
          <Text style={styles.bannerTag}>Get food picked up and delivered — home to office and back.</Text>
        </View>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.label}>Direction</Text>
      <View style={styles.row}>
        {[
          { k: 'outgoing', t: 'From my home' },
          { k: 'incoming', t: 'To my home' },
        ].map((d) => (
          <TouchableOpacity
            key={d.k}
            style={[styles.chip, direction === d.k && { backgroundColor: ACCENT, borderColor: ACCENT }]}
            onPress={() => setDirection(d.k)}
          >
            <Text style={direction === d.k ? styles.chipTextActive : styles.chipText}>{d.t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Pick up from</Text>
      <TextInput style={styles.input} value={pickupAddress} onChangeText={setPickupAddress} placeholder="Pickup address" />
      <TouchableOpacity style={[styles.locBtn, { borderColor: ACCENT }]} onPress={() => grab('pickup')}>
        {busy === 'pickup' ? <ActivityIndicator color={ACCENT} /> : <Text style={[styles.locBtnText, { color: ACCENT }]}>{pickupLoc ? '✓ Pickup location set' : '📍 Set pickup location'}</Text>}
      </TouchableOpacity>

      <Text style={styles.label}>Deliver to</Text>
      <TextInput style={styles.input} value={dropAddress} onChangeText={setDropAddress} placeholder="Drop address" />
      <TouchableOpacity style={[styles.locBtn, { borderColor: ACCENT }]} onPress={() => grab('drop')}>
        {busy === 'drop' ? <ActivityIndicator color={ACCENT} /> : <Text style={[styles.locBtnText, { color: ACCENT }]}>{dropLoc ? '✓ Drop location set' : '📍 Set drop location'}</Text>}
      </TouchableOpacity>

      <Text style={styles.label}>What food to pick up</Text>
      <TextInput style={styles.input} value={foodNote} onChangeText={setFoodNote} placeholder="e.g. Lunch box, 2 tiffins" />

      <Text style={styles.label}>Phone</Text>
      <TextInput style={styles.input} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />

      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>Delivery fee {quote ? `(${quote.distanceKm} km × ₹${quote.perKmRate}/km)` : ''}</Text>
        <Text style={styles.summaryValue}>{quote ? `₹${quote.deliveryFee}` : '— set both locations'}</Text>
      </View>

      <TouchableOpacity style={[styles.button, { backgroundColor: ACCENT }]} onPress={submit} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Book pickup</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16 },
  banner: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, gap: 12, marginBottom: 8 },
  bannerIcon: { fontSize: 28 },
  bannerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  bannerTag: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 2 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 14, marginBottom: 6 },
  row: { flexDirection: 'row', gap: 10 },
  chip: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, alignItems: 'center', backgroundColor: colors.card },
  chipText: { color: colors.text },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10 },
  locBtn: { borderWidth: 1, borderRadius: 8, padding: 11, alignItems: 'center', marginTop: 8 },
  locBtnText: { fontWeight: '600' },
  summary: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14, marginTop: 18 },
  summaryLabel: { color: colors.muted, fontSize: 13, flex: 1 },
  summaryValue: { color: colors.text, fontSize: 14, fontWeight: '700' },
  button: { borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 16, marginBottom: 32 },
  buttonText: { color: '#fff', fontWeight: '600' },
  error: { color: '#c62828', marginTop: 8 },
});

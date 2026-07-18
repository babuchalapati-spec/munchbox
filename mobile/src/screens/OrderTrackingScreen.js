import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { getOrder, rateOrder } from '../api/orders';
import BikeMap from '../components/BikeMap';
import { colors } from '../theme';

// Tappable 1-5 star row.
function StarRow({ value, onChange }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity key={n} onPress={() => onChange(n)}>
          <Text style={{ fontSize: 28 }}>{n <= value ? '⭐' : '☆'}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const STEPS = ['placed', 'confirmed', 'baking', 'heading_to_shop', 'out_for_delivery', 'delivered'];
const STATUS_LABELS = {
  placed: 'Placed',
  confirmed: 'Confirmed',
  baking: 'Baking',
  heading_to_shop: 'Partner heading to shop',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export default function OrderTrackingScreen({ route, navigation }) {
  const { orderId } = route.params;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shopStars, setShopStars] = useState(0);
  const [deliveryStars, setDeliveryStars] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);
  const pollRef = useRef(null);

  const load = useCallback(async () => {
    const data = await getOrder(orderId);
    setOrder(data);
    return data;
  }, [orderId]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (order?.status === 'out_for_delivery') {
      pollRef.current = setInterval(() => {
        load().catch(() => {});
      }, 10000);
      return () => clearInterval(pollRef.current);
    }
    return undefined;
  }, [order?.status, load]);

  async function handleSubmitRating() {
    if (!shopStars) {
      Alert.alert('Rate the shop', 'Tap a star to rate the shop before submitting.');
      return;
    }
    if (order.assignedTo && !deliveryStars) {
      Alert.alert('Rate the delivery partner', 'Tap a star to rate the delivery partner before submitting.');
      return;
    }
    setSubmittingRating(true);
    try {
      const updated = await rateOrder(order._id, {
        shopStars,
        deliveryStars: order.assignedTo ? deliveryStars : undefined,
      });
      setOrder(updated);
      Alert.alert('Thanks!', 'Your rating has been submitted.');
    } catch (err) {
      Alert.alert('Could not submit rating', err.response?.data?.message || 'Try again');
    } finally {
      setSubmittingRating(false);
    }
  }

  if (loading || !order) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const stepIndex = STEPS.indexOf(order.status);
  const isCancelled = order.status === 'cancelled';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Order #{order._id.slice(-6).toUpperCase()}</Text>

      {isCancelled ? (
        <Text style={styles.cancelled}>This order was cancelled.</Text>
      ) : (
        <View style={styles.timeline}>
          {STEPS.map((step, idx) => (
            <View key={step} style={styles.timelineRow}>
              <View style={[styles.dot, idx <= stepIndex && styles.dotActive]} />
              <Text style={[styles.timelineLabel, idx <= stepIndex && styles.timelineLabelActive]}>
                {STATUS_LABELS[step]}
              </Text>
            </View>
          ))}
        </View>
      )}

      {order.assignedTo && !isCancelled && (
        <TouchableOpacity
          style={styles.chatButton}
          onPress={() => navigation.navigate('Chat', { orderId: order._id, title: order.assignedTo.name })}
        >
          <Text style={styles.chatButtonText}>Chat with {order.assignedTo.name}</Text>
        </TouchableOpacity>
      )}

      {order.status === 'out_for_delivery' && order.deliveryCode && (
        <View style={styles.codeCard}>
          <Text style={styles.codeCardLabel}>Your delivery code</Text>
          <Text style={styles.codeCardValue}>{order.deliveryCode}</Text>
          <Text style={styles.codeCardHint}>
            Share this code with the delivery partner only when your order arrives. It confirms the parcel reached you.
          </Text>
        </View>
      )}

      {order.status === 'out_for_delivery' && (
        <View style={styles.mapSection}>
          <Text style={styles.mapTitle}>Live location</Text>
          {order.currentLocation ? (
            <>
              <BikeMap bike={order.currentLocation} destination={order.deliveryLocation} height={220} />
              <Text style={styles.mapMeta}>
                Last updated: {new Date(order.currentLocation.updatedAt).toLocaleTimeString()}
              </Text>
              <TouchableOpacity
                onPress={() =>
                  Linking.openURL(
                    `https://www.google.com/maps/search/?api=1&query=${order.currentLocation.lat},${order.currentLocation.lng}`
                  )
                }
              >
                <Text style={styles.mapLink}>Open in Google Maps</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.mapMeta}>Waiting for the delivery partner's location...</Text>
          )}
        </View>
      )}

      {order.status === 'delivered' && (
        order.rating?.ratedAt ? (
          <View style={styles.rateCard}>
            <Text style={styles.rateTitle}>Thanks for rating this order!</Text>
            <Text style={styles.rateSummary}>Shop: {'⭐'.repeat(order.rating.shopStars)}</Text>
            {order.rating.deliveryStars ? (
              <Text style={styles.rateSummary}>Delivery: {'⭐'.repeat(order.rating.deliveryStars)}</Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.rateCard}>
            <Text style={styles.rateTitle}>Rate your order</Text>
            <Text style={styles.rateLabel}>How was the food from the shop?</Text>
            <StarRow value={shopStars} onChange={setShopStars} />
            {order.assignedTo && (
              <>
                <Text style={[styles.rateLabel, { marginTop: 14 }]}>How was {order.assignedTo.name}'s delivery?</Text>
                <StarRow value={deliveryStars} onChange={setDeliveryStars} />
              </>
            )}
            <TouchableOpacity style={styles.rateButton} onPress={handleSubmitRating} disabled={submittingRating}>
              {submittingRating ? <ActivityIndicator color="#fff" /> : <Text style={styles.rateButtonText}>Submit rating</Text>}
            </TouchableOpacity>
          </View>
        )
      )}

      <View style={styles.summary}>
        {order.items.map((item, idx) => (
          <Text key={idx} style={styles.itemLine}>
            {item.quantity}× {item.name}
            {item.weight ? ` (${item.weight})` : ''} — ₹{item.price}
          </Text>
        ))}
        <Text style={styles.address}>{order.deliveryAddress}</Text>
        {order.deliveryFee != null && (
          <Text style={styles.feeLine}>
            Items ₹{order.itemsTotal ?? order.totalAmount} + delivery ₹{order.deliveryFee}
            {order.distanceKm ? ` (${order.distanceKm} km)` : ''}
          </Text>
        )}
        {order.tipAmount > 0 && <Text style={styles.feeLine}>Tip for delivery partner: ₹{order.tipAmount}</Text>}
        <Text style={styles.total}>Total: ₹{order.totalAmount}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { padding: 16 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 16 },
  cancelled: { color: '#c62828', fontWeight: '600', marginBottom: 16 },
  chatButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  chatButtonText: { color: colors.primary, fontWeight: '600' },
  timeline: { marginBottom: 20 },
  timelineRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.border, marginRight: 10 },
  dotActive: { backgroundColor: colors.primary },
  timelineLabel: { color: colors.muted },
  timelineLabelActive: { color: colors.text, fontWeight: '600' },
  codeCard: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  codeCardLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600' },
  codeCardValue: { color: '#fff', fontSize: 34, fontWeight: '800', letterSpacing: 8, marginVertical: 6 },
  codeCardHint: { color: 'rgba(255,255,255,0.9)', fontSize: 11, textAlign: 'center', lineHeight: 15 },
  mapSection: { marginBottom: 20 },
  mapTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
  map: { width: '100%', height: 220, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.border },
  mapLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  mapMeta: { fontSize: 12, color: colors.muted, marginTop: 6 },
  mapLink: { color: colors.primary, fontWeight: '600', marginTop: 6 },
  rateCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
  },
  rateTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 8 },
  rateLabel: { fontSize: 13, color: colors.text, marginBottom: 8 },
  rateSummary: { fontSize: 14, color: colors.text, marginTop: 4 },
  rateButton: { backgroundColor: colors.primary, borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 16 },
  rateButtonText: { color: '#fff', fontWeight: '700' },
  summary: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 },
  itemLine: { color: colors.text, marginBottom: 4 },
  address: { color: colors.muted, marginTop: 8 },
  feeLine: { color: colors.muted, fontSize: 12, marginTop: 8 },
  total: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 6 },
});

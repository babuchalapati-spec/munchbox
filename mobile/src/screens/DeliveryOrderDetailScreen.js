import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { getOrder, updateOrderStatus, updateOrderLocation, confirmPickup, confirmDelivery } from '../api/orders';
import { requestLocationPermission, watchPosition, clearWatch } from '../location';
import { colors } from '../theme';

// Opens turn-by-turn navigation in Google Maps toward a destination.
function navigateTo(lat, lng) {
  if (lat == null || lng == null) return;
  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`);
}

function osmEmbed(lat, lng) {
  const d = 0.008;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d},${lng + d},${lat + d}&layer=mapnik&marker=${lat},${lng}`;
}

const STATUS_LABEL = {
  placed: 'Placed',
  confirmed: 'Confirmed',
  baking: 'Baking',
  ready: 'Ready for pickup',
  heading_to_shop: 'Heading to shop',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

function openInMaps(lat, lng, label) {
  if (lat == null || lng == null) return;
  const q = label ? encodeURIComponent(label) : `${lat},${lng}`;
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}(${q})`);
}

export default function DeliveryOrderDetailScreen({ route, navigation }) {
  const { orderId } = route.params;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [pickupCodeInput, setPickupCodeInput] = useState('');
  const [deliveryCodeInput, setDeliveryCodeInput] = useState('');
  const watchIdRef = useRef(null);

  const load = useCallback(async () => {
    const data = await getOrder(orderId);
    setOrder(data);
    return data;
  }, [orderId]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    return () => clearWatch(watchIdRef.current);
  }, []);

  async function startBroadcasting() {
    const granted = await requestLocationPermission();
    if (!granted) {
      Alert.alert('Location permission required', 'Enable location access to share live tracking with the customer.');
      return;
    }
    setTracking(true);
    watchIdRef.current = watchPosition(
      ({ lat, lng }) => {
        updateOrderLocation(orderId, lat, lng).catch(() => {});
      },
      (err) => {
        if (err?.code === 2) {
          Alert.alert('Location is off', 'Please turn on Location/GPS on your phone to share live tracking.');
          setTracking(false);
        }
      }
    );
  }

  function stopBroadcasting() {
    clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    setTracking(false);
  }

  async function handleHeadingToShop() {
    setBusy(true);
    try {
      const updated = await updateOrderStatus(orderId, 'heading_to_shop');
      setOrder(updated);
      // Share location from here so the shop can see how far away we are and the ETA,
      // not just after pickup.
      await startBroadcasting();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not update order');
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmPickup() {
    if (!pickupCodeInput.trim()) {
      Alert.alert('Enter code', 'Ask the shop for the 6-digit pickup code and enter it here.');
      return;
    }
    setBusy(true);
    try {
      const updated = await confirmPickup(orderId, pickupCodeInput.trim());
      setOrder(updated);
      setPickupCodeInput('');
      await startBroadcasting();
    } catch (err) {
      Alert.alert('Pickup failed', err.response?.data?.message || 'Incorrect code. Check with the shop.');
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmDelivery() {
    if (!deliveryCodeInput.trim()) {
      Alert.alert('Enter code', 'Ask the customer for the 6-digit delivery code shown in their app.');
      return;
    }
    setBusy(true);
    try {
      const updated = await confirmDelivery(orderId, deliveryCodeInput.trim());
      setOrder(updated);
      setDeliveryCodeInput('');
      stopBroadcasting();
      Alert.alert('Delivered ✓', 'Delivery confirmed. Great job!');
    } catch (err) {
      Alert.alert('Delivery failed', err.response?.data?.message || 'Incorrect code. Ask the customer for the code in their app.');
    } finally {
      setBusy(false);
    }
  }

  if (loading || !order) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Order #{order._id.slice(-6).toUpperCase()}</Text>
      <Text style={styles.status}>{STATUS_LABEL[order.status] || order.status}</Text>

      {order.deliveryLocation?.lat != null && (
        <View style={styles.map}>
          <WebView
            source={{ uri: osmEmbed(order.deliveryLocation.lat, order.deliveryLocation.lng) }}
            style={{ flex: 1 }}
            scrollEnabled={false}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.mapLoading}>
                <ActivityIndicator color={colors.primary} />
              </View>
            )}
          />
        </View>
      )}
      <View style={styles.navRow}>
        {(order.type === 'courier' ? order.pickupLocation : order.shop?.location)?.lat != null && (
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => {
              const p = order.type === 'courier' ? order.pickupLocation : order.shop.location;
              navigateTo(p.lat, p.lng);
            }}
          >
            <Text style={styles.navBtnText}>🗺 Navigate to pickup</Text>
          </TouchableOpacity>
        )}
        {order.deliveryLocation?.lat != null && (
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => navigateTo(order.deliveryLocation.lat, order.deliveryLocation.lng)}
          >
            <Text style={styles.navBtnText}>🗺 Navigate to drop</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>① Pick up {order.type === 'courier' ? '(food pickup)' : 'from shop'}</Text>
        {order.type === 'courier' ? (
          <>
            <Text style={styles.strong}>{order.pickupAddress}</Text>
            {order.packageNote ? <Text style={styles.text}>Food: {order.packageNote}</Text> : null}
            {order.pickupLocation?.lat != null && (
              <TouchableOpacity onPress={() => openInMaps(order.pickupLocation.lat, order.pickupLocation.lng, 'Pickup')}>
                <Text style={styles.mapLink}>📍 Open pickup in maps</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            <Text style={styles.strong}>{order.shop?.name || 'Shop'}</Text>
            {order.shop?.address ? <Text style={styles.text}>{order.shop.address}</Text> : null}
            {order.shop?.location && (
              <TouchableOpacity onPress={() => openInMaps(order.shop.location.lat, order.shop.location.lng, order.shop.name)}>
                <Text style={styles.mapLink}>📍 Open shop in maps</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>② Deliver to customer</Text>
        <Text style={styles.strong}>{order.user?.name}</Text>
        <Text style={styles.text}>{order.user?.phone || order.phone}</Text>
        <Text style={styles.text}>{order.deliveryAddress}</Text>
        {order.deliveryLocation?.lat != null && (
          <TouchableOpacity onPress={() => openInMaps(order.deliveryLocation.lat, order.deliveryLocation.lng, 'Delivery address')}>
            <Text style={styles.mapLink}>📍 Open delivery address in maps</Text>
          </TouchableOpacity>
        )}
        {order.phone ? (
          <TouchableOpacity onPress={() => Linking.openURL(`tel:${order.user?.phone || order.phone}`)}>
            <Text style={styles.mapLink}>📞 Call customer</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Order</Text>
        {order.items.map((item, idx) => (
          <Text key={idx} style={styles.text}>
            {item.quantity}× {item.name}
            {item.weight ? ` (${item.weight})` : ''}
          </Text>
        ))}
        <Text style={styles.meta}>
          {order.distanceKm ? `${order.distanceKm} km · ` : ''}Delivery fee ₹{order.deliveryFee ?? 0} · Total ₹{order.totalAmount}
        </Text>
        <Text style={styles.meta}>
          Payment: {order.paymentMethod || 'COD'}
          {order.deliveryDate ? ` · Deliver by ${new Date(order.deliveryDate).toLocaleDateString()}` : ''}
        </Text>
        {order.tipAmount > 0 && <Text style={styles.tipLine}>🎉 Customer tip for you: ₹{order.tipAmount}</Text>}
      </View>

      <TouchableOpacity
        style={styles.chatButton}
        onPress={() => navigation.navigate('Chat', { orderId: order._id, title: order.user?.name || 'Customer' })}
      >
        <Text style={styles.chatButtonText}>💬 Chat with customer</Text>
      </TouchableOpacity>

      {order.type !== 'courier' && (
        <TouchableOpacity
          style={styles.chatButton}
          onPress={() => navigation.navigate('Chat', { orderId: order._id, channel: 'pickup', title: order.shop?.name || 'Shop' })}
        >
          <Text style={styles.chatButtonText}>🏪 Chat with shop (pickup)</Text>
        </TouchableOpacity>
      )}

      {(order.status === 'confirmed' || order.status === 'baking' || order.status === 'ready') && (
        <TouchableOpacity style={styles.button} onPress={handleHeadingToShop} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>🛵 I'm on my way to the shop</Text>}
        </TouchableOpacity>
      )}

      {order.status === 'heading_to_shop' && (
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>Enter the pickup code shown by the shop to confirm pickup:</Text>
          <TextInput
            style={styles.codeInput}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="6-digit code"
            value={pickupCodeInput}
            onChangeText={setPickupCodeInput}
          />
          <TouchableOpacity style={styles.button} onPress={handleConfirmPickup} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>📦 Confirm pickup</Text>}
          </TouchableOpacity>
        </View>
      )}

      {order.status === 'out_for_delivery' && (
        <>
          <Text style={styles.trackingNote}>
            {tracking ? '🟢 Sharing live location with customer...' : 'Location sharing is off.'}
          </Text>
          {!tracking && (
            <TouchableOpacity style={styles.button} onPress={startBroadcasting}>
              <Text style={styles.buttonText}>Resume sharing location</Text>
            </TouchableOpacity>
          )}
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>
              At the door, ask the customer for the 6-digit delivery code in their app. Enter it to confirm hand-over to the right person:
            </Text>
            <TextInput
              style={styles.codeInput}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="6-digit delivery code"
              value={deliveryCodeInput}
              onChangeText={setDeliveryCodeInput}
            />
            <TouchableOpacity style={styles.button} onPress={handleConfirmDelivery} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>✓ Confirm delivery</Text>}
            </TouchableOpacity>
          </View>
        </>
      )}

      {order.status === 'delivered' && (
        <View style={[styles.section, { alignItems: 'center' }]}>
          <Text style={{ color: colors.success, fontWeight: '700', fontSize: 16 }}>✓ Delivered</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { padding: 16 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  status: { fontSize: 13, color: colors.primary, fontWeight: '600', marginTop: 4, marginBottom: 16, textTransform: 'capitalize' },
  section: {
    marginBottom: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.primary, marginBottom: 6 },
  strong: { color: colors.text, fontWeight: '700', fontSize: 15, marginBottom: 2 },
  text: { color: colors.text, marginBottom: 2 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 6 },
  tipLine: { color: colors.success, fontSize: 13, fontWeight: '700', marginTop: 8 },
  mapLink: { color: colors.primary, fontWeight: '600', marginTop: 6 },
  chatButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  chatButtonText: { color: colors.primary, fontWeight: '600' },
  button: { backgroundColor: colors.primary, borderRadius: 8, padding: 14, alignItems: 'center', marginBottom: 12 },
  buttonText: { color: '#fff', fontWeight: '600' },
  trackingNote: { color: colors.muted, marginBottom: 10, fontSize: 12 },
  codeBox: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  map: { width: '100%', height: 180, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.border, marginBottom: 10 },
  mapLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  navRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  navBtn: { flex: 1, borderWidth: 1, borderColor: colors.primary, borderRadius: 8, padding: 10, alignItems: 'center' },
  navBtnText: { color: colors.primary, fontWeight: '600', fontSize: 12 },
  codeLabel: { color: colors.text, fontSize: 13, marginBottom: 8 },
  codeInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 10,
  },
});

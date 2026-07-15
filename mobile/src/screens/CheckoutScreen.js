import React, {useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Linking,
} from 'react-native';
import {useCart} from '../context/CartContext';
import {useAuth} from '../context/AuthContext';
import {placeOrder, createRazorpayOrder, reportPaymentFailure, listMyOrders} from '../api/orders';
import {deliveryQuote} from '../api/shops';
import {getPaymentInfo} from '../api/ledger';
import {requestLocationPermission, getCurrentPosition} from '../location';
import {colors} from '../theme';

function isCustomizedItem(item) {
  return Boolean(
    item.isCustom ||
      item.flavor ||
      item.messageOnCake ||
      item.referencePhotoUrl,
  );
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

const TIP_OPTIONS = [0, 10, 20, 30, 50];

export default function CheckoutScreen({navigation}) {
  const {items, shop, total: itemsTotal, clear} = useCart();
  const {user} = useAuth();
  const [deliveryAddress, setDeliveryAddress] = useState(user?.address || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [deliverySlot, setDeliverySlot] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [tip, setTip] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('COD'); // 'COD' | 'upi' | 'online'
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [upiInfo, setUpiInfo] = useState(null);
  const [upiReference, setUpiReference] = useState('');

  useEffect(() => {
    getPaymentInfo().then(setUpiInfo).catch(() => {});
  }, []);

  // Delivery location + fee quote
  const [location, setLocation] = useState(null); // { lat, lng }
  const [quote, setQuote] = useState(null); // { distanceKm, deliveryFee, perKmRate }
  const [locating, setLocating] = useState(false);

  // Addresses used on past orders, so a returning customer can pick one instead of
  // retyping — most recent first, deduplicated by address text.
  const [previousAddresses, setPreviousAddresses] = useState([]);

  useEffect(() => {
    listMyOrders()
      .then((orders) => {
        const seen = new Set();
        const unique = [];
        // listMyOrders is sorted most-recent-first, so unique[0] is the last address used.
        orders.forEach((o) => {
          if (!o.deliveryAddress || seen.has(o.deliveryAddress)) return;
          seen.add(o.deliveryAddress);
          unique.push({address: o.deliveryAddress, location: o.deliveryLocation});
        });
        setPreviousAddresses(unique.slice(0, 5));
        // Pre-fill with the most recent delivery address so a returning customer doesn't
        // have to type or pick anything — they just confirm it (or tap another one/change it).
        if (unique.length > 0) {
          usePreviousAddress(unique[0]);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function usePreviousAddress(saved) {
    setDeliveryAddress(saved.address);
    if (saved.location?.lat != null && saved.location?.lng != null) {
      setLocation(saved.location);
      if (shop?._id) {
        deliveryQuote(shop._id, saved.location.lat, saved.location.lng)
          .then(setQuote)
          .catch(() => {});
      }
    }
  }

  const needsLeadTime = useMemo(() => items.some(isCustomizedItem), [items]);
  const minDateStr = useMemo(
    () => formatDate(addDays(new Date(), needsLeadTime ? 1 : 0)),
    [needsLeadTime],
  );
  const [deliveryDate, setDeliveryDate] = useState(minDateStr);

  const grandTotal = itemsTotal + (quote?.deliveryFee || 0) + tip;

  async function useMyLocation() {
    setError('');
    setLocating(true);
    try {
      const granted = await requestLocationPermission();
      if (!granted) {
        setError(
          'Location permission is needed to calculate the delivery charge. Please allow it in settings.',
        );
        return;
      }
      const pos = await getCurrentPosition();
      setLocation(pos);
      if (shop?._id) {
        const q = await deliveryQuote(shop._id, pos.lat, pos.lng);
        setQuote(q);
      }
    } catch (err) {
      setError(err.message || 'Could not get your location. Please try again.');
    } finally {
      setLocating(false);
    }
  }

  async function payViaUpiApp() {
    if (!upiInfo?.upiId) {
      setError('The admin has not added a UPI ID yet. Please choose Cash on Delivery.');
      return;
    }
    const url =
      `upi://pay?pa=${encodeURIComponent(upiInfo.upiId)}` +
      `&pn=${encodeURIComponent(upiInfo.payeeName || 'Munchbox')}` +
      `&am=${grandTotal}&cu=INR` +
      `&tn=${encodeURIComponent(`Munchbox order at ${shop?.name || ''}`)}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        setError(`No UPI app found. Pay ₹${grandTotal} to UPI ID: ${upiInfo.upiId}, then enter the reference below.`);
        return;
      }
      await Linking.openURL(url);
    } catch (err) {
      setError('Could not open a UPI app. Pay manually and enter the reference below.');
    }
  }

  async function handlePlaceOrder() {
    if (!deliveryAddress || !phone) {
      setError('Delivery address and phone are required');
      return;
    }
    if (paymentMethod === 'upi' && !upiReference.trim()) {
      setError('Pay via UPI first, then enter the reference/transaction ID below.');
      return;
    }
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate) ||
      Number.isNaN(new Date(deliveryDate).getTime())
    ) {
      setError('Delivery date must be in YYYY-MM-DD format');
      return;
    }
    if (deliveryDate < minDateStr) {
      setError(
        needsLeadTime
          ? `Customized cakes need at least 1 day advance notice. Earliest delivery: ${minDateStr}`
          : `Delivery date cannot be before ${minDateStr}`,
      );
      return;
    }

    const orderPayload = {
      shop: shop._id,
      items: items.map(({key, ...rest}) => rest),
      deliveryAddress,
      phone,
      deliveryLocation: location,
      deliveryDate,
      deliverySlot: deliverySlot || undefined,
      couponCode: couponCode || undefined,
      tip,
    };

    setError('');
    setSubmitting(true);
    try {
      if (paymentMethod === 'upi') {
        await placeOrder({
          ...orderPayload,
          paymentMethod: 'upi',
          payment: {upiReference: upiReference.trim()},
        });
        clear();
        navigation.reset({index: 0, routes: [{name: 'Orders'}]});
        return;
      }

      if (paymentMethod === 'online') {
        const checkoutOrder = await createRazorpayOrder(orderPayload);
        setSubmitting(false);
        navigation.navigate('RazorpayCheckout', {
          razorpayOrderId: checkoutOrder.razorpayOrderId,
          amount: checkoutOrder.amount,
          currency: checkoutOrder.currency,
          keyId: checkoutOrder.keyId,
          description: `Order at ${shop?.name || 'Munchbox'}`,
          prefill: {name: user?.name || '', email: user?.email || '', contact: phone},
          onSuccess: async (result) => {
            setSubmitting(true);
            try {
              await placeOrder({
                ...orderPayload,
                paymentMethod: 'online',
                payment: {
                  razorpayOrderId: result.razorpay_order_id,
                  razorpayPaymentId: result.razorpay_payment_id,
                  razorpaySignature: result.razorpay_signature,
                },
              });
              clear();
              navigation.reset({index: 0, routes: [{name: 'Orders'}]});
            } catch (err) {
              setError(err.response?.data?.message || 'Payment succeeded but the order could not be placed. Please contact support — do not pay again.');
            } finally {
              setSubmitting(false);
            }
          },
          onFailure: (reason) => {
            reportPaymentFailure({
              amount: checkoutOrder.totalAmount,
              reason,
              razorpayOrderId: checkoutOrder.razorpayOrderId,
            }).catch(() => {});
            setError(reason === 'Payment cancelled' ? 'Payment cancelled.' : `Payment failed: ${reason}. You can try again or pay Cash on Delivery.`);
          },
        });
        return;
      }

      await placeOrder({...orderPayload, paymentMethod: 'COD'});
      clear();
      navigation.reset({index: 0, routes: [{name: 'Orders'}]});
    } catch (err) {
      setError(err.response?.data?.message || 'Could not place order');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Checkout</Text>
      {shop ? <Text style={styles.shop}>🏪 {shop.name}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {previousAddresses.length > 0 && (
        <>
          <Text style={styles.label}>Use a previous address</Text>
          <View style={styles.addressChipRow}>
            {previousAddresses.map((saved) => (
              <TouchableOpacity
                key={saved.address}
                style={[styles.addressChip, deliveryAddress === saved.address && styles.addressChipActive]}
                onPress={() => usePreviousAddress(saved)}>
                <Text
                  style={[
                    styles.addressChipText,
                    deliveryAddress === saved.address && styles.addressChipTextActive,
                  ]}
                  numberOfLines={2}>
                  📍 {saved.address}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <Text style={styles.label}>Delivery address</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        multiline
        value={deliveryAddress}
        onChangeText={setDeliveryAddress}
        placeholder="Flat, street, city, pincode"
      />

      <Text style={styles.label}>Delivery location (for distance charge)</Text>
      <TouchableOpacity
        style={styles.locButton}
        onPress={useMyLocation}
        disabled={locating}>
        {locating ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.locButtonText}>
            {location
              ? '✓ Location set — tap to update'
              : '📍 Use my current location'}
          </Text>
        )}
      </TouchableOpacity>

      <Text style={styles.label}>Phone</Text>
      <TextInput
        style={styles.input}
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />

      <Text style={styles.label}>Delivery date</Text>
      <TextInput
        style={styles.input}
        value={deliveryDate}
        onChangeText={setDeliveryDate}
        placeholder="YYYY-MM-DD"
      />
      {needsLeadTime && (
        <Text style={styles.hint}>
          Your order includes customization, so it needs at least 1 day to
          prepare. Earliest delivery: {minDateStr}
        </Text>
      )}

      <Text style={styles.label}>Delivery slot (optional)</Text>
      <TextInput
        style={styles.input}
        value={deliverySlot}
        onChangeText={setDeliverySlot}
        placeholder="e.g. 5-7 PM"
      />

      <Text style={styles.label}>Coupon code (optional)</Text>
      <TextInput
        style={styles.input}
        value={couponCode}
        onChangeText={setCouponCode}
        autoCapitalize="characters"
        placeholder="WELCOME123456"
      />

      <Text style={styles.label}>Payment method</Text>
      <View style={styles.tipRow}>
        <TouchableOpacity
          style={[styles.tipChip, paymentMethod === 'COD' && styles.tipChipActive]}
          onPress={() => setPaymentMethod('COD')}>
          <Text style={[styles.tipChipText, paymentMethod === 'COD' && styles.tipChipTextActive]}>
            💵 Cash on Delivery
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tipChip, paymentMethod === 'upi' && styles.tipChipActive]}
          onPress={() => setPaymentMethod('upi')}>
          <Text style={[styles.tipChipText, paymentMethod === 'upi' && styles.tipChipTextActive]}>
            📱 Pay via UPI
          </Text>
        </TouchableOpacity>
      </View>

      {paymentMethod === 'upi' && (
        <View style={styles.upiBox}>
          <Text style={styles.hint}>
            Tap to pay with any UPI app (PhonePe, Google Pay, etc.), then enter the reference number you get after
            paying. The shop will confirm it before preparing your order.
          </Text>
          <TouchableOpacity style={styles.locButton} onPress={payViaUpiApp}>
            <Text style={styles.locButtonText}>📱 Pay ₹{grandTotal} via UPI app</Text>
          </TouchableOpacity>
          {upiInfo?.upiId ? (
            <Text style={styles.hint}>Or pay manually to UPI ID: {upiInfo.upiId}</Text>
          ) : null}
          <Text style={styles.label}>UPI reference / transaction ID</Text>
          <TextInput
            style={styles.input}
            value={upiReference}
            onChangeText={setUpiReference}
            placeholder="e.g. 123456789012"
          />
        </View>
      )}

      <Text style={styles.label}>Tip your delivery partner (optional)</Text>
      <View style={styles.tipRow}>
        {TIP_OPTIONS.map((amount) => (
          <TouchableOpacity
            key={amount}
            style={[styles.tipChip, tip === amount && styles.tipChipActive]}
            onPress={() => setTip(amount)}>
            <Text style={[styles.tipChipText, tip === amount && styles.tipChipTextActive]}>
              {amount === 0 ? 'No tip' : `₹${amount}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Items</Text>
          <Text style={styles.summaryValue}>₹{itemsTotal}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>
            Delivery{' '}
            {quote ? `(${quote.distanceKm} km × ₹${quote.perKmRate}/km)` : ''}
          </Text>
          <Text style={styles.summaryValue}>
            {quote ? `₹${quote.deliveryFee}` : '— set location'}
          </Text>
        </View>
        {tip > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tip for delivery partner</Text>
            <Text style={styles.summaryValue}>₹{tip}</Text>
          </View>
        )}
        <View style={[styles.summaryRow, styles.summaryTotalRow]}>
          <Text style={styles.summaryTotalLabel}>Total</Text>
          <Text style={styles.summaryTotalValue}>₹{grandTotal}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={handlePlaceOrder}
        disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {paymentMethod === 'upi'
              ? 'Submit order (UPI paid)'
              : paymentMethod === 'online'
              ? `Pay ₹${grandTotal} online`
              : 'Place order (Cash on Delivery)'}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.bg},
  content: {padding: 16},
  title: {fontSize: 22, fontWeight: '700', color: colors.text},
  shop: {fontSize: 13, color: colors.muted, marginTop: 2, marginBottom: 8},
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
  },
  multiline: {minHeight: 70, textAlignVertical: 'top'},
  locButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  locButtonText: {color: colors.primary, fontWeight: '600'},
  hint: {fontSize: 12, color: colors.muted, marginTop: 6},
  addressChipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4},
  addressChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.card,
    maxWidth: '100%',
  },
  addressChipActive: {borderColor: colors.primary, backgroundColor: colors.primary},
  addressChipText: {fontSize: 12, color: colors.text},
  addressChipTextActive: {color: '#fff', fontWeight: '600'},
  upiBox: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginTop: 10,
  },
  tipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  tipChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.card,
  },
  tipChipActive: {borderColor: colors.primary, backgroundColor: colors.primary},
  tipChipText: {fontSize: 13, fontWeight: '600', color: colors.text},
  tipChipTextActive: {color: '#fff'},
  summary: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginTop: 20,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {color: colors.muted, fontSize: 13, flex: 1},
  summaryValue: {color: colors.text, fontSize: 13, fontWeight: '600'},
  summaryTotalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    marginBottom: 0,
  },
  summaryTotalLabel: {color: colors.text, fontSize: 16, fontWeight: '700'},
  summaryTotalValue: {color: colors.primary, fontSize: 16, fontWeight: '700'},
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 32,
  },
  buttonText: {color: '#fff', fontWeight: '600'},
  error: {color: '#c62828', marginBottom: 12, marginTop: 8},
});

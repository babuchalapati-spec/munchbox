import React, {useState} from 'react';
import {View, Text, TextInput, TouchableOpacity, ActivityIndicator, Linking, Alert, StyleSheet} from 'react-native';
import {useAuth} from '../context/AuthContext';
import {getPaymentInfo, requestTopUp, createRazorpayTopUpOrder, verifyRazorpayTopUp} from '../api/ledger';
import {colors} from '../theme';

// Shared by the shop owner and delivery partner apps: add balance either instantly via
// Razorpay, or by paying the admin's UPI id and submitting the reference for the admin
// to confirm manually. navigation is passed in (not read via a hook) to match how the
// rest of the app wires screens together.
export default function WalletTopUp({navigation, onDone}) {
  const {user} = useAuth();
  const [state, setState] = useState({amount: '', reference: '', open: false, busy: false});

  function reset() {
    setState({amount: '', reference: '', open: false, busy: false});
  }

  async function payOnline() {
    const amount = Number(state.amount);
    if (!amount || amount <= 0) {
      Alert.alert('Enter amount', 'How much do you want to add?');
      return;
    }
    setState((s) => ({...s, busy: true}));
    try {
      const order = await createRazorpayTopUpOrder(amount);
      navigation.navigate('RazorpayCheckout', {
        razorpayOrderId: order.razorpayOrderId,
        amount: order.amount,
        currency: order.currency,
        keyId: order.keyId,
        description: 'Munchbox wallet top-up',
        prefill: {name: user?.name || '', email: user?.email || '', contact: user?.phone || ''},
        onSuccess: async (result) => {
          try {
            const res = await verifyRazorpayTopUp({
              razorpayOrderId: result.razorpay_order_id,
              razorpayPaymentId: result.razorpay_payment_id,
              razorpaySignature: result.razorpay_signature,
            });
            reset();
            Alert.alert('Balance added', res.message || 'Your balance has been credited.');
            onDone && onDone();
          } catch (err) {
            Alert.alert(
              'Could not confirm payment',
              err.response?.data?.message || 'If money was deducted, contact the admin — do not pay again.',
            );
            setState((s) => ({...s, busy: false}));
          }
        },
        onFailure: (reason) => {
          Alert.alert('Payment not completed', reason === 'Payment cancelled' ? 'Payment cancelled.' : `Payment failed: ${reason}. You can try again or pay by UPI below.`);
          setState((s) => ({...s, busy: false}));
        },
      });
    } catch (err) {
      Alert.alert('Could not start payment', err.response?.data?.message || 'Try again');
      setState((s) => ({...s, busy: false}));
    }
  }

  // Opens the admin's UPI app (GPay/PhonePe/Paytm) for the manual/admin-confirmed path.
  async function payByUpi() {
    const amount = Number(state.amount);
    if (!amount || amount <= 0) {
      Alert.alert('Enter amount', 'How much do you want to add?');
      return;
    }
    try {
      const info = await getPaymentInfo();
      if (!info?.upiId) {
        Alert.alert('UPI not set up', 'The admin has not added a UPI ID yet. Please contact the admin.');
        return;
      }
      const url =
        `upi://pay?pa=${encodeURIComponent(info.upiId)}` +
        `&pn=${encodeURIComponent(info.payeeName || 'Munchbox')}` +
        `&am=${amount}&cu=INR` +
        `&tn=${encodeURIComponent('Munchbox balance top-up')}`;
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('No UPI app', `Pay ₹${amount} to UPI ID:\n\n${info.upiId}\n\nThen enter the reference number below.`);
        return;
      }
      await Linking.openURL(url);
    } catch (err) {
      Alert.alert('Error', 'Could not open your UPI app. Pay the admin and enter the reference below.');
    }
  }

  async function submitUpiTopUp() {
    const amount = Number(state.amount);
    if (!amount || amount <= 0) {
      Alert.alert('Enter amount', 'Enter the amount you paid.');
      return;
    }
    setState((s) => ({...s, busy: true}));
    try {
      const res = await requestTopUp(amount, state.reference.trim());
      reset();
      Alert.alert('Payment submitted', res.message || 'The admin will confirm and credit your balance.');
      onDone && onDone();
    } catch (err) {
      Alert.alert('Could not submit', err.response?.data?.message || 'Try again');
      setState((s) => ({...s, busy: false}));
    }
  }

  if (!state.open) {
    return (
      <TouchableOpacity style={styles.openBtn} onPress={() => setState((s) => ({...s, open: true}))}>
        <Text style={styles.openBtnText}>＋ Add balance</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.box}>
      <TextInput
        style={styles.input}
        placeholder="Amount ₹ (e.g. 1000)"
        keyboardType="number-pad"
        value={state.amount}
        onChangeText={(v) => setState((s) => ({...s, amount: v.replace(/[^0-9]/g, '')}))}
      />
      <TouchableOpacity style={styles.payBtn} onPress={payOnline} disabled={state.busy}>
        {state.busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.payBtnText}>💳 Pay ₹{state.amount || '0'} online (instant)</Text>}
      </TouchableOpacity>
      <Text style={styles.or}>— or —</Text>
      <TouchableOpacity style={styles.payBtnOutline} onPress={payByUpi}>
        <Text style={styles.payBtnOutlineText}>Pay ₹{state.amount || '0'} via UPI app</Text>
      </TouchableOpacity>
      <Text style={styles.muted}>After paying by UPI, enter the reference number and submit (admin confirms manually):</Text>
      <TextInput
        style={styles.input}
        placeholder="UPI reference / transaction ID"
        value={state.reference}
        onChangeText={(v) => setState((s) => ({...s, reference: v}))}
      />
      <View style={styles.row}>
        <TouchableOpacity style={[styles.cancelBtn, {flex: 1}]} onPress={reset}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.submitBtn} onPress={submitUpiTopUp} disabled={state.busy}>
          {state.busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit UPI payment</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  openBtn: {backgroundColor: colors.primary, borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 8},
  openBtnText: {color: '#fff', fontWeight: '700'},
  box: {backgroundColor: colors.bg, borderRadius: 10, padding: 10, marginTop: 10},
  input: {backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, marginBottom: 8},
  payBtn: {backgroundColor: colors.primary, borderRadius: 8, padding: 12, alignItems: 'center'},
  payBtnText: {color: '#fff', fontWeight: '700'},
  or: {textAlign: 'center', color: colors.muted, fontSize: 12, marginVertical: 8},
  payBtnOutline: {borderWidth: 1, borderColor: colors.primary, borderRadius: 8, padding: 12, alignItems: 'center'},
  payBtnOutlineText: {color: colors.primary, fontWeight: '700'},
  muted: {color: colors.muted, fontSize: 12, marginTop: 10, marginBottom: 6},
  row: {flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4},
  cancelBtn: {borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, alignItems: 'center'},
  cancelBtnText: {color: colors.text, fontWeight: '600'},
  submitBtn: {backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center'},
  submitBtnText: {color: '#fff', fontWeight: '700'},
});

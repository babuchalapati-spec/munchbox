import React, {useState} from 'react';
import {View, Text, StyleSheet, ActivityIndicator} from 'react-native';
import {WebView} from 'react-native-webview';
import {colors} from '../theme';

// Loads Razorpay's own hosted checkout inside a WebView — the same approach already
// used for the delivery tracking map, so payments work without adding a native SDK
// (avoids the release-build crash risk we hit with react-native-maps).
function buildCheckoutHtml({keyId, amount, currency, orderId, name, description, prefill, themeColor}) {
  const options = {
    key: keyId,
    amount,
    currency,
    name: 'Munchbox',
    description,
    order_id: orderId,
    prefill,
    theme: {color: themeColor},
  };
  return `<!DOCTYPE html>
<html>
<head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#fff;">
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
  function post(msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  }
  try {
    var options = ${JSON.stringify(options)};
    options.handler = function (response) {
      post({
        type: 'success',
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_order_id: response.razorpay_order_id,
        razorpay_signature: response.razorpay_signature,
      });
    };
    options.modal = { ondismiss: function () { post({ type: 'dismiss' }); } };
    var rzp = new Razorpay(options);
    rzp.on('payment.failed', function (response) {
      post({ type: 'failed', reason: (response.error && response.error.description) || 'Payment failed' });
    });
    rzp.open();
  } catch (e) {
    post({ type: 'failed', reason: 'Could not load payment screen' });
  }
</script>
</body>
</html>`;
}

// route.params: { razorpayOrderId, amount, currency, keyId, name, description, prefill,
// onSuccess(response), onFailure(reason) }
export default function RazorpayCheckoutScreen({route, navigation}) {
  const {razorpayOrderId, amount, currency, keyId, description, prefill, onSuccess, onFailure} = route.params;
  const [loading, setLoading] = useState(true);

  const html = buildCheckoutHtml({
    keyId,
    amount,
    currency,
    orderId: razorpayOrderId,
    description,
    prefill,
    themeColor: colors.primary,
  });

  function handleMessage(event) {
    let payload;
    try {
      payload = JSON.parse(event.nativeEvent.data);
    } catch (e) {
      return;
    }
    if (payload.type === 'success') {
      navigation.goBack();
      onSuccess && onSuccess(payload);
    } else if (payload.type === 'failed') {
      navigation.goBack();
      onFailure && onFailure(payload.reason || 'Payment failed');
    } else if (payload.type === 'dismiss') {
      navigation.goBack();
      onFailure && onFailure('Payment cancelled');
    }
  }

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Opening secure payment…</Text>
        </View>
      )}
      <WebView
        source={{html}}
        onMessage={handleMessage}
        onLoadEnd={() => setLoading(false)}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  webview: {flex: 1},
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  loadingText: {marginTop: 12, color: colors.muted},
});

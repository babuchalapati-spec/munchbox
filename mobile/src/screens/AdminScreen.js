import React, {useRef, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  BackHandler,
  RefreshControl,
  ScrollView,
} from 'react-native';
import {WebView} from 'react-native-webview';
import {useNavigation} from '../navigation/StackNavigator';
import {API_URL} from '../api/client';
import {colors} from '../theme';

// The admin app wraps the existing admin dashboard rather than reimplementing it in
// React Native: the dashboard is a full Vite/React app the backend already serves at
// /admin, so shipping it in a WebView means an admin UI change goes live on the next
// pull-to-refresh with no new APK.
function adminUrl() {
  return `${API_URL.replace(/\/api\/?$/, '')}/admin`;
}

export default function AdminScreen() {
  const navigation = useNavigation();
  const webRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canGoBack, setCanGoBack] = useState(false);
  const url = adminUrl();

  // Android's hardware back button should walk back through the dashboard's own pages
  // before it closes the app.
  React.useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && webRef.current) {
        webRef.current.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]);

  function reload() {
    setError('');
    setLoading(true);
    webRef.current?.reload();
  }

  if (error) {
    return (
      <ScrollView
        contentContainerStyle={styles.errorWrap}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}>
        <Text style={styles.errorTitle}>Can't reach the dashboard</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.errorUrl}>{url}</Text>
        <TouchableOpacity style={styles.btn} onPress={reload}>
          <Text style={styles.btnText}>Try again</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnGhost]}
          onPress={() => navigation.navigate('ServerSettings')}>
          <Text style={styles.btnGhostText}>Server settings</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webRef}
        source={{uri: url}}
        onLoadEnd={() => setLoading(false)}
        onNavigationStateChange={(nav) => setCanGoBack(nav.canGoBack)}
        onError={(e) => {
          setLoading(false);
          setError(e.nativeEvent?.description || 'The server did not respond.');
        }}
        onHttpError={(e) => {
          setLoading(false);
          setError(`Server returned ${e.nativeEvent?.statusCode}.`);
        }}
        // The dashboard stores its admin token in localStorage, so logging in has to
        // survive the app being closed.
        domStorageEnabled
        javaScriptEnabled
        // Uploads (shop images, menu photos) are opened from the dashboard's file input.
        allowFileAccess
        originWhitelist={['*']}
        pullToRefreshEnabled
        startInLoadingState
      />
      {loading && (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.bg},
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  errorWrap: {flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24},
  errorTitle: {fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8},
  errorText: {color: colors.muted, textAlign: 'center', marginBottom: 6},
  errorUrl: {color: colors.muted, fontSize: 12, marginBottom: 20},
  btn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  btnText: {color: '#fff', fontWeight: '700'},
  btnGhost: {backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border},
  btnGhostText: {color: colors.text, fontWeight: '600'},
});

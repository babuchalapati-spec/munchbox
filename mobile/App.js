import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import RootNavigator from './src/navigation/RootNavigator';
import { watchForUpdates } from './src/updateCheck';
import { loadServerUrlOverride } from './src/api/client';
import { AppTypeProvider } from './src/appType';
import ErrorBoundary from './src/ErrorBoundary';
import { colors } from './src/theme';

// `appType` is set by index.js from the Android product flavor and is what makes this
// build the customer, partner, shop or admin app. It decides which screens exist and
// which APK the update check looks for.
export default function App({ appType = 'customer' }) {
  // Applies any saved server-address override (see ServerSettingsScreen) before any
  // screen makes its first API call, so a stale build-time address never gets used.
  const [serverReady, setServerReady] = useState(false);

  useEffect(() => {
    try {
      loadServerUrlOverride().finally(() => setServerReady(true));
    } catch (err) {
      console.error('Startup error in loadServerUrlOverride:', err);
      setServerReady(true); // Allow app to boot so ErrorBoundary can display the error
    }
  }, []);

  useEffect(() => {
    if (!serverReady) return undefined;
    const stopWatching = watchForUpdates(appType);
    return () => stopWatching();
  }, [serverReady, appType]);

  if (!serverReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <AppTypeProvider appType={appType}>
        <AuthProvider>
          <CartProvider>
            <RootNavigator appType={appType} />
          </CartProvider>
        </AuthProvider>
      </AppTypeProvider>
    </ErrorBoundary>
  );
}

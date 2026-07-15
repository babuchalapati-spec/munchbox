import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import RootNavigator from './src/navigation/RootNavigator';
import { watchForUpdates } from './src/updateCheck';
import { loadServerUrlOverride } from './src/api/client';
import { colors } from './src/theme';

export default function App() {
  // Applies any saved server-address override (see ServerSettingsScreen) before any
  // screen makes its first API call, so a stale build-time address never gets used.
  const [serverReady, setServerReady] = useState(false);

  useEffect(() => {
    loadServerUrlOverride().finally(() => setServerReady(true));
  }, []);

  useEffect(() => {
    if (!serverReady) return undefined;
    const stopWatching = watchForUpdates();
    return () => stopWatching();
  }, [serverReady]);

  if (!serverReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <AuthProvider>
      <CartProvider>
        <RootNavigator />
      </CartProvider>
    </AuthProvider>
  );
}

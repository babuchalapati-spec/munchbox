import React, { useEffect } from 'react';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import RootNavigator from './src/navigation/RootNavigator';
import { watchForUpdates } from './src/updateCheck';

export default function App() {
  useEffect(() => {
    const stopWatching = watchForUpdates();
    return () => stopWatching();
  }, []);

  return (
    <AuthProvider>
      <CartProvider>
        <RootNavigator />
      </CartProvider>
    </AuthProvider>
  );
}

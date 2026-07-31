import { NativeModules, Platform } from 'react-native';

const { LocationTrackingModule } = NativeModules;

// True once the app has been rebuilt with the native LocationTrackingService (Android only).
// Older installs that haven't been rebuilt yet simply don't have this native module linked —
// callers should fall back to the JS watchPosition-based tracking in that case.
export function hasBackgroundTracking() {
  return Platform.OS === 'android' && !!LocationTrackingModule;
}

// Starts the native foreground service that keeps sending GPS fixes for `orderId` to the
// backend even while the app is backgrounded or the screen is locked.
export function startBackgroundTracking(orderId, token, baseUrl) {
  if (!hasBackgroundTracking()) return;
  LocationTrackingModule.startTracking(orderId, token || '', baseUrl);
}

export function stopBackgroundTracking() {
  if (!hasBackgroundTracking()) return;
  LocationTrackingModule.stopTracking();
}

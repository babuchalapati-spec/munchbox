import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

// Allow the app to fall back to network (WiFi/cell) location, which works indoors
// and even when the GPS radio is off. 'auto' lets Android pick the best provider.
// Deferred to first actual use (not run at module load) so a native-module hiccup here
// can't crash the app before anything ever renders — every screen gets pulled into the
// bundle by RootNavigator regardless of role, so this file loads on every app launch.
let configured = false;
function ensureConfigured() {
  if (configured) return;
  configured = true;
  try {
    Geolocation.setRNConfiguration({ authorizationLevel: 'whenInUse', locationProvider: 'auto' });
  } catch (err) {
    console.error('Geolocation.setRNConfiguration failed:', err);
  }
}

export async function requestLocationPermission() {
  ensureConfigured();
  if (Platform.OS !== 'android') return true;
  try {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
      title: 'Location permission',
      message: 'Munchbox needs your location to calculate delivery distance and share live tracking.',
      buttonPositive: 'Allow',
    });
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    return false;
  }
}

function once(options) {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      options
    );
  });
}

// Try a precise GPS fix first; if that fails or times out (common indoors or with
// GPS off), retry with a coarse network fix. Throws an Error with a friendly message.
export async function getCurrentPosition() {
  try {
    return await once({ enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 });
  } catch (highErr) {
    try {
      return await once({ enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 });
    } catch (lowErr) {
      const code = lowErr?.code;
      if (code === 1) throw new Error('Location permission was denied. Enable it in your phone settings.');
      if (code === 2) throw new Error('Location is turned off. Please turn on Location/GPS in your phone and try again.');
      if (code === 3) throw new Error('Getting your location timed out. Move to an open area and try again.');
      throw new Error('Could not get your location. Make sure Location is turned on.');
    }
  }
}

// "Allow all the time" — needed so the live-tracking foreground service (see
// nativeLocationTracking.js) keeps getting GPS fixes once the Partner app is
// backgrounded or the phone is locked, not just while it's on screen. Android 11+
// generally won't grant this from an in-app dialog alone; the caller should fall back to
// sending the partner to Settings if this resolves to false. No-op (true) below API 29,
// where background location isn't a separate permission.
export async function requestBackgroundLocationPermission() {
  if (Platform.OS !== 'android' || Platform.Version < 29) return true;
  try {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION, {
      title: 'Allow location all the time',
      message:
        'Choose "Allow all the time" on the next screen so the customer keeps seeing your location if you leave the app.',
      buttonPositive: 'Continue',
    });
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    return false;
  }
}

// Needed on Android 13+ for the live-tracking foreground service's notification to actually
// show. Not requesting it isn't fatal — tracking still runs, the partner just won't see the
// "Sharing your live location" notice — so callers can ignore the result.
export async function requestNotificationPermission() {
  if (Platform.OS !== 'android' || Platform.Version < 33) return true;
  try {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    return false;
  }
}

// Asks for every location-related permission the delivery partner will eventually need,
// right at login/sign-up — same pattern as Swiggy/Zomato's partner apps, which front-load
// the "allow location" and "allow all the time" prompts during onboarding instead of
// surprising the partner with them mid-delivery. Best-effort: a partner who says no here
// still gets asked again when they actually start a delivery (see DeliveryOrderDetailScreen).
export async function requestPartnerLocationPermissions() {
  const granted = await requestLocationPermission();
  if (granted) {
    await requestBackgroundLocationPermission();
    await requestNotificationPermission();
  }
  return granted;
}

export function watchPosition(onUpdate, onError) {
  return Geolocation.watchPosition(
    (pos) => onUpdate({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    onError,
    { enableHighAccuracy: true, distanceFilter: 15, interval: 8000, fastestInterval: 5000 }
  );
}

export function clearWatch(watchId) {
  if (watchId != null) Geolocation.clearWatch(watchId);
}

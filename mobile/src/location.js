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

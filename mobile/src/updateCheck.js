import {Alert, AppState, Linking} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from './api/client';

// Bump this on every release (and keep it in step with versionCode in
// android/app/build.gradle); the backend advertises the latest build so the app can
// prompt users to update automatically on launch. All four apps share one version
// number — they are built from the same commit.
export const APP_VERSION_CODE = 45;
// Every install polls this endpoint, so the interval is a real traffic decision, not a
// detail: at 60s each phone made ~43k requests a month, which alone blows past the free
// tunnel/hosting request allowance. Six hours plus the on-foreground check below still
// gets an update to users the same day.
const UPDATE_POLL_INTERVAL_MS = 6 * 60 * 60 * 1000;
const LAST_NOTIFIED_VERSION_KEY = '@munchbox:lastNotifiedVersion';

const APP_LABELS = {
  customer: 'Munchbox',
  partner: 'Munchbox Partner',
  shop: 'Munchbox Shop',
  admin: 'Munchbox Admin',
};

export async function checkForUpdate(appType = 'customer') {
  try {
    const {data} = await client.get('/app/version', {params: {type: appType}});
    const latest = data.app;
    if (!latest || !latest.apkUrl) {
      return;
    }

    const latestVersionCode = Number(latest.latestVersionCode || APP_VERSION_CODE);
    const currentVersionCode = Number(APP_VERSION_CODE);
    if (!Number.isFinite(latestVersionCode) || !Number.isFinite(currentVersionCode) || latestVersionCode <= currentVersionCode) {
      return;
    }

    const lastNotifiedVersion = Number((await AsyncStorage.getItem(LAST_NOTIFIED_VERSION_KEY)) || 0);
    if (lastNotifiedVersion >= latestVersionCode) {
      return;
    }

    await AsyncStorage.setItem(LAST_NOTIFIED_VERSION_KEY, String(latestVersionCode));

    const message =
      latest.updateMessage ||
      `A new version of ${APP_LABELS[appType] || 'Munchbox'} is available and will be applied automatically.`;

    if (latest.mandatory) {
      Alert.alert('Update required', message, [{text: 'Update now', onPress: () => Linking.openURL(latest.apkUrl)}], {
        cancelable: false,
      });
      Linking.openURL(latest.apkUrl);
      return;
    }

    Alert.alert(
      'Update available',
      message,
      [
        {text: 'Later', style: 'cancel'},
        {text: 'Update now', onPress: () => Linking.openURL(latest.apkUrl)},
      ],
      {cancelable: true},
    );
  } catch (err) {
    // silently ignore update-check failures
  }
}

export function watchForUpdates(appType = 'customer') {
  let intervalId = null;

  const runCheck = () => {
    checkForUpdate(appType);
  };

  runCheck();

  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      runCheck();
    }
  });

  intervalId = setInterval(runCheck, UPDATE_POLL_INTERVAL_MS);

  return () => {
    clearInterval(intervalId);
    subscription.remove();
  };
}

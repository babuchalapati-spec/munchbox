import {Alert, AppState, Linking} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from './api/client';

// Bump this on every release; the backend advertises the latest build so the
// app can prompt users to update automatically on launch.
export const APP_VERSION_CODE = 15;
const UPDATE_POLL_INTERVAL_MS = 60000;
const LAST_NOTIFIED_VERSION_KEY = '@munchbox:lastNotifiedVersion';

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

    const message = latest.updateMessage || 'A new version of Munchbox is available and will be applied automatically.';

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

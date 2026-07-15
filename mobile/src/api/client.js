import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// The address baked in at build time — used until/unless someone overrides it from
// the in-app Server Settings screen (see ServerSettingsScreen.js). That override lets
// the app point at a new server address (e.g. after the WiFi IP changes) without
// needing a new APK build — just open Server Settings and type the new address.
// If testing on the Android emulator instead, switch this to http://10.0.2.2:5001/api.
export const DEFAULT_API_URL = 'http://192.168.1.8:5001/api';

const STORAGE_KEY = 'server_url_override';

// Mutable "current" URL. Starts as the default; updated by loadServerUrlOverride() on
// app start and by setServerUrl() whenever the user changes it.
export let API_URL = DEFAULT_API_URL;

// Resolves an image reference to a displayable URI.
// - Absolute links (https://...) are used as-is, so shops can paste an online image URL.
// - Relative paths (/uploads/x.jpg) are served from the backend host.
export function imageUri(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
  return `${API_URL.replace('/api', '')}${url}`;
}

// 30s timeout: long enough for a slow phone/Wi-Fi to get a response, short enough that
// an unreachable server fails to the login screen instead of hanging forever.
const client = axios.create({ baseURL: API_URL, timeout: 30000 });

client.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('cake_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Call once at app startup (see App.js) to apply a previously-saved override before
// any screen makes its first request.
export async function loadServerUrlOverride() {
  const saved = await AsyncStorage.getItem(STORAGE_KEY);
  if (saved) {
    API_URL = saved;
    client.defaults.baseURL = saved;
  }
  return API_URL;
}

// Saves a new server address and applies it immediately — no app restart needed.
// Accepts either "192.168.1.8:5001" or a full "http://192.168.1.8:5001" and always
// normalises to end in "/api".
export async function setServerUrl(rawInput) {
  let value = rawInput.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(value)) value = `http://${value}`;
  if (!/\/api$/i.test(value)) value = `${value}/api`;
  await AsyncStorage.setItem(STORAGE_KEY, value);
  API_URL = value;
  client.defaults.baseURL = value;
  return value;
}

// Removes the override and goes back to the address built into this APK.
export async function resetServerUrl() {
  await AsyncStorage.removeItem(STORAGE_KEY);
  API_URL = DEFAULT_API_URL;
  client.defaults.baseURL = DEFAULT_API_URL;
  return API_URL;
}

export default client;

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Use the same public backend host that serves the APK and API endpoints.
// If testing on the Android emulator instead, switch this to http://10.0.2.2:5001/api.
export const API_URL = 'https://roots-mixed-advocacy-appreciate.trycloudflare.com/api';

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

export default client;

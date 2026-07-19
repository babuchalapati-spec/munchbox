import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// The address baked in at build time — the last-resort fallback if nothing else
// responds. If testing on the Android emulator instead, use http://10.0.2.2:5001/api.
export const DEFAULT_API_URL = 'http://192.168.1.8:5001/api';

// Addresses seen before (home, office, wherever) — every address ever set via Server
// Settings is remembered here, in addition to this hardcoded seed list. On each app
// launch we test all of them at once and use whichever responds, so switching between
// known WiFi networks (home <-> office) "just works" without manual reconfiguration —
// only a brand-new, never-used network needs a one-time manual Server Settings entry.
const SEED_HOSTS = [
  'http://192.168.1.7:5001/api',
  'http://192.168.1.8:5001/api',
  'http://192.168.1.9:5001/api',
  'http://10.23.21.199:5001/api',
];

const STORAGE_KEY = 'server_url_override';
const KNOWN_HOSTS_KEY = 'known_server_hosts';
const HEALTH_PROBE_TIMEOUT_MS = 2500;

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

async function getKnownHosts() {
  let saved = [];
  try {
    saved = JSON.parse((await AsyncStorage.getItem(KNOWN_HOSTS_KEY)) || '[]');
  } catch (err) {
    saved = [];
  }
  // De-duplicate while keeping the most-recently-used ones first (faster average detection).
  return [...new Set([...saved, ...SEED_HOSTS, DEFAULT_API_URL])];
}

async function rememberHost(url) {
  const hosts = await getKnownHosts();
  const next = [url, ...hosts.filter((h) => h !== url)].slice(0, 8);
  await AsyncStorage.setItem(KNOWN_HOSTS_KEY, JSON.stringify(next));
}

function probe(url) {
  return axios
    .get(`${url.replace(/\/api\/?$/, '')}/api/health`, { timeout: HEALTH_PROBE_TIMEOUT_MS })
    .then((res) => (res.data?.status === 'ok' ? url : null))
    .catch(() => null);
}

// Tries every known server address at once and returns the first one that actually
// answers — this is what makes "walk into the office, open the app" work without
// anyone touching Server Settings, as long as that network's address was used before.
async function autoDetectServerUrl() {
  const hosts = await getKnownHosts();
  const results = await Promise.all(hosts.map(probe));
  return results.find(Boolean) || null;
}

// Call once at app startup (see App.js) to pick the right server before any screen
// makes its first request. A manually-set address (Server Settings) always wins if
// still reachable; otherwise auto-detects among known networks; otherwise falls back
// to the manual address anyway (so errors are visible) or the built-in default.
export async function loadServerUrlOverride() {
  const saved = await AsyncStorage.getItem(STORAGE_KEY);
  if (saved && (await probe(saved))) {
    API_URL = saved;
    client.defaults.baseURL = saved;
    return API_URL;
  }

  const detected = await autoDetectServerUrl();
  if (detected) {
    API_URL = detected;
    client.defaults.baseURL = detected;
    return API_URL;
  }

  // Nothing responded — keep the manual override if there is one (so the error the
  // user sees points at the address they meant to use), else the built-in default.
  API_URL = saved || DEFAULT_API_URL;
  client.defaults.baseURL = API_URL;
  return API_URL;
}

// Saves a new server address and applies it immediately — no app restart needed.
// Accepts either "192.168.1.8:5001" or a full "http://192.168.1.8:5001" and always
// normalises to end in "/api". Also remembered for future auto-detection on this device.
export async function setServerUrl(rawInput) {
  let value = rawInput.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(value)) value = `http://${value}`;
  if (!/\/api$/i.test(value)) value = `${value}/api`;
  await AsyncStorage.setItem(STORAGE_KEY, value);
  await rememberHost(value);
  API_URL = value;
  client.defaults.baseURL = value;
  return value;
}

// Removes the manual override and re-runs auto-detection among known networks.
export async function resetServerUrl() {
  await AsyncStorage.removeItem(STORAGE_KEY);
  const detected = await autoDetectServerUrl();
  API_URL = detected || DEFAULT_API_URL;
  client.defaults.baseURL = API_URL;
  return API_URL;
}

export default client;

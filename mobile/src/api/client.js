import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// The always-on public backend. This is what makes an installed APK work on ANY network
// — mobile data, someone else's WiFi, another city — with nothing to configure. The LAN
// addresses below are only a fast path for phones sitting on the same WiFi as the dev
// machine; if none of them answer, the app falls back to here.
export const PUBLIC_API_URL = 'https://munchbox-backend.onrender.com/api';

// A tunnel to the laptop, for testing an unreleased build from a phone that isn't on the
// same WiFi. On the free ngrok plan this URL is regenerated every time the tunnel starts,
// so it is left empty here on purpose: start-munchbox.bat prints the current one, and it
// is entered once under Server Settings (the app remembers it from then on).
export const TUNNEL_API_URL = '';

// The address used before anything has been probed. Public, so a fresh install on an
// unknown network is never stuck.
export const DEFAULT_API_URL = PUBLIC_API_URL;

// Addresses seen before (home, office, wherever) — every address ever set via Server
// Settings is remembered here, in addition to this hardcoded seed list. On each app
// launch we test all of them at once and use whichever responds, so switching between
// known WiFi networks (home <-> office) "just works" without manual reconfiguration.
// LAN addresses come first because on the dev WiFi they're faster and don't burn the
// tunnel's data allowance; the public URL is last and is the one that always answers.
const SEED_HOSTS = [
  'http://192.168.1.7:5001/api',
  'http://192.168.1.8:5001/api',
  'http://192.168.1.9:5001/api',
  'http://10.23.21.199:5001/api',
  ...(TUNNEL_API_URL ? [TUNNEL_API_URL] : []),
  PUBLIC_API_URL,
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

// 60s timeout. Long, on purpose: the free hosting tier stops the server when it's idle
// and the first request after that has to wait for it to boot (up to ~50s). A 30s
// timeout turned that wake-up into a visible "server unreachable" error on the first
// open of the day. Still bounded, so a genuinely dead server fails instead of hanging.
const client = axios.create({ baseURL: API_URL, timeout: 60000 });

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

function probe(url, timeout = HEALTH_PROBE_TIMEOUT_MS) {
  return axios
    .get(`${url.replace(/\/api\/?$/, '')}/api/health`, { timeout })
    .then((res) => (res.data?.status === 'ok' ? url : null))
    .catch(() => null);
}

// Tries every known server address at once and returns the first one that actually
// answers — this is what makes "walk into the office, open the app" work without
// anyone touching Server Settings, as long as that network's address was used before.
//
// The public URL is deliberately not probed: free hosting sleeps when idle and can take
// most of a minute to wake, far longer than it's worth blocking the splash screen for.
// It's the answer whenever nothing on the local network responds, so probing it would
// only slow down the case where the answer is already known.
async function autoDetectServerUrl() {
  const hosts = (await getKnownHosts()).filter((h) => h !== PUBLIC_API_URL);
  const results = await Promise.all(hosts.map((h) => probe(h)));
  return results.find(Boolean) || PUBLIC_API_URL;
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

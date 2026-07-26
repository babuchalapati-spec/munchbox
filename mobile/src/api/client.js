import AsyncStorage from '@react-native-async-storage/async-storage';

export const PUBLIC_API_URL = 'https://nirman-4vyy.onrender.com/api';
export const TUNNEL_API_URL = '';
export const DEFAULT_API_URL = PUBLIC_API_URL;

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

export let API_URL = DEFAULT_API_URL;

export function imageUri(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
  return `${API_URL.replace('/api', '')}${url}`;
}

// Ultra-minimal Fetch client that won't crash at module load time
const client = {
  defaults: { baseURL: API_URL, timeout: 60000 },
  interceptors: {
    request: {
      handlers: [],
      use(handler) {
        this.handlers.push(handler);
      }
    }
  },

  async request(method, url, data, config = {}) {
    try {
      const finalConfig = { method, ...config };
      let fullUrl = url.startsWith('http') ? url : `${this.defaults.baseURL}${url}`;

      // Query params
      if (finalConfig.params && Object.keys(finalConfig.params).length > 0) {
        const qs = Object.keys(finalConfig.params)
          .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(finalConfig.params[k])}`)
          .join('&');
        fullUrl = `${fullUrl}?${qs}`;
      }

      const headers = finalConfig.headers || { 'Content-Type': 'application/json' };

      // Get token for auth
      const token = await AsyncStorage.getItem('cake_token');
      if (token) headers.Authorization = `Bearer ${token}`;

      const fetchOptions = { method, headers };

      // Body
      if (data && method !== 'GET') {
        if (data instanceof FormData) {
          fetchOptions.body = data;
          delete fetchOptions.headers['Content-Type'];
        } else {
          fetchOptions.body = typeof data === 'string' ? data : JSON.stringify(data);
        }
      }

      const response = await fetch(fullUrl, fetchOptions);
      const text = await response.text();
      const responseData = text ? JSON.parse(text) : {};

      return {
        data: responseData,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        config: finalConfig
      };
    } catch (err) {
      throw {
        response: { data: { message: err.message } },
        message: err.message,
        config
      };
    }
  },

  get(url, config) {
    return this.request('GET', url, null, config);
  },
  post(url, data, config) {
    return this.request('POST', url, data, config);
  },
  put(url, data, config) {
    return this.request('PUT', url, data, config);
  },
  patch(url, data, config) {
    return this.request('PATCH', url, data, config);
  },
  delete(url, config) {
    return this.request('DELETE', url, null, config);
  }
};

async function getKnownHosts() {
  try {
    const saved = JSON.parse((await AsyncStorage.getItem(KNOWN_HOSTS_KEY)) || '[]');
    return [...new Set([...saved, ...SEED_HOSTS, DEFAULT_API_URL])];
  } catch {
    return SEED_HOSTS;
  }
}

async function rememberHost(url) {
  try {
    const hosts = await getKnownHosts();
    const next = [url, ...hosts.filter((h) => h !== url)].slice(0, 8);
    await AsyncStorage.setItem(KNOWN_HOSTS_KEY, JSON.stringify(next));
  } catch (err) {
    console.log('rememberHost error (safe to ignore):', err.message);
  }
}

function probe(url, timeout = HEALTH_PROBE_TIMEOUT_MS) {
  return Promise.race([
    fetch(`${url.replace(/\/api\/?$/, '')}/api/health`)
      .then((res) => (res.ok ? url : null))
      .catch(() => null),
    new Promise((resolve) => setTimeout(() => resolve(null), timeout))
  ]);
}

async function autoDetectServerUrl() {
  try {
    const hosts = (await getKnownHosts()).filter((h) => h !== PUBLIC_API_URL);
    const results = await Promise.all(hosts.map((h) => probe(h)));
    return results.find(Boolean) || PUBLIC_API_URL;
  } catch {
    return PUBLIC_API_URL;
  }
}

export async function loadServerUrlOverride() {
  try {
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

    API_URL = saved || DEFAULT_API_URL;
    client.defaults.baseURL = API_URL;
    return API_URL;
  } catch (err) {
    console.log('loadServerUrlOverride error (safe to ignore):', err.message);
    API_URL = DEFAULT_API_URL;
    client.defaults.baseURL = API_URL;
    return API_URL;
  }
}

export async function setServerUrl(rawInput) {
  try {
    let value = rawInput.trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(value)) value = `http://${value}`;
    if (!/\/api$/i.test(value)) value = `${value}/api`;
    await AsyncStorage.setItem(STORAGE_KEY, value);
    await rememberHost(value);
    API_URL = value;
    client.defaults.baseURL = value;
    return value;
  } catch (err) {
    console.log('setServerUrl error:', err.message);
    throw err;
  }
}

export async function resetServerUrl() {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    const detected = await autoDetectServerUrl();
    API_URL = detected || DEFAULT_API_URL;
    client.defaults.baseURL = API_URL;
    return API_URL;
  } catch (err) {
    console.log('resetServerUrl error:', err.message);
    return DEFAULT_API_URL;
  }
}

export default client;

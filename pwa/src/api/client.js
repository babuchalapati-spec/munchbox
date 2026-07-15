import axios from 'axios';

// Relative base URL — in production this app is served BY the same backend it talks
// to, so '/api' always resolves correctly with zero configuration, on any device,
// regardless of what address/domain the site is actually reached at. In dev, Vite's
// proxy (see vite.config.js) forwards this to the local backend.
const client = axios.create({ baseURL: '/api', timeout: 30000 });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('mb_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function imageUri(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
  return url; // relative /uploads/x.jpg resolves against the current origin automatically
}

export default client;

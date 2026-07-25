import axios from 'axios';

// A hardcoded "localhost" only works when the admin dashboard is opened on the exact
// machine running the backend. Opened from any other device (a phone on the same WiFi,
// say) "localhost" would resolve to THAT device instead — so unless an explicit
// VITE_API_URL override is set, derive the backend address from whatever host the
// admin page itself was loaded from.
const explicitApiUrl = import.meta.env.VITE_API_URL;
// In production the backend serves this dashboard itself (at /admin), so the API lives
// on the very same origin — including through the ngrok tunnel and on Render, where
// there is no port 5001 to talk to and the scheme is https. Only the Vite dev server
// on 5173 needs the backend addressed separately.
const isViteDevServer = window.location.port === '5173';
export const API_BASE_URL =
  explicitApiUrl && !explicitApiUrl.includes('localhost')
    ? explicitApiUrl
    : isViteDevServer
      ? `${window.location.protocol}//${window.location.hostname}:5001/api`
      : `${window.location.origin}/api`;
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

const client = axios.create({
  baseURL: API_BASE_URL,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('cake_admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// When a shop owner's subscription has lapsed the API returns { subscriptionExpired: true }.
// Broadcast it so the app can show a lock screen.
client.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.data?.subscriptionExpired) {
      window.dispatchEvent(new CustomEvent('subscription-expired'));
    }
    return Promise.reject(error);
  }
);

export default client;

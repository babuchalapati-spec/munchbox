import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001/api',
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

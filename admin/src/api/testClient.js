import axios from 'axios';

// A separate axios instance for the standalone customer/delivery test pages. It does
// NOT carry the admin-token interceptor that ../api/client.js has, so testing a
// customer or delivery session here never collides with an admin session open in the
// same browser — each test page holds its own token in local component state and
// attaches it per-request instead.
const testClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001/api',
});

export default testClient;

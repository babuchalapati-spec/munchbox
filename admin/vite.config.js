import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // The built dashboard is served by the backend under /admin (see server.js), so asset
  // URLs have to be prefixed to match. The dev server below still runs at the root.
  base: '/admin/',
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // Dev only: the dashboard calls relative /api paths in production because the
    // backend serves it; this keeps that same shape while running on 5173.
    proxy: {
      '/api': 'http://localhost:5001',
      '/uploads': 'http://localhost:5001',
      '/downloads': 'http://localhost:5001',
    },
  },
});

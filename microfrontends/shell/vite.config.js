import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';

// The host. Declares every remote it knows how to load — adding a new micro-frontend
// (shops-mf, finance-mf, ...) means adding one more line to `remotes` here and one new
// route in src/App.jsx, nothing else in this app changes. Each remote's URL is
// independently deployable and independently versioned.
export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'shell',
      remotes: {
        orders_mf: process.env.VITE_ORDERS_MF_URL || 'http://localhost:5101/assets/remoteEntry.js',
        shops_mf: process.env.VITE_SHOPS_MF_URL || 'http://localhost:5102/assets/remoteEntry.js',
        delivery_mf: process.env.VITE_DELIVERY_MF_URL || 'http://localhost:5103/assets/remoteEntry.js',
        finance_mf: process.env.VITE_FINANCE_MF_URL || 'http://localhost:5104/assets/remoteEntry.js',
        catering_mf: process.env.VITE_CATERING_MF_URL || 'http://localhost:5105/assets/remoteEntry.js',
        settings_mf: process.env.VITE_SETTINGS_MF_URL || 'http://localhost:5106/assets/remoteEntry.js',
      },
      shared: ['react', 'react-dom'],
    }),
  ],
  build: {
    target: 'esnext',
    modulePreload: false,
    cssCodeSplit: false,
  },
});

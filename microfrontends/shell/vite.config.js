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

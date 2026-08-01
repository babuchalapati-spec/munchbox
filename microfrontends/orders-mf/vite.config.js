import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';

// Exposes ./App as "orders_mf/OrdersApp" — the shell (../shell/vite.config.js) loads
// this at runtime via its remoteEntry.js, so shipping a change here never requires
// rebuilding or redeploying the shell or any other micro-frontend. See
// ARCHITECTURE.md §7 at the repo root for how this fits into the full picture.
export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'orders_mf',
      filename: 'remoteEntry.js',
      exposes: {
        './OrdersApp': './src/App.jsx',
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

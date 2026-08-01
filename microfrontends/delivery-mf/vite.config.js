import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';

// Exposes ./App as "delivery_mf/DeliveryApp" — the shell (../shell/vite.config.js) loads this
// at runtime, so shipping a change here never requires rebuilding the shell or any
// other micro-frontend. See ARCHITECTURE.md §7 at the repo root.
export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'delivery_mf',
      filename: 'remoteEntry.js',
      exposes: {
        './DeliveryApp': './src/App.jsx',
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

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';

// Exposes ./App as "shops_mf/ShopsApp" — the shell (../shell/vite.config.js) loads this
// at runtime, so shipping a change here never requires rebuilding the shell or any
// other micro-frontend. See ARCHITECTURE.md §7 at the repo root.
export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'shops_mf',
      filename: 'remoteEntry.js',
      exposes: {
        './ShopsApp': './src/App.jsx',
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

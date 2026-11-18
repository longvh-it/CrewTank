import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Relative path on purpose: Vite bundles this config, but a package import would be loaded by plain Node,
// which cannot read the shared .ts files before Node 22.18 (the Docker image uses Node 20).
import { CLIENT_DEV_PORT, SERVER_PORT } from '../shared/constants';

export default defineConfig({
  plugins: [react()],
  server: {
    port: CLIENT_DEV_PORT,
    proxy: {
      '/socket.io': { target: `http://localhost:${process.env.PORT || SERVER_PORT}`, ws: true },
    },
  },
});

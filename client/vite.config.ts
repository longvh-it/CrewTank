import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { CLIENT_DEV_PORT, SERVER_PORT } from '@crew-tanks/shared/constants';

export default defineConfig({
  plugins: [react()],
  server: {
    port: CLIENT_DEV_PORT,
    proxy: {
      '/socket.io': { target: `http://localhost:${process.env.PORT || SERVER_PORT}`, ws: true },
    },
  },
});

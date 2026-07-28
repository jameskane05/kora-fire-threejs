import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vite';

// WebXR needs a secure context, and a headset reaching this over the LAN is not on localhost,
// so `npm run dev` serves HTTPS with a self-signed certificate. Safari will want that accepted
// once per session before it will start an immersive session.
export default defineConfig({
  plugins: [basicSsl()],
  server: { port: 5273, host: true, open: false },
  build: { target: 'esnext' },
});

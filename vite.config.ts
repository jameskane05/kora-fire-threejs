import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vite';

// WebXR needs a secure context, and a headset reaching this over the LAN is not on localhost,
// so `npm run dev` serves HTTPS with a self-signed certificate. Safari will want that accepted
// once per session before it will start an immersive session.
// GitHub Pages serves a project repository from a subdirectory, so a production build has to know
// its prefix. The dev server stays at the root, where the headset expects it.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/kora-fire-threejs/' : '/',
  plugins: [basicSsl()],
  server: { port: 5273, host: true, open: false },
  // three is pinned to a git commit and rebuilt in postinstall. Keep it out of the
  // dep optimizer so Vite does not serve a stale prebundle after that rebuild.
  optimizeDeps: {
    exclude: ['three'],
  },
  build: {
    target: 'esnext',
    // cube.html is the bare WebGPU/WebXR baseline; without naming it here a build drops it.
    rollupOptions: {
      input: {
        main: 'index.html',
        fire: 'fire.html',
        cube: 'cube.html',
        materials: 'materials.html',
      },
    },
  },
}));

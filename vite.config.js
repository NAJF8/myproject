import { defineConfig } from 'vite';

export default defineConfig({
  base: '/myproject/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2019',
  },
});

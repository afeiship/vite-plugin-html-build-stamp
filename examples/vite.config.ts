import { defineConfig } from 'vite';
import plugin from '../src';

export default defineConfig({
  plugins: [plugin()],
  build: { outDir: 'dist-example' },
});

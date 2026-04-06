import { defineConfig } from 'vitest/config';
import { transformWithOxc } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Custom plugin to ensure JSX is transformed for SSR/test environments.
 *
 * Vite 8's ssrTransformScript calls rolldown's parseAstAsync with
 * lang:"js" by default, which cannot parse JSX. This plugin explicitly
 * transforms .tsx/.jsx files via OXC before the SSR transform sees them.
 */
function jsxFixPlugin() {
  return {
    name: 'vitest:jsx-fix',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (/\.[jt]sx($|\?)/.test(id)) {
        return transformWithOxc(code, id, {
          jsx: { runtime: 'automatic' },
          sourcemap: true,
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [jsxFixPlugin(), react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

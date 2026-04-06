import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Custom plugin to ensure JSX is transformed for SSR/test environments.
 *
 * Vite 8's ssrTransformScript calls rolldown's parseAstAsync with
 * lang:"js" by default, which cannot parse JSX. The built-in OXC
 * transform plugin should handle this, but there is a timing issue
 * where the SSR transform receives untransformed JSX in some cases.
 *
 * This plugin explicitly transforms .tsx/.jsx files via OXC before
 * the SSR transform sees them.
 */
function jsxFixPlugin() {
  return {
    name: 'vitest:jsx-fix',
    enforce: 'pre' as const,
    async transform(code: string, id: string) {
      if (/\.[jt]sx($|\?)/.test(id) && code.includes('<')) {
        const { transformWithOxc } = await import('vite');
        if (typeof transformWithOxc === 'function') {
          const result = await transformWithOxc(code, id, {
            jsx: { runtime: 'automatic' },
            sourcemap: true,
          });
          return { code: result.code, map: result.map };
        }
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

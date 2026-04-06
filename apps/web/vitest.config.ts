import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Custom plugin to ensure JSX is transformed for SSR/test environments.
 *
 * Vite 8 uses rolldown whose parseAstAsync defaults to lang:"js", which
 * cannot parse JSX. The built-in vite:oxc plugin should handle this but
 * does not run in vitest's SSR transform pipeline. This plugin explicitly
 * transforms .tsx/.jsx files via OXC so the SSR transform receives valid JS.
 */
function jsxFixPlugin() {
  return {
    name: 'vitest:jsx-fix',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (/\.[jt]sx($|\?)/.test(id)) {
        return import('vite').then(({ transformWithOxc }) =>
          transformWithOxc(code, id, {
            jsx: { runtime: 'automatic' },
            sourcemap: true,
          })
        );
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

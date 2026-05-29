import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

export default [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'public/**',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
      'next-env.d.ts',
    ],
  },
  ...nextCoreWebVitals,
  {
    // eslint-plugin-react-hooks@7 ships React-Compiler-aware rules
    // (set-state-in-effect, immutability, static-components, purity).
    // The codebase isn't authored against the Compiler — these rules
    // flag legitimate effect-driven patterns. Disable until/unless we
    // adopt the Compiler. exhaustive-deps and rules-of-hooks stay on.
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/purity': 'off',
      // Cosmetic-only: flags literal ' and " inside JSX text (e.g.
      // "Today's forecast"), which render correctly. Escaping every
      // apostrophe across the marketing/SEO prose hurts readability for
      // no runtime benefit, so we disable it rather than litter the copy
      // with &apos;/&quot;. Genuine link/perf rules stay on.
      'react/no-unescaped-entities': 'off',
    },
  },
];

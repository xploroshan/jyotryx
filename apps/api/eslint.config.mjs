import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

/**
 * Flat ESLint config for the NestJS API.
 *
 * The project shipped without any ESLint config while ESLint 9 (which
 * requires flat config) was installed, so `npm run lint` errored out before
 * linting anything — which is why the "API — Lint & Test" CI check failed on
 * every PR. This restores a working lint.
 *
 * Ruleset is intentionally pragmatic: this is the first time the codebase is
 * linted, so pervasive, deliberate existing patterns (e.g. `any` on Prisma
 * transaction clients / webhook payloads, dynamic `require`) are allowed, and
 * non-critical findings are warnings so they don't fail CI. Genuine
 * correctness rules stay at error level. Tighten over time.
 */
export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'prisma/migrations/**',
      'eslint.config.mjs',
      '**/*.js',
      '**/*.mjs',
    ],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { sourceType: 'module', ecmaVersion: 2022 },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,

      // TypeScript handles undefined identifiers; the JS rule double-flags.
      'no-undef': 'off',
      // Defer unused-var enforcement to the TS-aware rule, as a warning, with
      // the conventional underscore opt-out.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      // `any` is used deliberately across the codebase (Prisma tx clients,
      // third-party webhook payloads). Allowing it keeps this first lint pass
      // actionable rather than a wall of noise.
      '@typescript-eslint/no-explicit-any': 'off',
      // Dynamic `require('razorpay')` (optional dependency, loaded only when
      // configured) is intentional.
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
  {
    // Tests and one-off scripts: keep them linted, but downgrade a few rules
    // that only trip on pre-existing, low-risk patterns here (a self-assign in
    // a backfill script, a duplicate symbol + `this`-alias in test mocks) to
    // warnings — surfaced as follow-ups rather than blocking CI. Production
    // `src/**` stays strict at error level.
    files: ['test/**', 'scripts/**'],
    rules: {
      'no-self-assign': 'warn',
      'no-redeclare': 'warn',
      '@typescript-eslint/no-this-alias': 'warn',
    },
  },
];

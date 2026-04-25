import type { Config } from 'jest';

/**
 * Integration-test config.
 *
 * Unlike the default unit config, this one spins up *real* redis,
 * postgres, and pgbouncer daemons (via test/integration/global-setup.ts)
 * so we can validate the Phase 0 scalability wiring end-to-end.
 *
 * Run with: `npm run test:int`
 */
const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: 'test/integration/.*\\.int-spec\\.ts$',
  transform: {
    // Match the unit suite's tsconfig wiring: `tsconfig.spec.json`
    // extends the main tsconfig and adds `"types": ["jest", "node"]`,
    // which is what ts-jest needs so `describe`/`it`/`expect` resolve
    // when compiling the integration specs. Without an explicit
    // `tsconfig`, ts-jest falls back to `tsconfig.json` and every
    // spec fails to load with TS2593.
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.spec.json' }],
  },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  // Daemons + Prisma migrate typically boot in a few seconds but we leave
  // a wide margin so CI cold starts don't thrash.
  testTimeout: 60_000,
  // Sequential — the three daemons are shared and tests make assertions
  // about global state (cache keys, pool counts) that don't survive
  // parallel runs.
  maxWorkers: 1,
  globalSetup: '<rootDir>/test/integration/global-setup.ts',
  globalTeardown: '<rootDir>/test/integration/global-teardown.ts',
  // The spawned daemons' child-process handles keep the event loop alive;
  // teardown terminates them but Jest warns anyway without forceExit.
  forceExit: true,
};

export default config;

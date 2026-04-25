import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    // Transpile-only so jest runs at runtime without needing the
    // generated @prisma/client types present (that client is only
    // materialised at prod deploy via `prisma generate`, and every
    // unit test here mocks Prisma via `mockPrismaService`). Strict
    // typechecking of src + tests stays as a separate `tsc --noEmit`
    // step wired through `tsconfig.spec.json`.
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.spec.json' }],
  },
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    // Redirect `@prisma/client` to a runtime stub so specs that import
    // Prisma-typed services run without needing a generated client on
    // disk. The real client is only materialised at deploy time via
    // `prisma generate`; tests mock Prisma through DI so the stub's
    // no-op methods are never invoked.
    '^@prisma/client$': '<rootDir>/test/helpers/prisma-client-stub.ts',
  },
};

export default config;

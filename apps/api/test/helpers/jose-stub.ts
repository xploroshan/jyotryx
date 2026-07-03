/**
 * Runtime stub for the ESM-only `jose` package (pulled in by firebase-admin
 * 14 → jwks-rsa), which Jest's CJS runtime cannot parse. Mirrors the
 * `@prisma/client` stub approach in jest.config.ts: unit tests never exercise
 * real JWKS verification (firebase-admin is mocked / guarded behind
 * getApps().length), so every member throws if something does reach it.
 */
const stub = new Proxy({} as Record<string, unknown>, {
  get: (_target, prop) => {
    if (prop === '__esModule') return false;
    return () => {
      throw new Error(`jose stub: ${String(prop)} is not available in unit tests`);
    };
  },
});

export = stub;

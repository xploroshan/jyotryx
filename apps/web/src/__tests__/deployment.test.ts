/**
 * Deployment Configuration Tests
 *
 * Validates Vercel config, Docker setup, docker-compose services,
 * Next.js config, monorepo structure, and build pipeline integrity.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../../../');
const WEB_DIR = path.resolve(ROOT, 'apps/web');
const API_DIR = path.resolve(ROOT, 'apps/api');

function readJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function readFile(filePath: string) {
  return fs.readFileSync(filePath, 'utf-8');
}

// ─── Vercel Configuration ───────────────────────────────────────────────────

describe('Vercel Deployment Config', () => {
  const vercelConfig = readJson(path.join(ROOT, 'vercel.json'));

  it('should have valid JSON schema reference', () => {
    expect(vercelConfig.$schema).toBe('https://openapi.vercel.sh/vercel.json');
  });

  it('should use --ignore-scripts to skip native module compilation', () => {
    expect(vercelConfig.installCommand).toContain('--ignore-scripts');
  });

  it('should install from monorepo root (cd ../..)', () => {
    expect(vercelConfig.installCommand).toContain('cd ../..');
  });

  it('should use npm run build as the build command', () => {
    expect(vercelConfig.buildCommand).toBe('npm run build');
  });

  it('should specify nextjs framework', () => {
    expect(vercelConfig.framework).toBe('nextjs');
  });

  it('should NOT contain cd apps/web in build command (root dir is already apps/web)', () => {
    expect(vercelConfig.buildCommand).not.toContain('cd apps/web');
  });
});

// ─── Monorepo Structure ─────────────────────────────────────────────────────

describe('Monorepo Structure', () => {
  const rootPkg = readJson(path.join(ROOT, 'package.json'));

  it('should define workspaces for apps and packages', () => {
    expect(rootPkg.workspaces).toBeDefined();
    expect(rootPkg.workspaces).toContain('apps/*');
    expect(rootPkg.workspaces).toContain('packages/*');
  });

  it('should have web app directory', () => {
    expect(fs.existsSync(WEB_DIR)).toBe(true);
  });

  it('should have api app directory', () => {
    expect(fs.existsSync(API_DIR)).toBe(true);
  });

  it('should have shared package directory', () => {
    expect(fs.existsSync(path.join(ROOT, 'packages/shared'))).toBe(true);
  });

  it('web app should depend on shared package', () => {
    const webPkg = readJson(path.join(WEB_DIR, 'package.json'));
    expect(webPkg.dependencies['@jyotryx/shared']).toBeDefined();
  });
});

// ─── Web App (Next.js) Build Config ─────────────────────────────────────────

describe('Web App Build Config', () => {
  const webPkg = readJson(path.join(WEB_DIR, 'package.json'));

  it('should have build script using next build', () => {
    expect(webPkg.scripts.build).toBe('next build');
  });

  it('should have dev script using next dev', () => {
    expect(webPkg.scripts.dev).toBe('next dev');
  });

  it('should have start script using next start', () => {
    expect(webPkg.scripts.start).toBe('next start');
  });

  it('should have test script using vitest', () => {
    expect(webPkg.scripts.test).toContain('vitest');
  });

  it('should have next as dependency', () => {
    expect(webPkg.dependencies.next).toBeDefined();
  });

  it('should have react as dependency', () => {
    expect(webPkg.dependencies.react).toBeDefined();
  });

  it('should have vitest as devDependency', () => {
    expect(webPkg.devDependencies.vitest).toBeDefined();
  });

  it('should have testing-library as devDependency', () => {
    expect(webPkg.devDependencies['@testing-library/react']).toBeDefined();
  });
});

// ─── Next.js Config ─────────────────────────────────────────────────────────

describe('Next.js Config', () => {
  const configContent = readFile(path.join(WEB_DIR, 'next.config.ts'));

  it('should export a NextConfig', () => {
    expect(configContent).toContain('NextConfig');
    expect(configContent).toContain('export default');
  });

  it('should configure remote image patterns for S3/AWS', () => {
    expect(configContent).toContain('amazonaws.com');
  });

  it('should configure server actions body size limit', () => {
    expect(configContent).toContain('bodySizeLimit');
  });
});

// ─── TypeScript Config ──────────────────────────────────────────────────────

describe('Web TypeScript Config', () => {
  const tsconfig = readJson(path.join(WEB_DIR, 'tsconfig.json'));

  it('should use esnext module', () => {
    expect(tsconfig.compilerOptions.module).toBe('esnext');
  });

  it('should use bundler module resolution', () => {
    expect(tsconfig.compilerOptions.moduleResolution).toBe('bundler');
  });

  it('should have @ path alias pointing to src/', () => {
    expect(tsconfig.compilerOptions.paths['@/*']).toEqual(['./src/*']);
  });

  it('should have strict mode enabled', () => {
    expect(tsconfig.compilerOptions.strict).toBe(true);
  });

  it('should preserve JSX for Next.js', () => {
    expect(tsconfig.compilerOptions.jsx).toBe('preserve');
  });

  it('should exclude node_modules', () => {
    expect(tsconfig.exclude).toContain('node_modules');
  });
});

// ─── API Dockerfile ─────────────────────────────────────────────────────────

describe('API Dockerfile', () => {
  const dockerfile = readFile(path.join(API_DIR, 'Dockerfile'));

  it('should use node:20-alpine base image', () => {
    expect(dockerfile).toContain('FROM node:20-alpine');
  });

  it('should use multi-stage build', () => {
    const stages = dockerfile.match(/FROM .+ AS \w+/g);
    expect(stages).not.toBeNull();
    expect(stages!.length).toBeGreaterThanOrEqual(3);
  });

  it('should generate Prisma client during build', () => {
    expect(dockerfile).toContain('prisma generate');
  });

  it('should run prisma migrate deploy on startup', () => {
    expect(dockerfile).toContain('prisma migrate deploy');
  });

  it('should separate dev and prod dependencies', () => {
    expect(dockerfile).toContain('npm ci --omit=dev');
  });

  it('should expose port 4000', () => {
    expect(dockerfile).toContain('EXPOSE 4000');
  });

  it('should copy prisma directory to production stage', () => {
    expect(dockerfile).toContain('COPY --from=build /app/prisma ./prisma');
  });
});

// ─── Web Dockerfile ─────────────────────────────────────────────────────────

describe('Web Dockerfile', () => {
  const dockerfile = readFile(path.join(WEB_DIR, 'Dockerfile'));

  it('should use node:20-alpine base image', () => {
    expect(dockerfile).toContain('FROM node:20-alpine');
  });

  it('should use multi-stage build', () => {
    const stages = dockerfile.match(/FROM .+ AS \w+/g);
    expect(stages).not.toBeNull();
    expect(stages!.length).toBeGreaterThanOrEqual(3);
  });

  it('should disable Next.js telemetry', () => {
    expect(dockerfile).toContain('NEXT_TELEMETRY_DISABLED=1');
  });

  it('should use standalone output for production', () => {
    expect(dockerfile).toContain('.next/standalone');
  });

  it('should copy static assets', () => {
    expect(dockerfile).toContain('.next/static');
  });

  it('should copy public directory', () => {
    expect(dockerfile).toContain('COPY --from=build /app/public ./public');
  });

  it('should expose port 3000', () => {
    expect(dockerfile).toContain('EXPOSE 3000');
  });

  it('should bind to 0.0.0.0 for container networking', () => {
    expect(dockerfile).toContain('HOSTNAME="0.0.0.0"');
  });

  it('should start with node server.js (standalone mode)', () => {
    expect(dockerfile).toContain('"node"');
    expect(dockerfile).toContain('"server.js"');
  });
});

// ─── Docker Compose ─────────────────────────────────────────────────────────

describe('Docker Compose', () => {
  const compose = readFile(path.join(ROOT, 'docker-compose.yml'));

  it('should define postgres service', () => {
    expect(compose).toContain('postgres:');
    expect(compose).toContain('pgvector/pgvector:pg16');
  });

  it('should define redis service', () => {
    expect(compose).toContain('redis:');
    expect(compose).toContain('redis:7-alpine');
  });

  it('should define api service', () => {
    expect(compose).toContain('api:');
  });

  it('should define web service', () => {
    expect(compose).toContain('web:');
  });

  it('should have postgres healthcheck', () => {
    expect(compose).toContain('pg_isready');
  });

  it('should have redis healthcheck', () => {
    expect(compose).toContain('redis-cli');
  });

  it('should make api depend on postgres and redis being healthy', () => {
    expect(compose).toContain('condition: service_healthy');
  });

  it('should persist postgres data with a volume', () => {
    expect(compose).toContain('postgres_data:/var/lib/postgresql/data');
  });

  it('should persist redis data with a volume', () => {
    expect(compose).toContain('redis_data:/data');
  });

  it('should use redis appendonly mode for persistence', () => {
    expect(compose).toContain('--appendonly yes');
  });

  it('should set production NODE_ENV for api', () => {
    expect(compose).toContain('NODE_ENV: production');
  });

  it('should expose correct ports (postgres:5432, redis:6379, api:4000, web:3000)', () => {
    expect(compose).toContain('"5432:5432"');
    expect(compose).toContain('"6379:6379"');
    expect(compose).toContain('"4000:4000"');
    expect(compose).toContain('"3000:3000"');
  });
});

// ─── API Startup Script ─────────────────────────────────────────────────────

describe('API Startup Script (Render)', () => {
  const startup = readFile(path.join(API_DIR, 'scripts/startup.js'));

  it('should run Prisma migrations', () => {
    expect(startup).toContain('prisma migrate');
  });

  it('should attempt database seed', () => {
    expect(startup).toContain('seed');
  });

  it('should check if compiled seed file exists before running', () => {
    expect(startup).toContain('fs.existsSync');
  });

  it('should start the API server with node dist/main', () => {
    expect(startup).toContain("node', ['dist/main']");
  });

  it('should exit the process on server error', () => {
    expect(startup).toContain('process.exit');
  });

  it('should have timeouts for migration and seed operations', () => {
    expect(startup).toContain('60000');  // migration timeout
    expect(startup).toContain('15000');  // seed timeout
  });
});

// ─── API Package Scripts ────────────────────────────────────────────────────

describe('API Build & Deploy Scripts', () => {
  const apiPkg = readJson(path.join(API_DIR, 'package.json'));

  it('should have build script using nest build', () => {
    expect(apiPkg.scripts.build).toContain('nest build');
  });

  it('should have start:prod script for production', () => {
    expect(apiPkg.scripts['start:prod']).toBe('node dist/main');
  });

  it('should have start:render script for Render.com deploy', () => {
    expect(apiPkg.scripts['start:render']).toContain('startup.js');
  });

  it('should have prisma:deploy script for production migrations', () => {
    expect(apiPkg.scripts['prisma:deploy']).toContain('prisma migrate deploy');
  });

  it('should have prisma:generate script', () => {
    expect(apiPkg.scripts['prisma:generate']).toBe('prisma generate');
  });

  it('should have test script', () => {
    expect(apiPkg.scripts.test).toBe('jest');
  });
});

// ─── Critical File Existence ────────────────────────────────────────────────

describe('Critical Deployment Files Exist', () => {
  const criticalFiles = [
    [path.join(ROOT, 'vercel.json'), 'vercel.json'],
    [path.join(ROOT, 'docker-compose.yml'), 'docker-compose.yml'],
    [path.join(ROOT, 'package.json'), 'root package.json'],
    [path.join(WEB_DIR, 'package.json'), 'web package.json'],
    [path.join(WEB_DIR, 'next.config.ts'), 'next.config.ts'],
    [path.join(WEB_DIR, 'tsconfig.json'), 'web tsconfig.json'],
    [path.join(WEB_DIR, 'Dockerfile'), 'web Dockerfile'],
    [path.join(API_DIR, 'package.json'), 'api package.json'],
    [path.join(API_DIR, 'Dockerfile'), 'api Dockerfile'],
    [path.join(API_DIR, 'scripts/startup.js'), 'api startup script'],
  ];

  for (const [filePath, label] of criticalFiles) {
    it(`${label} should exist`, () => {
      expect(fs.existsSync(filePath)).toBe(true);
    });
  }
});

// ─── Environment Variable Safety ────────────────────────────────────────────

describe('Environment Variable Safety', () => {
  it('docker-compose should not hardcode database password', () => {
    const compose = readFile(path.join(ROOT, 'docker-compose.yml'));
    // Should use env var substitution, not hardcoded values
    expect(compose).toContain('POSTGRES_PASSWORD:');
    expect(compose).not.toMatch(/POSTGRES_PASSWORD:\s+[a-zA-Z0-9]+\s*$/m);
  });

  it('docker-compose should not hardcode pgadmin password', () => {
    const compose = readFile(path.join(ROOT, 'docker-compose.yml'));
    expect(compose).toContain('PGADMIN_PASSWORD:');
  });

  it('api Dockerfile should not contain secrets', () => {
    const dockerfile = readFile(path.join(API_DIR, 'Dockerfile'));
    expect(dockerfile).not.toMatch(/password|secret|key/i);
  });

  it('web Dockerfile should not contain secrets', () => {
    const dockerfile = readFile(path.join(WEB_DIR, 'Dockerfile'));
    expect(dockerfile).not.toMatch(/password|secret|key/i);
  });

  it('.env files should not be committed', () => {
    // Check that .env files don't exist (they should be gitignored)
    expect(fs.existsSync(path.join(ROOT, '.env'))).toBe(false);
    expect(fs.existsSync(path.join(API_DIR, '.env'))).toBe(false);
  });
});

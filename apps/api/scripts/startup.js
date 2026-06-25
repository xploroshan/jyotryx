const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(cmd, label, timeoutMs = 30000) {
  console.log(`[startup] ${label}...`);
  try {
    execSync(cmd, { stdio: 'inherit', timeout: timeoutMs });
    console.log(`[startup] ${label} done.`);
  } catch (err) {
    console.warn(`[startup] ${label} failed or timed out (non-fatal): ${err.message}`);
  }
}

// 1. Run migrations (critical but fast)
// Resolve baseline migrations that may already be applied on the DB
run(
  'npx prisma migrate resolve --applied 20260101_init 2>/dev/null; npx prisma migrate resolve --applied 20260315_add_activity_log 2>/dev/null; npx prisma migrate resolve --applied 20260317_add_site_settings 2>/dev/null; npx prisma migrate resolve --applied 20260326_add_knowledge_base 2>/dev/null',
  'Resolve existing migrations',
  30000
);
// Execute the init migration SQL directly (all statements are idempotent with IF NOT EXISTS)
const initSqlPath = path.resolve(__dirname, '../prisma/migrations/20260101_init/migration.sql');
if (fs.existsSync(initSqlPath)) {
  run(
    `npx prisma db execute --file ${initSqlPath}`,
    'Execute init migration (create core tables)',
    60000
  );
}
// Run any remaining pending migrations
run('npx prisma migrate deploy', 'Prisma migrate deploy', 60000);

// 2. Seed admin/demo users via SQL — NON-PRODUCTION ONLY. seed-users.sql ships
// hardcoded bcrypt hashes for admin@/demo@, so seeding it in production would
// plant a predictable admin credential from a public hash. In production rely
// on the env-driven admin bootstrap (ADMIN_EMAIL/ADMIN_PASSWORD) instead.
if (process.env.NODE_ENV !== 'production') {
  const seedSqlPath = path.resolve(__dirname, '../prisma/seed-users.sql');
  if (fs.existsSync(seedSqlPath)) {
    run(`npx prisma db execute --file ${seedSqlPath}`, 'Seed admin and demo users (non-prod)', 15000);
  }
} else {
  console.log('[startup] Skipping SQL user seed in production (use ADMIN_EMAIL/ADMIN_PASSWORD bootstrap).');
}

// Also try compiled seed for knowledge base data (non-critical)
const seedPath = path.resolve(__dirname, '../dist/prisma/seed.js');
if (fs.existsSync(seedPath)) {
  run(`node ${seedPath}`, 'Database seed (knowledge base)', 30000);
} else {
  console.log('[startup] Compiled seed not found, skipping knowledge seed.');
}

// 3. Start the API server (critical - must bind to PORT)
console.log('[startup] Starting API server...');
const server = spawn('node', ['dist/main'], {
  stdio: 'inherit',
  cwd: path.resolve(__dirname, '..'),
});

server.on('error', (err) => {
  console.error('[startup] Failed to start server:', err);
  process.exit(1);
});

server.on('exit', (code) => {
  process.exit(code || 0);
});

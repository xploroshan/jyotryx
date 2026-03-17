const { execSync, spawn } = require('child_process');

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
run(
  'npx prisma migrate resolve --applied 20260315_add_activity_log 2>/dev/null; npx prisma migrate deploy',
  'Prisma migrate',
  60000
);

// 2. Seed (non-critical, use compiled JS with a 15s timeout)
const seedPath = require('path').resolve(__dirname, '../dist/prisma/seed.js');
const fs = require('fs');
if (fs.existsSync(seedPath)) {
  run(`node ${seedPath}`, 'Database seed', 15000);
} else {
  console.log('[startup] Compiled seed not found, skipping seed.');
}

// 3. Start the API server (critical - must bind to PORT)
console.log('[startup] Starting API server...');
const server = spawn('node', ['dist/main'], {
  stdio: 'inherit',
  cwd: require('path').resolve(__dirname, '..'),
});

server.on('error', (err) => {
  console.error('[startup] Failed to start server:', err);
  process.exit(1);
});

server.on('exit', (code) => {
  process.exit(code || 0);
});

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getFreePort } from './free-port';

export interface PgBouncerHandle {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  url: string;
  stop: () => Promise<void>;
}

/**
 * Start an ephemeral pgBouncer in front of a running Postgres.
 *
 * Uses `auth_type = trust` so tests don't have to juggle md5 hashes or
 * SCRAM challenges. Pool mode is `transaction` to mirror production.
 * Default pool size is small (5) so tests can easily observe pool
 * exhaustion behavior.
 */
export async function startPgBouncer(opts: {
  upstream: { host: string; port: number; database: string; user: string; password: string };
  poolSize?: number;
  maxClientConn?: number;
  poolMode?: 'transaction' | 'session' | 'statement';
}): Promise<PgBouncerHandle> {
  const port = await getFreePort();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jyotryx-int-pgb-'));
  const iniPath = path.join(dir, 'pgbouncer.ini');
  const userlistPath = path.join(dir, 'userlist.txt');
  const logPath = path.join(dir, 'pgbouncer.log');
  const pidPath = path.join(dir, 'pgbouncer.pid');

  const poolSize = opts.poolSize ?? 5;
  const maxClient = opts.maxClientConn ?? 50;
  const poolMode = opts.poolMode ?? 'transaction';

  const ini = `
[databases]
${opts.upstream.database} = host=${opts.upstream.host} port=${opts.upstream.port} dbname=${opts.upstream.database}

[pgbouncer]
listen_addr = 127.0.0.1
listen_port = ${port}
unix_socket_dir =
auth_type = trust
auth_file = ${userlistPath}
pool_mode = ${poolMode}
default_pool_size = ${poolSize}
max_client_conn = ${maxClient}
server_reset_query = DISCARD ALL
logfile = ${logPath}
pidfile = ${pidPath}
admin_users = ${opts.upstream.user}
stats_users = ${opts.upstream.user}
ignore_startup_parameters = extra_float_digits,search_path,options
`;
  fs.writeFileSync(iniPath, ini);
  fs.writeFileSync(userlistPath, `"${opts.upstream.user}" "${opts.upstream.password}"\n`);

  // pgBouncer refuses to run as uid 0 — when tests are invoked as root
  // (common in sandboxed CI runners), drop privileges to the `postgres`
  // system user via the built-in `-u` flag and make sure it can read
  // the config and write the pid/log files.
  const args: string[] = [];
  const uid = process.getuid?.() ?? 0;
  if (uid === 0) {
    const { spawnSync: ss } = require('child_process');
    const r = ss('id', ['postgres']);
    if (r.status === 0) {
      ss('chown', ['-R', 'postgres:postgres', dir]);
      args.push('-u', 'postgres');
    }
  }
  args.push(iniPath);

  const child = spawn('pgbouncer', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderrBuf = '';
  child.stderr?.on('data', (chunk) => {
    stderrBuf += chunk.toString();
  });

  // Wait for listener.
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      await new Promise<void>((resolve, reject) => {
        const s = require('net').connect(port, '127.0.0.1', () => {
          s.end();
          resolve();
        });
        s.on('error', reject);
      });
      break;
    } catch {
      if (child.exitCode !== null) {
        throw new Error(`pgbouncer exited early (code ${child.exitCode}):\n${stderrBuf}`);
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  const stop = async () => {
    if (!child.killed) {
      child.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        if (child.exitCode !== null) return resolve();
        child.once('exit', () => resolve());
        setTimeout(() => {
          if (!child.killed) child.kill('SIGKILL');
          resolve();
        }, 2000);
      });
    }
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  };

  return {
    host: '127.0.0.1',
    port,
    user: opts.upstream.user,
    password: opts.upstream.password,
    database: opts.upstream.database,
    url: `postgresql://${opts.upstream.user}:${opts.upstream.password}@127.0.0.1:${port}/${opts.upstream.database}`,
    stop,
  };
}

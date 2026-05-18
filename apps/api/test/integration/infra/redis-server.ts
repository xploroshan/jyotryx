import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getFreePort } from './free-port';

export interface RedisHandle {
  host: string;
  port: number;
  url: string;
  stop: () => Promise<void>;
}

/**
 * Start an ephemeral redis-server instance on a random port with
 * persistence fully disabled. Returns a handle with the port and a
 * `stop()` to kill the daemon and clean up the temp dir.
 *
 * Requires the `redis-server` binary to be on PATH (Debian/Ubuntu:
 * `apt-get install -y redis-server`).
 */
export async function startRedis(): Promise<RedisHandle> {
  const port = await getFreePort();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'myastro360-int-redis-'));

  const child = spawn(
    'redis-server',
    [
      '--port', String(port),
      '--bind', '127.0.0.1',
      '--save', '',             // no RDB snapshots
      '--appendonly', 'no',     // no AOF
      '--dir', dir,
      '--logfile', path.join(dir, 'redis.log'),
      '--daemonize', 'no',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );

  child.stderr?.on('data', () => {
    // Swallow warnings; surface only if startup probe fails below.
  });

  // Poll TCP until ready (or give up after ~5s).
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
        throw new Error(`redis-server exited early (code ${child.exitCode})`);
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
    url: `redis://127.0.0.1:${port}`,
    stop,
  };
}

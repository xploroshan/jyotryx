import { spawn, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getFreePort } from './free-port';

export interface PostgresHandle {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  url: string;
  dataDir: string;
  stop: () => Promise<void>;
}

const PG_BIN_CANDIDATES = [
  '/usr/lib/postgresql/16/bin',
  '/usr/lib/postgresql/15/bin',
  '/usr/lib/postgresql/14/bin',
  '/usr/pgsql-16/bin',
  '/usr/pgsql-15/bin',
];

function findPgBin(): string {
  for (const p of PG_BIN_CANDIDATES) {
    if (fs.existsSync(path.join(p, 'postgres'))) return p;
  }
  // Fall back to PATH lookup — pg_ctl on PATH is enough for apt installs.
  return '';
}

/**
 * Detect whether we must `su postgres -c ...` to run the server.
 * The `postgres` executable refuses to run as uid 0, so when tests run
 * as root (common in sandboxed CI runners) we drop privileges to the
 * `postgres` system user that ships with the Debian package.
 */
function needsPostgresUser(): boolean {
  if (process.getuid && process.getuid() === 0) {
    const r = spawnSync('id', ['postgres']);
    return r.status === 0;
  }
  return false;
}

function runAsPostgres(cmd: string): { status: number | null; stdout: string; stderr: string } {
  if (needsPostgresUser()) {
    const r = spawnSync('su', ['postgres', '-c', cmd], { encoding: 'utf8' });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
  }
  const r = spawnSync('sh', ['-c', cmd], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/**
 * Spin up an ephemeral PostgreSQL cluster on a random port.
 *
 * - Uses `initdb -A trust` so tests don't juggle passwords
 * - Listens on 127.0.0.1 only
 * - Drops privileges to the `postgres` system user when invoked as root
 *   (Debian's postgres refuses to run as uid 0)
 *
 * Call `.stop()` to SIGTERM the cluster and remove the data dir.
 */
export async function startPostgres(opts: {
  database?: string;
  user?: string;
  password?: string;
} = {}): Promise<PostgresHandle> {
  const user = opts.user ?? 'jyotryx';
  const password = opts.password ?? 'jyotryx';
  const database = opts.database ?? 'jyotryx_test';

  const port = await getFreePort();
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jyotryx-int-pg-'));
  const dataDir = path.join(baseDir, 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  const pgBin = findPgBin();
  const prefix = pgBin ? `${pgBin}/` : '';

  // Ownership fix for the `su postgres` path. Permission 0o700 is what
  // initdb expects; anything looser and it bails.
  if (needsPostgresUser()) {
    spawnSync('chown', ['-R', 'postgres:postgres', baseDir]);
  }
  fs.chmodSync(dataDir, 0o700);

  // --- initdb ---
  const initdb = runAsPostgres(
    `${prefix}initdb -D ${dataDir} -A trust -U ${user} -E UTF8 --locale=C`,
  );
  if (initdb.status !== 0) {
    throw new Error(`initdb failed (code ${initdb.status}):\n${initdb.stderr || initdb.stdout}`);
  }

  // --- start ---
  const logFile = path.join(baseDir, 'postgres.log');
  const start = runAsPostgres(
    `${prefix}pg_ctl -D ${dataDir} -l ${logFile} -o "-p ${port} -h 127.0.0.1 -k ${baseDir}" -w start`,
  );
  if (start.status !== 0) {
    const log = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '';
    throw new Error(`pg_ctl start failed:\n${start.stderr || start.stdout}\n---\n${log}`);
  }

  // --- create database ---
  const psqlCreateDb = runAsPostgres(
    `${prefix}psql -h 127.0.0.1 -p ${port} -U ${user} -d postgres -c 'CREATE DATABASE "${database}";'`,
  );
  if (psqlCreateDb.status !== 0) {
    throw new Error(`CREATE DATABASE failed:\n${psqlCreateDb.stderr || psqlCreateDb.stdout}`);
  }

  // Assign the requested password so downstream consumers (e.g.
  // pgBouncer with md5/scram) have a credential even though local
  // connections are trust-based.
  runAsPostgres(
    `${prefix}psql -h 127.0.0.1 -p ${port} -U ${user} -d postgres -c "ALTER USER \\"${user}\\" WITH PASSWORD '${password}';"`,
  );

  const url = `postgresql://${user}:${password}@127.0.0.1:${port}/${database}`;

  const stop = async () => {
    runAsPostgres(`${prefix}pg_ctl -D ${dataDir} -m fast -w stop`);
    try {
      if (needsPostgresUser()) {
        spawnSync('rm', ['-rf', baseDir]);
      } else {
        fs.rmSync(baseDir, { recursive: true, force: true });
      }
    } catch {
      /* ignore */
    }
  };

  return {
    host: '127.0.0.1',
    port,
    user,
    password,
    database,
    url,
    dataDir,
    stop,
  };
}

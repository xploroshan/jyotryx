import { spawnSync } from 'child_process';
import * as fs from 'fs';

/**
 * Jest globalTeardown — stop the daemons started by global-setup.ts.
 *
 * Prefers the in-process handles stashed on `globalThis`. Falls back to
 * `pg_ctl stop` + ad-hoc process kills if jest ran setup/teardown in
 * separate node processes and the in-memory handles are gone.
 */
export default async function globalTeardown(): Promise<void> {
  const handles = (globalThis as any).__MYASTRO360_INT__;

  if (handles) {
    await Promise.allSettled([
      handles.pgb?.stop?.(),
      handles.postgres?.stop?.(),
      handles.redis?.stop?.(),
    ]);
  } else if (process.env.MYASTRO360_INT_HANDOFF && fs.existsSync(process.env.MYASTRO360_INT_HANDOFF)) {
    // Best-effort fallback: use the handoff file to pg_ctl stop, then
    // nuke any lingering processes via fuser/lsof on the recorded ports.
    try {
      const info = JSON.parse(fs.readFileSync(process.env.MYASTRO360_INT_HANDOFF, 'utf8'));
      if (info?.postgres?.dataDir) {
        const uid = process.getuid?.() ?? 0;
        const su = uid === 0 ? 'su postgres -c ' : '';
        spawnSync(
          'sh',
          [
            '-c',
            `${su}"/usr/lib/postgresql/16/bin/pg_ctl -D ${info.postgres.dataDir} -m fast -w stop" || true`,
          ],
        );
      }
    } catch {
      /* ignore */
    }
  }
}

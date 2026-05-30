import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const HANDOFF = process.env.E2E_REALAPI_HANDOFF
  ?? path.join(os.tmpdir(), 'myastro360-e2e-realapi.json');

/**
 * Tears down everything global-setup started: the API child process and the
 * Postgres/Redis daemons. Handles are stashed on globalThis (same Node
 * process as setup); we also best-effort SIGKILL the API pid from the
 * handoff file in case the handle was lost.
 */
export default async function globalTeardown(): Promise<void> {
  const stash = (globalThis as any).__E2E_REALAPI__ as
    | { api: any; redis: { stop: () => Promise<void> }; postgres: { stop: () => Promise<void> } }
    | undefined;

  try {
    stash?.api?.kill?.('SIGTERM');
  } catch { /* noop */ }

  try {
    await stash?.redis?.stop?.();
  } catch { /* noop */ }
  try {
    await stash?.postgres?.stop?.();
  } catch { /* noop */ }

  // Fallback: if the handle was lost (e.g. cross-process), kill the API pid.
  if (!stash && fs.existsSync(HANDOFF)) {
    try {
      const h = JSON.parse(fs.readFileSync(HANDOFF, 'utf8'));
      if (h.apiPid) process.kill(h.apiPid, 'SIGKILL');
    } catch { /* noop */ }
  }

  try {
    if (fs.existsSync(HANDOFF)) fs.unlinkSync(HANDOFF);
  } catch { /* noop */ }
}

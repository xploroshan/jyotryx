import { createServer } from 'net';

/**
 * Grab an unused TCP port by binding to :0 and reading the OS-assigned
 * port, then releasing it. Subject to a tiny TOCTOU window, but good
 * enough for ephemeral test daemons.
 */
export function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (addr && typeof addr === 'object') {
        const port = addr.port;
        srv.close(() => resolve(port));
      } else {
        srv.close(() => reject(new Error('Unable to resolve free port')));
      }
    });
  });
}

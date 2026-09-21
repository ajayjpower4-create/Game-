import os from 'node:os';
import { createApp } from './app.js';

export function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) for (const i of list || []) if (i.family === 'IPv4' && !i.internal) out.push(i.address);
  return out;
}

// secretBox: optional { available, encrypt, decrypt } used to seal the EA
// sign-in on disk (the desktop app passes the OS keychain).
export function startServer({ port = 3826, host = '0.0.0.0', dataDir, secretBox = null, log = () => {} } = {}) {
  const app = createApp({ dataDir, secretBox, log });
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      const actual = server.address().port;
      const urls = [`http://localhost:${actual}`, ...lanAddresses().map((a) => `http://${a}:${actual}`)];
      resolve({ app, server, port: actual, urls, lan: lanAddresses() });
    });
    server.on('error', reject);
  });
}

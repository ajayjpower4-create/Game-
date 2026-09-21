import os from 'node:os';
import { createApp } from './app.js';

export function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) for (const i of list || []) if (i.family === 'IPv4' && !i.internal) out.push(i.address);
  return out;
}

export function startServer({ port = 3826, host = '0.0.0.0', dataDir, log = () => {} } = {}) {
  const app = createApp({ dataDir, log });
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      const actual = server.address().port;
      const urls = [`http://localhost:${actual}`, ...lanAddresses().map((a) => `http://${a}:${actual}`)];
      resolve({ app, server, port: actual, urls, lan: lanAddresses() });
    });
    server.on('error', reject);
  });
}

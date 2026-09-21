// Minimal HTTPS helper for EA. EA's Blaze host still negotiates legacy TLS
// renegotiation, which Node refuses by default, so requests to that host go
// through an agent that allows it (the same thing the reference client does).

import https from 'node:https';
import zlib from 'node:zlib';
import { constants as cryptoConstants } from 'node:crypto';
import { WAL_HOST } from './constants.js';

const legacyAgent = new https.Agent({
  keepAlive: true,
  rejectUnauthorized: false,
  secureOptions: cryptoConstants.SSL_OP_LEGACY_SERVER_CONNECT,
});
const normalAgent = new https.Agent({ keepAlive: true });

export function request(url, { method = 'GET', headers = {}, body = null, timeoutMs = 45000, followRedirects = false } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const agent = url.startsWith(WAL_HOST) ? legacyAgent : normalAgent;
    const req = https.request(
      { hostname: u.hostname, port: u.port || 443, path: u.pathname + u.search, method, headers, agent, timeout: timeoutMs },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          let buf = Buffer.concat(chunks);
          const enc = String(res.headers['content-encoding'] || '');
          try {
            if (enc.includes('gzip')) buf = zlib.gunzipSync(buf);
            else if (enc.includes('deflate')) buf = zlib.inflateSync(buf);
            else if (enc.includes('br')) buf = zlib.brotliDecompressSync(buf);
          } catch { /* leave raw */ }
          resolve({ status: res.statusCode, headers: res.headers, text: buf.toString('utf8'), ok: res.statusCode >= 200 && res.statusCode < 300 });
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error(`Timed out talking to ${u.hostname}`)));
    req.on('error', reject);
    if (body != null) req.write(body);
    req.end();
  });
}

export function parseJson(text) {
  // EA sometimes leaves control characters inside string values.
  const cleaned = text.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  return JSON.parse(cleaned);
}

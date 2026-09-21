// Message authentication for Blaze "Process" commands: what the companion app
// attaches to every command so the server accepts it.

import { createHash, randomBytes } from 'node:crypto';

const STATIC_DATA = '05e6a7ead5584ab4';
const XOR_KEY = Buffer.from('634203362017bf72f70ba900c0aa4e6b', 'hex');
const AUTH_CODE_SALT = Buffer.from('3a53413521464c3b6531326530705b70203a2900', 'hex');
export const AUTH_TYPE = 17039361;

export function messageAuth(blazeId, requestId, rand = randomBytes(4)) {
  const payload = Buffer.from(JSON.stringify({ staticData: STATIC_DATA, requestId, blazeId }), 'utf8');
  const keystream = createHash('md5').update(rand).update(XOR_KEY).digest();
  const scrambled = Buffer.from(payload.map((b, i) => b ^ keystream[i % 16]));
  const authDataBytes = Buffer.concat([rand, scrambled]);
  const authCode = createHash('md5').update(AUTH_CODE_SALT).update(authDataBytes).digest('base64');
  return { authData: authDataBytes.toString('base64'), authCode, authType: AUTH_TYPE };
}

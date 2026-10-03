import { createHash, createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { ConfigurationError } from './config.js';
const NAME = 'fabep_session';
const TTL = 8 * 60 * 60;
function key() {
  const secret = process.env.OPENAI_API_KEY?.trim();
  if (!secret) throw new ConfigurationError('Sesión no configurada');
  return createHash('sha256').update('fabep/session/v1\0').update(secret).digest();
}
export function newSession() {
  return { version: 1, id: randomUUID(), expires: Date.now() + TTL * 1000, previous: null, turns: 0 };
}
export function encodeSession(session) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(NAME));
  const data = Buffer.concat([cipher.update(JSON.stringify(session), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
}
export function readSession(req) {
  key();
  const cookie = (req.headers.cookie || '').split(';').map(item => item.trim()).find(item => item.startsWith(`${NAME}=`));
  if (!cookie) return newSession();
  try {
    const raw = cookie.slice(NAME.length + 1);
    if (raw.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(raw)) throw new Error();
    const packed = Buffer.from(raw, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', key(), packed.subarray(0, 12));
    decipher.setAAD(Buffer.from(NAME));
    decipher.setAuthTag(packed.subarray(12, 28));
    const value = JSON.parse(Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString('utf8'));
    if (value.version !== 1 || typeof value.id !== 'string' || !Number.isFinite(value.expires) || value.expires <= Date.now() || !Number.isInteger(value.turns) || value.turns < 0 || value.turns >= 40 || (value.previous !== null && !/^resp_[A-Za-z0-9_-]+$/.test(value.previous))) throw new Error();
    return value;
  } catch { return newSession(); }
}
export function writeSession(res, session) {
  const secure = process.env.VERCEL || process.env.NODE_ENV === 'production';
  const remaining = Math.max(0, Math.floor((session.expires - Date.now()) / 1000));
  res.setHeader('Set-Cookie', `${NAME}=${encodeSession(session)}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${remaining}${secure ? '; Secure' : ''}`);
}

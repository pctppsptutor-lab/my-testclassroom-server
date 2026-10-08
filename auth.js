/* THE place IT plugs Edupia login in. Everything else in the server stays unchanged.
 * Return { teacherId } to accept, or null to reject.
 * `req` is the HTTP upgrade request (cookies/headers available); `hello` is the client's hello payload. */
import { timingSafeEqual } from 'node:crypto';

const eq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };

export async function authenticateTeacher(req, hello) {
  // TODO(IT): replace with SSO/session-cookie verification, e.g. verify a JWT from req.headers.cookie.
  const key = process.env.TEACHER_KEY;
  if (key && hello.teacherKey && eq(hello.teacherKey, key)) return { teacherId: 'shared-key' };
  return null;
}

export function authenticateAdmin(req) {
  const token = process.env.ADMIN_TOKEN;
  const h = req.headers.authorization || '';
  return Boolean(token && token.length >= 16 && h.startsWith('Bearer ') && eq(h.slice(7), token));
}

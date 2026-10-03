export const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
export function securityHeaders(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', CSP);
}
export function prepare(req, res, method) {
  securityHeaders(res);
  const methods = Array.isArray(method) ? method : [method];
  if (!methods.includes(req.method)) {
    res.setHeader('Allow', methods.join(', '));
    res.status(405).json({ error: 'Método no permitido.' }); return false;
  }
  if (req.method !== 'GET') {
    if (req.headers['sec-fetch-site'] === 'cross-site') {
      res.status(403).json({ error: 'Origen no permitido.' }); return false;
    }
    if (req.headers.origin) {
      try { if (new URL(req.headers.origin).host !== req.headers.host) throw new Error(); }
      catch { res.status(403).json({ error: 'Origen no permitido.' }); return false; }
    }
    if (req.method !== 'DELETE' && !/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
      res.status(415).json({ error: 'Enviá la consulta como JSON.' }); return false;
    }
  }
  return true;
}
export function body(req) {
  const value = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('JSON inválido');
  if (Buffer.byteLength(JSON.stringify(value)) > 24576) throw new Error('JSON demasiado extenso');
  return value;
}

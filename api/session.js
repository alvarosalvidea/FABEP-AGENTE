import { prepare, body } from '../lib/http.js';
import { newSession, writeSession } from '../lib/session.js';
import { ConfigurationError } from '../lib/config.js';
export default function session(req, res) {
  if (!prepare(req, res, ['POST', 'DELETE'])) return;
  if (req.method === 'POST') {
    try { body(req); } catch { return res.status(400).json({ error: 'Enviá un objeto JSON válido.' }); }
  }
  try { writeSession(res, newSession()); res.status(200).json({ ok: true }); }
  catch (error) { res.status(error instanceof ConfigurationError ? 503 : 500).json({ error: 'No se pudo iniciar una conversación. Intentá nuevamente más tarde.' }); }
}
